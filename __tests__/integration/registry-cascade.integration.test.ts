import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestSupabase, cleanupImport } from '../helpers/real-supabase';
import { loadCsvFixture } from '../helpers/csv-test-data';
import { apiGet, apiImportCsv, getAccessToken } from '../helpers/api-client';
import {
  parseCsvContent,
  extractCropList,
  parseDosage,
  type CsvRow,
} from '@/lib/pesticide-registry';

/**
 * Integration test: CSV Import → Cascade HTTP API verification
 *
 * Calls the real Next.js API endpoints:
 *   POST /api/pesticide-registry/import  (upload CSV)
 *   GET  /api/cascade?type=findings      (query findings)
 *   GET  /api/cascade?type=materials     (query materials)
 *   GET  /api/cascade?type=dosage        (query dosage)
 *
 * Usage:
 *   npm run test:integration                                          → default fixture
 *   TEST_CSV_PATH=/path/to/file.csv npm run test:integration          → your CSV
 *   TEST_CSV_PATH=... TEST_CROPS="עגבנייה,תפוח" npm run test:integration → specific crops
 *
 * Requires:
 *   - Local Supabase running (npx supabase start)
 *   - Next.js dev server running (npm run dev) on localhost:3000
 *   - Admin user exists (npm run create-admin)
 */

// ── Parse CSV at module load time so it.each can use it ──────────────

const csvContent = loadCsvFixture();
const allCsvRows = parseCsvContent(csvContent);
const cropList = extractCropList(allCsvRows);

// TEST_CROPS="עגבנייה,תפוח" or TEST_CROPS=all or default first 3
const testCropsEnv = process.env.TEST_CROPS;
const selectedCrops = testCropsEnv === 'all'
  ? cropList.map((c) => c.name)
  : testCropsEnv
    ? testCropsEnv.split(',').map((c) => c.trim())
    : cropList.slice(0, 3).map((c) => c.name);

const csvRows = allCsvRows.filter((r) => selectedCrops.includes(r.crop_name));

// ── Pre-compute expected data from CSV ───────────────────────────────

interface CropPestData { crop: string; pests: string[] }
interface MaterialTestCase { crop: string; pest: string; materials: string[] }
interface DosageTestCase {
  crop: string; pest: string; material: string;
  possibleDosages: Array<{ value: number; unit: string | null }>;
}

function buildExpectedData(rows: CsvRow[]) {
  const pestsByCrop: Record<string, Set<string>> = {};
  const materialsByCropPest: Record<string, Set<string>> = {};
  const dosageCases: DosageTestCase[] = [];
  const seenDosageKeys = new Set<string>();

  for (const row of rows) {
    if (!row.crop_name) continue;

    if (!pestsByCrop[row.crop_name]) pestsByCrop[row.crop_name] = new Set();
    if (row.pest_name) pestsByCrop[row.crop_name].add(row.pest_name);

    const cpKey = `${row.crop_name}|||${row.pest_name || ''}`;
    if (!materialsByCropPest[cpKey]) materialsByCropPest[cpKey] = new Set();
    if (row.material_name) materialsByCropPest[cpKey].add(row.material_name);

    if (row.material_name && row.dosage_text) {
      const dKey = `${row.crop_name}|||${row.pest_name || ''}|||${row.material_name}`;
      const parsed = parseDosage(row.dosage_text);
      if (parsed.value !== null) {
        if (!seenDosageKeys.has(dKey)) {
          seenDosageKeys.add(dKey);
          dosageCases.push({
            crop: row.crop_name, pest: row.pest_name || '', material: row.material_name,
            possibleDosages: [{ value: parsed.value, unit: parsed.unit_name }],
          });
        } else {
          const existing = dosageCases.find((d) => `${d.crop}|||${d.pest}|||${d.material}` === dKey);
          if (existing) existing.possibleDosages.push({ value: parsed.value, unit: parsed.unit_name });
        }
      }
    }
  }

  const cropPestData: CropPestData[] = Object.entries(pestsByCrop)
    .filter(([, pests]) => pests.size > 0)
    .map(([crop, pests]) => ({ crop, pests: [...pests] }));

  const materialCases: MaterialTestCase[] = [];
  for (const [cpKey, mats] of Object.entries(materialsByCropPest)) {
    const [crop, pest] = cpKey.split('|||');
    if (pest && mats.size > 0) materialCases.push({ crop, pest, materials: [...mats] });
  }

  return { cropPestData, materialCases, dosageCases };
}

