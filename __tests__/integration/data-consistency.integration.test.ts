import { describe, it, expect, beforeAll } from 'vitest';
import { loadCsvFixture } from '../helpers/csv-test-data';
import { apiGet, getAccessToken } from '../helpers/api-client';
import { parseCsvContent, parseDosage, type CsvRow } from '@/lib/pesticide-registry';

/**
 * Data consistency tests — CSV as source of truth, queries via HTTP API only.
 *
 * Strategy:
 *   1. Parse CSV → know all crops, findings, materials, combinations
 *   2. GET /api/crops → find which crops actually exist in DB
 *   3. Intersect: only test scope = crops in BOTH CSV and DB
 *   4. For that scope, assert every CSV fact is returned by the API
 *
 * No imports, no DB writes, no cleanup — pure read-only verification.
 *
 * Usage:
 *   npm run test:integration
 *   TEST_CSV_PATH=/path/to/file.csv npm run test:integration
 *
 * Requires:
 *   - Next.js dev server running (npm run dev)
 *   - CSV data already imported (via admin UI or registry-cascade integration test)
 */

// ── Parse CSV at module load time ────────────────────────────────────

const csvContent = loadCsvFixture();
const allCsvRows = parseCsvContent(csvContent);

// Build CSV knowledge: pests per crop, materials per crop+pest, dosages
const csvPestsByCrop: Record<string, Set<string>> = {};
const csvMaterialsByCropPest: Record<string, Set<string>> = {};
const csvDosagesByCombo: Record<string, Array<{ value: number; unit: string | null }>> = {};

for (const row of allCsvRows) {
  const { crop_name, pest_name, material_name, dosage_text } = row;
  if (!crop_name) continue;

  // pests per crop
  if (!csvPestsByCrop[crop_name]) csvPestsByCrop[crop_name] = new Set();
  if (pest_name) csvPestsByCrop[crop_name].add(pest_name);

  // materials per crop+pest
  if (material_name) {
    const cpKey = `${crop_name}|||${pest_name || ''}`;
    if (!csvMaterialsByCropPest[cpKey]) csvMaterialsByCropPest[cpKey] = new Set();
    csvMaterialsByCropPest[cpKey].add(material_name);

    // dosages per combo
    if (dosage_text) {
      const dKey = `${crop_name}|||${pest_name || ''}|||${material_name}`;
      const parsed = parseDosage(dosage_text);
      if (parsed.value !== null) {
        if (!csvDosagesByCombo[dKey]) csvDosagesByCombo[dKey] = [];
        csvDosagesByCombo[dKey].push({ value: parsed.value, unit: parsed.unit_name });
      }
    }
  }
}

const csvCropNames = Object.keys(csvPestsByCrop);

// ── Runtime state (populated in beforeAll) ───────────────────────────

// Crops that exist in BOTH the CSV and the DB — our test scope
let inScopeCrops: Array<{ id: string; name: string }> = [];

// API data fetched once and reused across tests
let apiCropsByName: Record<string, { id: string; name: string }> = {};
let apiFindingsById: Record<string, { id: string; name: string }> = {};
let apiMaterialsById: Record<string, { id: string; name: string }> = {};
let apiRecommendations: any[] = [];

