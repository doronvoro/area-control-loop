import { describe, it, expect, beforeAll } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  getCascadeFindings,
  getCascadeMaterials,
  getCascadeDosage,
} from '@/lib/services/cascade.service';
import { createMockSupabase } from '../helpers/mock-supabase';
import { buildTestTables, IDS } from '../helpers/csv-test-data';

/**
 * Tests for the cascade service which powers:
 *   GET /api/cascade?type=findings&cropId=...
 *   GET /api/cascade?type=materials&cropId=...&findingId=...&actionTypeId=...
 *   GET /api/cascade?type=dosage&cropId=...&materialId=...
 *
 * Test data is built from the CSV fixture (__tests__/fixtures/test-registry.csv)
 * matching the real pesticide registry import flow.
 */

let tables: ReturnType<typeof buildTestTables>;
let supabase: ReturnType<typeof createMockSupabase>;

beforeAll(() => {
  tables = buildTestTables();
  supabase = createMockSupabase(tables);
});

// ─── getCascadeFindings ──────────────────────────────────────────────

describe('getCascadeFindings', () => {
  it('returns findings for a crop with direct crop_findings entries', async () => {
    // Tomato has: כנימת עלה, זבוב לבן, אלטרנריה, עשבים רב-שנתיים (from CSV)
    const findings = await getCascadeFindings(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
    });

    expect(findings.length).toBeGreaterThanOrEqual(3);
    const names = findings.map((f: any) => f.name);
    expect(names).toContain('כנימת עלה');
    expect(names).toContain('זבוב לבן');
    expect(names).toContain('אלטרנריה');
  });

  it('returns findings for apple crop', async () => {
    // Apple has: כנימת עלה, עש התפוח, גלד התפוח (from CSV)
    const findings = await getCascadeFindings(supabase as unknown as SupabaseClient, {
      cropId: IDS.APPLE,
    });

    expect(findings.length).toBeGreaterThanOrEqual(2);
    const names = findings.map((f: any) => f.name);
    expect(names).toContain('כנימת עלה');
    expect(names).toContain('עש התפוח');
    expect(names).toContain('גלד התפוח');
  });

  it('falls back to parent crop findings when child has none', async () => {
    // GREEN_APPLE has no crop_findings, but parent (APPLE) does
    const findings = await getCascadeFindings(supabase as unknown as SupabaseClient, {
      cropId: IDS.GREEN_APPLE,
    });

    expect(findings.length).toBeGreaterThanOrEqual(2);
    const names = findings.map((f: any) => f.name);
    expect(names).toContain('כנימת עלה');
    expect(names).toContain('עש התפוח');
  });

  it('returns empty array for crop with no findings and no parent', async () => {
    // Use a non-existent crop ID
    const mockEmpty = createMockSupabase({
      ...tables,
      crop_findings: [],
      crops: [{ id: 'orphan-crop', name: 'test', parent_crop_id: null }],
    });

    const findings = await getCascadeFindings(mockEmpty as unknown as SupabaseClient, {
      cropId: 'orphan-crop',
    });

    expect(findings).toEqual([]);
  });
});

// ─── getCascadeMaterials ─────────────────────────────────────────────