const { cropPestData, materialCases, dosageCases } = buildExpectedData(csvRows);

// ── Runtime state ────────────────────────────────────────────────────

let supabase: SupabaseClient;
let importResponse: any;
let cropMap: Record<string, string>;
let findingMap: Record<string, string>;
let materialMap: Record<string, string>;

beforeAll(async () => {
  supabase = createTestSupabase();

  // 1. Verify Supabase is reachable
  const { error } = await supabase.from('crops').select('id').limit(1);
  if (error) {
    throw new Error(`Cannot connect to local Supabase. Run "npx supabase start" first.\n${error.message}`);
  }

  // 2. Verify Next.js server + auth
  try {
    await getAccessToken();
  } catch (e: any) {
    throw new Error(`Cannot authenticate. Ensure Next.js is running (npm run dev) and admin user exists (npm run create-admin).\n${e.message}`);
  }

  // 3. Import CSV via POST /api/pesticide-registry/import
  const res = await apiImportCsv(csvContent, selectedCrops, true);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/pesticide-registry/import failed (${res.status}): ${body}`);
  }
  importResponse = await res.json();

  // 4. Build ID maps by querying DB for imported entities
  cropMap = {};
  for (const name of selectedCrops) {
    const { data } = await (supabase.from('crops') as any).select('id').eq('name', name).single();
    if (data) cropMap[name] = data.id;
  }

  findingMap = {};
  const allPests = [...new Set(csvRows.map((r) => r.pest_name).filter(Boolean))];
  for (const name of allPests) {
    const { data } = await (supabase.from('findings') as any).select('id').eq('name', name).single();
    if (data) findingMap[name] = data.id;
  }

  materialMap = {};
  const allMats = [...new Set(csvRows.map((r) => r.material_name).filter(Boolean))];
  for (const name of allMats) {
    const { data } = await (supabase.from('materials') as any).select('id').eq('name', name).single();
    if (data) materialMap[name] = data.id;
  }
});

afterAll(async () => {
  if (!importResponse?.batchId) return;

  await cleanupImport(
    supabase,
    importResponse.batchId,
    Object.values(cropMap || {}),
    Object.values(findingMap || {}),
    Object.values(materialMap || {})
  );
});

// ─── POST /api/pesticide-registry/import ─────────────────────────────

describe('POST /api/pesticide-registry/import', () => {
  it('returns success with no errors', () => {
    expect(importResponse.success).toBe(true);
    expect(importResponse.summary.errors).toHaveLength(0);
  });

  it('returns batchId', () => {
    expect(importResponse.batchId).toBeDefined();
  });

  it('imports correct registry row count', () => {
    expect(importResponse.summary.registryRows).toBe(csvRows.length);
  });

  it('imports all selected crops', () => {
    expect(importResponse.summary.crops).toBe(selectedCrops.length);
  });

  it('imports all unique findings', () => {
    const allPests = new Set<string>();
    csvRows.forEach((r) => { if (r.pest_name) allPests.add(r.pest_name); });
    expect(importResponse.summary.findings).toBe(allPests.size);
  });

  it('imports all unique materials', () => {
    const allMats = new Set<string>();
    csvRows.forEach((r) => { if (r.material_name) allMats.add(r.material_name); });
    expect(importResponse.summary.materials).toBe(allMats.size);
  });

  it('creates recommendations', () => {
    expect(importResponse.summary.recommendations).toBeGreaterThanOrEqual(1);
  });
});

// ─── GET /api/cascade?type=findings ──────────────────────────────────

describe('GET /api/cascade?type=findings', () => {
  it.each(
    cropPestData.map((cp) => [cp.crop, cp.pests])
  )('returns findings for crop "%s"', async (cropName, expectedPests) => {
    const cropId = cropMap[cropName as string];
    if (!cropId) return;

    const res = await apiGet('/api/cascade', { type: 'findings', cropId });
    expect(res.status).toBe(200);

    const findings = await res.json();
    expect(findings.length).toBeGreaterThanOrEqual((expectedPests as string[]).length);

    const names = findings.map((f: any) => f.name);
    for (const pest of expectedPests as string[]) {
      expect(names).toContain(pest);
    }
  });

  it('returns 400 without cropId', async () => {
    const res = await apiGet('/api/cascade', { type: 'findings' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/cascade?type=materials ─────────────────────────────────

describe('GET /api/cascade?type=materials', () => {
  it.each(
    materialCases.map((tc) => [tc.crop, tc.pest, tc.materials])
  )('returns materials for "%s" + "%s"', async (cropName, pestName, expectedMaterials) => {
    const cropId = cropMap[cropName as string];
    const findingId = findingMap[pestName as string];
    if (!cropId || !findingId) return;

    const res = await apiGet('/api/cascade', { type: 'materials', cropId, findingId });
    expect(res.status).toBe(200);

    const materials = await res.json();
    expect(materials.length).toBeGreaterThanOrEqual(1);

    const names = materials.map((m: any) => m.name);
    for (const mat of expectedMaterials as string[]) {
      expect(names).toContain(mat);
    }
  });

  it('materials have recommended_dosage', async () => {
    if (materialCases.length === 0) return;
    const first = materialCases[0];
    const cropId = cropMap[first.crop];
    const findingId = findingMap[first.pest];
    if (!cropId || !findingId) return;

    const res = await apiGet('/api/cascade', { type: 'materials', cropId, findingId });
    const materials = await res.json();

    for (const mat of materials) {
      expect(mat).toHaveProperty('recommended_dosage');
      expect(mat).toHaveProperty('recommended_unit_type');
    }
  });

  it('deduplicates materials by id', async () => {
    const cropId = cropMap[selectedCrops[0]];
    if (!cropId) return;

    const res = await apiGet('/api/cascade', { type: 'materials', cropId });
    const materials = await res.json();

    const ids = materials.map((m: any) => m.id);
    expect(ids.length).toBe([...new Set(ids)].length);
  });

  it('returns 400 without cropId', async () => {
    const res = await apiGet('/api/cascade', { type: 'materials' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/cascade?type=dosage ────────────────────────────────────

describe('GET /api/cascade?type=dosage', () => {
  it.each(
    dosageCases.map((tc) => [tc.crop, tc.pest, tc.material, tc.possibleDosages])
  )(
    'dosage for "%s" + "%s" + "%s"',
    async (cropName, pestName, materialName, possibleDosages) => {
      const cropId = cropMap[cropName as string];
      const findingId = (pestName as string) ? findingMap[pestName as string] : null;
      const materialId = materialMap[materialName as string];
      if (!cropId || !materialId) return;

      const params: Record<string, string> = { type: 'dosage', cropId, materialId };
      if (findingId) params.findingId = findingId;

      const res = await apiGet('/api/cascade', params);
      expect(res.status).toBe(200);

      const dosage = await res.json();
      expect(dosage).not.toBeNull();

      const validDosages = possibleDosages as Array<{ value: number; unit: string | null }>;
      const possibleValues = validDosages.map((d) => d.value);
      expect(possibleValues).toContain(dosage.dosage);

      if (dosage.unit_type) {
        const possibleUnits = validDosages.map((d) => d.unit).filter(Boolean);
        if (possibleUnits.length > 0) {
          expect(possibleUnits).toContain(dosage.unit_type.name);
        }
      }
    }
  );

  it('returns 400 without cropId and materialId', async () => {
    const res = await apiGet('/api/cascade', { type: 'dosage' });
    expect(res.status).toBe(400);
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('GET /api/cascade validation', () => {
  it('returns 400 for invalid type', async () => {
    const res = await apiGet('/api/cascade', { type: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when no type provided', async () => {
    const res = await apiGet('/api/cascade');
    expect(res.status).toBe(400);
  });
});
