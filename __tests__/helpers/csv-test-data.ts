/**
 * Reads the test CSV fixture and builds in-memory database tables
 * matching the structure that the pesticide registry import would create.
 */

import fs from 'fs';
import path from 'path';
import { parseCsvContent, parseDosage } from '@/lib/pesticide-registry';

// Deterministic UUIDs for test data
export const IDS = {
  // Crops
  TOMATO: 'crop-tomato-0001-0001-000000000001',
  APPLE: 'crop-apple-0002-0002-000000000002',
  // Child crop (no CSV rows, used for fallback tests)
  GREEN_APPLE: 'crop-gapple-0003-0003-000000000003',

  // Findings (pests)
  APHID: 'find-aphid-0001-0001-000000000001',
  WHITEFLY: 'find-wfly-0002-0002-000000000002',
  ALTERNARIA: 'find-alter-0003-0003-000000000003',
  CODLING_MOTH: 'find-cmoth-0004-0004-000000000004',
  APPLE_SCAB: 'find-scab-0005-0005-000000000005',
  PERENNIAL_WEEDS: 'find-weeds-0006-0006-000000000006',

  // Materials
  ACTARA: 'mat-actar-0001-0001-000000000001',
  NATIVO: 'mat-nativ-0002-0002-000000000002',
  CONFIDOR: 'mat-confi-0003-0003-000000000003',
  SCORE: 'mat-score-0004-0004-000000000004',
  ROUNDUP: 'mat-round-0005-0005-000000000005',

  // Unit types
  ML_PER_100L: 'unit-ml100-0001-0001-000000000001',
  GRAM_PER_DUNAM: 'unit-grdn-0002-0002-000000000002',
  LITER_PER_DUNAM: 'unit-ltdn-0003-0003-000000000003',

  // Action types
  SPRAY: 'atyp-spray-0001-0001-000000000001',
} as const;

// Map CSV material_name → material ID
const MATERIAL_MAP: Record<string, string> = {
  'אקטרה': IDS.ACTARA,
  'נטיבו': IDS.NATIVO,
  'קונפידור': IDS.CONFIDOR,
  'סקור': IDS.SCORE,
  'ראונדאפ': IDS.ROUNDUP,
};

// Map CSV pest_name → finding ID
const FINDING_MAP: Record<string, string> = {
  'כנימת עלה': IDS.APHID,
  'זבוב לבן': IDS.WHITEFLY,
  'אלטרנריה': IDS.ALTERNARIA,
  'עש התפוח': IDS.CODLING_MOTH,
  'גלד התפוח': IDS.APPLE_SCAB,
  'עשבים רב-שנתיים': IDS.PERENNIAL_WEEDS,
};

// Map CSV crop_name → crop ID
const CROP_MAP: Record<string, string> = {
  'עגבנייה': IDS.TOMATO,
  'תפוח': IDS.APPLE,
};

// Map unit_name → unit_type ID
const UNIT_MAP: Record<string, string> = {
  'מ"ל/100 ליטר מים': IDS.ML_PER_100L,
  'גרם/דונם': IDS.GRAM_PER_DUNAM,
  'ליטר/דונם': IDS.LITER_PER_DUNAM,
};

/**
 * Load a CSV fixture file.
 * @param csvPath - Optional absolute path to a CSV file. Defaults to __tests__/fixtures/test-registry.csv.
 *                  Can also be set via TEST_CSV_PATH environment variable.
 */
export function loadCsvFixture(csvPath?: string): string {
  const filePath = csvPath || process.env.TEST_CSV_PATH ||
    path.join(__dirname, '..', 'fixtures', 'test-registry.csv');
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildTestTables() {
  const csvContent = loadCsvFixture();
  const rows = parseCsvContent(csvContent);

  // Build crops table
  const crops = [
    { id: IDS.TOMATO, name: 'עגבנייה', parent_crop_id: null, source: 'registry' },
    { id: IDS.APPLE, name: 'תפוח', parent_crop_id: null, source: 'registry' },
    { id: IDS.GREEN_APPLE, name: 'תפוח ירוק', parent_crop_id: IDS.APPLE, source: 'custom' },
  ];

  // Build findings table
  const findings = [
    { id: IDS.APHID, name: 'כנימת עלה', source: 'registry' },
    { id: IDS.WHITEFLY, name: 'זבוב לבן', source: 'registry' },
    { id: IDS.ALTERNARIA, name: 'אלטרנריה', source: 'registry' },
    { id: IDS.CODLING_MOTH, name: 'עש התפוח', source: 'registry' },
    { id: IDS.APPLE_SCAB, name: 'גלד התפוח', source: 'registry' },
    { id: IDS.PERENNIAL_WEEDS, name: 'עשבים רב-שנתיים', source: 'registry' },
  ];

  // Build materials table
  const materials = [
    { id: IDS.ACTARA, name: 'אקטרה', active_ingredient: 'תיאמתוקסם', source: 'registry' },
    { id: IDS.NATIVO, name: 'נטיבו', active_ingredient: 'טריפלוקסיסטרובין', source: 'registry' },
    { id: IDS.CONFIDOR, name: 'קונפידור', active_ingredient: 'אימידקלופריד', source: 'registry' },
    { id: IDS.SCORE, name: 'סקור', active_ingredient: 'דיפנוקונזול', source: 'registry' },
    { id: IDS.ROUNDUP, name: 'ראונדאפ', active_ingredient: 'גליפוסט', source: 'registry' },
  ];

  // Build unit_types table
  const unit_types = [
    { id: IDS.ML_PER_100L, name: 'מ"ל/100 ליטר מים', source: 'registry' },
    { id: IDS.GRAM_PER_DUNAM, name: 'גרם/דונם', source: 'registry' },
    { id: IDS.LITER_PER_DUNAM, name: 'ליטר/דונם', source: 'registry' },
  ];

  // Build crop_findings junction table
  const cropFindingsSet = new Set<string>();
  const crop_findings: Array<{ crop_id: string; finding_id: string }> = [];
  for (const row of rows) {
    const cropId = CROP_MAP[row.crop_name];
    const findingId = FINDING_MAP[row.pest_name];
    if (cropId && findingId) {
      const key = `${cropId}:${findingId}`;
      if (!cropFindingsSet.has(key)) {
        cropFindingsSet.add(key);
        crop_findings.push({ crop_id: cropId, finding_id: findingId });
      }
    }
  }

  // Build recommend_material table
  const recommend_material: any[] = [];
  for (const row of rows) {
    const cropId = CROP_MAP[row.crop_name];
    const findingId = FINDING_MAP[row.pest_name] || null;
    const materialId = MATERIAL_MAP[row.material_name];
    if (!cropId || !materialId) continue;

    const dosage = parseDosage(row.dosage_text || '');
    const unitTypeId = dosage.unit_name ? UNIT_MAP[dosage.unit_name] || null : null;

    recommend_material.push({
      crop_id: cropId,
      finding_id: findingId,
      material_id: materialId,
      action_type_id: IDS.SPRAY,
      dosage: dosage.value,
      unit_type_id: unitTypeId,
      source: 'registry',
    });
  }

  return {
    crops,
    findings,
    materials,
    unit_types,
    crop_findings,
    recommend_material,
  };
}