describe('getCascadeMaterials', () => {
  it('returns materials for crop + finding', async () => {
    // Tomato + Aphid → Actara (from CSV row 1)
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
    });

    expect(materials.length).toBeGreaterThanOrEqual(1);
    const names = materials.map((m: any) => m.name);
    expect(names).toContain('אקטרה');
  });

  it('returns materials with recommended_dosage attached', async () => {
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
    });

    const actara = materials.find((m: any) => m.name === 'אקטרה');
    expect(actara).toBeDefined();
    expect(actara.recommended_dosage).toBe(100); // 100 מ"ל/100 ליטר מים
    expect(actara.recommended_unit_type).toBe('מ"ל/100 ליטר מים');
  });

  it('returns materials for apple + codling moth', async () => {
    // Apple + Codling Moth → Confidor (from CSV row 5)
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.APPLE,
      findingId: IDS.CODLING_MOTH,
      actionTypeId: IDS.SPRAY,
    });

    const names = materials.map((m: any) => m.name);
    expect(names).toContain('קונפידור');
  });

  it('deduplicates materials by material_id', async () => {
    // Apple + Aphid → Confidor appears once even if multiple recommend_material rows
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.APPLE,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
    });

    const confidorEntries = materials.filter((m: any) => m.name === 'קונפידור');
    expect(confidorEntries.length).toBeLessThanOrEqual(1);
  });

  it('falls back to parent crop materials for child crop', async () => {
    // GREEN_APPLE → parent APPLE → should get Apple's materials
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.GREEN_APPLE,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
    });

    expect(materials.length).toBeGreaterThanOrEqual(1);
    const names = materials.map((m: any) => m.name);
    expect(names).toContain('קונפידור');
  });

  it('falls back to all materials when no recommendations exist', async () => {
    // Use a crop with no recommendations and no parent
    const mockEmpty = createMockSupabase({
      ...tables,
      recommend_material: [],
      crops: [{ id: 'empty-crop', name: 'test', parent_crop_id: null }],
    });

    const materials = await getCascadeMaterials(mockEmpty as unknown as SupabaseClient, {
      cropId: 'empty-crop',
    });

    // Should return all materials from the materials table
    expect(materials.length).toBe(tables.materials.length);
  });

  it('works without findingId and actionTypeId', async () => {
    // Query with just cropId — should find any recommend_material with finding_id IS NULL
    // or fall back
    const materials = await getCascadeMaterials(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
    });

    // Should return something (either filtered or all materials fallback)
    expect(materials.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── getCascadeDosage ────────────────────────────────────────────────

describe('getCascadeDosage', () => {
  it('returns dosage for exact match (crop + finding + actionType + material)', async () => {
    // Tomato + Alternaria + spray + Nativo → 200 גרם/דונם
    const dosage = await getCascadeDosage(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
      findingId: IDS.ALTERNARIA,
      actionTypeId: IDS.SPRAY,
      materialId: IDS.NATIVO,
    });

    expect(dosage).not.toBeNull();
    expect(dosage!.dosage).toBe(200);
    expect(dosage!.unit_type_id).toBe(IDS.GRAM_PER_DUNAM);
  });

  it('returns dosage with unit_type join data', async () => {
    const dosage = await getCascadeDosage(supabase as unknown as SupabaseClient, {
      cropId: IDS.TOMATO,
      findingId: IDS.ALTERNARIA,
      actionTypeId: IDS.SPRAY,
      materialId: IDS.NATIVO,
    });

    expect(dosage).not.toBeNull();
    expect(dosage!.unit_type).toBeDefined();
    expect(dosage!.unit_type.name).toBe('גרם/דונם');
  });

  it('returns dosage for apple + aphid + confidor (range value takes first number)', async () => {
    // CSV: 50-100 מ"ל/100 ליטר מים → value = 50
    const dosage = await getCascadeDosage(supabase as unknown as SupabaseClient, {
      cropId: IDS.APPLE,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
      materialId: IDS.CONFIDOR,
    });

    expect(dosage).not.toBeNull();
    expect(dosage!.dosage).toBe(50);
    expect(dosage!.unit_type_id).toBe(IDS.ML_PER_100L);
  });

  it('falls back to parent crop dosage for child crop', async () => {
    // GREEN_APPLE → parent APPLE → Confidor dosage
    const dosage = await getCascadeDosage(supabase as unknown as SupabaseClient, {
      cropId: IDS.GREEN_APPLE,
      findingId: IDS.APHID,
      actionTypeId: IDS.SPRAY,
      materialId: IDS.CONFIDOR,
    });

    expect(dosage).not.toBeNull();
    expect(dosage!.dosage).toBe(50);
  });

  it('returns null when no match exists anywhere', async () => {
    const mockEmpty = createMockSupabase({
      ...tables,
      recommend_material: [],
      crops: [{ id: 'no-match-crop', name: 'test', parent_crop_id: null }],
    });

    const dosage = await getCascadeDosage(mockEmpty as unknown as SupabaseClient, {
      cropId: 'no-match-crop',
      materialId: IDS.ACTARA,
    });

    expect(dosage).toBeNull();
  });

  it('returns dosage for liter/dunam unit (score on apple)', async () => {
    // CSV: 0.5 ליטר/דונם
    const dosage = await getCascadeDosage(supabase as unknown as SupabaseClient, {
      cropId: IDS.APPLE,
      findingId: IDS.APPLE_SCAB,
      actionTypeId: IDS.SPRAY,
      materialId: IDS.SCORE,
    });

    expect(dosage).not.toBeNull();
    expect(dosage!.dosage).toBe(0.5);
    expect(dosage!.unit_type_id).toBe(IDS.LITER_PER_DUNAM);
  });
});