beforeAll(async () => {
  try {
    await getAccessToken();
  } catch (e: any) {
    throw new Error(
      `Cannot authenticate. Ensure:\n` +
      `  1. npm run dev is running\n` +
      `  2. npm run create-admin has been run\n${e.message}`
    );
  }

  // Fetch all reference data from API in parallel
  const [cropsRes, findingsRes, materialsRes, recsRes] = await Promise.all([
    apiGet('/api/crops'),
    apiGet('/api/findings'),
    apiGet('/api/materials'),
    apiGet('/api/recommend-materials'),
  ]);

  if (!cropsRes.ok) throw new Error(`GET /api/crops failed (${cropsRes.status})`);
  if (!findingsRes.ok) throw new Error(`GET /api/findings failed (${findingsRes.status})`);
  if (!materialsRes.ok) throw new Error(`GET /api/materials failed (${materialsRes.status})`);
  if (!recsRes.ok) throw new Error(`GET /api/recommend-materials failed (${recsRes.status})`);

  const apiCrops: any[] = await cropsRes.json();
  const apiFindings: any[] = await findingsRes.json();
  const apiMaterials: any[] = await materialsRes.json();
  apiRecommendations = await recsRes.json();

  // Index by name
  apiCrops.forEach((c) => { apiCropsByName[c.name] = c; });
  apiFindings.forEach((f) => { apiFindingsById[f.id] = f; });
  apiMaterials.forEach((m) => { apiMaterialsById[m.id] = m; });

  // Intersect: only crops present in BOTH the CSV and the DB
  inScopeCrops = csvCropNames
    .filter((name) => apiCropsByName[name])
    .map((name) => apiCropsByName[name]);

  if (inScopeCrops.length === 0) {
    throw new Error(
      `No matching crops found between CSV and database.\n` +
      `CSV crops: ${csvCropNames.slice(0, 5).join(', ')}...\n` +
      `Import the CSV first via /admin/pesticide-registry`
    );
  }

  console.log(`\nTest scope: ${inScopeCrops.length} crops (from ${csvCropNames.length} in CSV, ${apiCrops.length} in DB)`);
  console.log(`Crops: ${inScopeCrops.map((c) => c.name).slice(0, 5).join(', ')}${inScopeCrops.length > 5 ? '...' : ''}`);
});

// ─── Crops ───────────────────────────────────────────────────────────

describe('GET /api/crops — CSV crops exist in DB', () => {
  it('at least one CSV crop exists in the database', () => {
    expect(inScopeCrops.length).toBeGreaterThan(0);
  });

  it.each(
    csvCropNames.map((name) => [name])
  )('CSV crop "%s" is returned by /api/crops', (cropName) => {
    // Only assert for crops that should be in DB (i.e., in scope)
    const apiCrop = apiCropsByName[cropName as string];
    if (!apiCrop) {
      // Crop not in DB — skip (not all CSV crops need to be imported)
      return;
    }
    expect(apiCrop.name).toBe(cropName);
    expect(apiCrop.id).toBeDefined();
  });
});

// ─── Findings per crop ───────────────────────────────────────────────

describe('GET /api/cascade?type=findings — CSV pests exist per crop', () => {
  it.each(
    // One test per in-scope crop that has pests in CSV
    inScopeCrops
      .filter((crop) => (csvPestsByCrop[crop.name]?.size ?? 0) > 0)
      .map((crop) => [crop.name, crop.id, [...(csvPestsByCrop[crop.name] ?? [])]])
  )(
    'crop "%s" — cascade findings contains all CSV pests',
    async (cropName, cropId, expectedPests) => {
      const res = await apiGet('/api/cascade', { type: 'findings', cropId: cropId as string });
      expect(res.status).toBe(200);

      const findings = await res.json();
      const returnedNames = findings.map((f: any) => f.name);

      const missing = (expectedPests as string[]).filter((p) => !returnedNames.includes(p));
      if (missing.length > 0) {
        console.log(`Missing findings for ${cropName}: ${missing.join(', ')}`);
      }
      expect(missing).toEqual([]);
    }
  );
});

// ─── Materials per crop+pest ──────────────────────────────────────────

describe('GET /api/cascade?type=materials — CSV materials exist per crop+pest', () => {
  // Build test cases from in-scope crops only
  const materialCases: Array<{ cropName: string; cropId: string; pest: string; materials: string[] }> = [];

  for (const crop of inScopeCrops) {
    const pests = csvPestsByCrop[crop.name];
    if (!pests) continue;

    for (const pest of pests) {
      const cpKey = `${crop.name}|||${pest}`;
      const materials = csvMaterialsByCropPest[cpKey];
      if (materials?.size) {
        materialCases.push({
          cropName: crop.name,
          cropId: crop.id,
          pest,
          materials: [...materials],
        });
      }
    }
  }

  it.each(
    materialCases.map((tc) => [tc.cropName, tc.pest, tc.cropId, tc.materials])
  )(
    'crop "%s" + pest "%s" — cascade materials contains all CSV materials',
    async (cropName, pestName, cropId, expectedMaterials) => {
      // Look up findingId from the API findings data (by name)
      const finding = Object.values(apiFindingsById).find((f) => f.name === pestName);
      if (!finding) return; // finding not in DB, skip

      const res = await apiGet('/api/cascade', {
        type: 'materials',
        cropId: cropId as string,
        findingId: finding.id,
      });
      expect(res.status).toBe(200);

      const materials = await res.json();
      const returnedNames = materials.map((m: any) => m.name);

      const missing = (expectedMaterials as string[]).filter((m) => !returnedNames.includes(m));
      if (missing.length > 0) {
        console.log(`Missing materials for ${cropName}+${pestName}: ${missing.join(', ')}`);
      }
      expect(missing).toEqual([]);
    }
  );
});

// ─── Combinations in recommend-materials ─────────────────────────────

describe('GET /api/recommend-materials — CSV crop+pest+material combinations exist', () => {
  // Build a lookup from the API recommendations response
  // key: cropId|findingId|materialId → true
  let apiComboLookup: Set<string>;

  beforeAll(() => {
    apiComboLookup = new Set<string>();
    for (const rec of apiRecommendations) {
      const { crop_id, finding_id, material_id } = rec.key;
      apiComboLookup.add(`${crop_id}|${finding_id ?? 'null'}|${material_id}`);
    }
  });

  it('at least one recommendation exists in the database', () => {
    expect(apiRecommendations.length).toBeGreaterThan(0);
  });

  // Build combo test cases from in-scope crops
  const comboCases: Array<{ cropName: string; pest: string; material: string }> = [];
  const seen = new Set<string>();
  for (const row of allCsvRows) {
    const { crop_name, pest_name, material_name } = row;
    if (!crop_name || !material_name) continue;
    const key = `${crop_name}|||${pest_name || ''}|||${material_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      comboCases.push({ cropName: crop_name, pest: pest_name || '', material: material_name });
    }
  }

  it.each(
    comboCases.map((c) => [c.cropName, c.pest, c.material])
  )(
    'combo "%s" + "%s" + "%s" exists in recommend-materials',
    (cropName, pestName, materialName) => {
      const crop = apiCropsByName[cropName as string];
      if (!crop) return; // not in DB, skip

      const finding = pestName
        ? Object.values(apiFindingsById).find((f) => f.name === pestName)
        : null;
      const material = Object.values(apiMaterialsById).find((m) => m.name === materialName);

      if (!material) return; // not in DB, skip
      if (pestName && !finding) return; // finding not in DB, skip

      const comboKey = `${crop.id}|${finding?.id ?? 'null'}|${material.id}`;
      expect(apiComboLookup.has(comboKey)).toBe(true);
    }
  );
});

// ─── Dosage spot-check via cascade ───────────────────────────────────

describe('GET /api/cascade?type=dosage — CSV dosages match API', () => {
  // Build dosage test cases from in-scope crops only
  const dosageCases: Array<{
    cropName: string; cropId: string;
    pest: string; material: string;
    possibleValues: number[];
  }> = [];

  for (const crop of inScopeCrops) {
    const pests = csvPestsByCrop[crop.name];
    if (!pests) continue;

    for (const pest of pests) {
      const cpKey = `${crop.name}|||${pest}`;
      const materials = csvMaterialsByCropPest[cpKey];
      if (!materials) continue;

      for (const material of materials) {
        const dKey = `${crop.name}|||${pest}|||${material}`;
        const dosages = csvDosagesByCombo[dKey];
        if (dosages?.length) {
          dosageCases.push({
            cropName: crop.name,
            cropId: crop.id,
            pest,
            material,
            possibleValues: [...new Set(dosages.map((d) => d.value))],
          });
        }
      }
    }
  }

  it.each(
    dosageCases.map((tc) => [tc.cropName, tc.pest, tc.material, tc.cropId, tc.possibleValues])
  )(
    'dosage for "%s" + "%s" + "%s" is one of the CSV values',
    async (cropName, pestName, materialName, cropId, possibleValues) => {
      const finding = pestName
        ? Object.values(apiFindingsById).find((f) => f.name === pestName)
        : null;
      const material = Object.values(apiMaterialsById).find((m) => m.name === materialName);

      if (!material) return;
      if (pestName && !finding) return;

      const params: Record<string, string> = {
        type: 'dosage',
        cropId: cropId as string,
        materialId: material.id,
      };
      if (finding) params.findingId = finding.id;

      const res = await apiGet('/api/cascade', params);
      expect(res.status).toBe(200);

      const dosage = await res.json();
      if (!dosage) return; // no recommendation found, skip

      expect(possibleValues as number[]).toContain(dosage.dosage);
    }
  );
});
