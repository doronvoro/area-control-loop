/**
 * Shared parsing and import logic for the pesticide registry CSV
 * Used by both the CLI script and API routes
 */

import { parse } from 'csv-parse/sync';

// Hebrew CSV column headers → English field names
export const HEADER_MAP: Record<string, string> = {
  'מספר רשיון': 'license_number',
  'סוג תכשיר': 'product_type',
  'שם תכשיר': 'material_name',
  'שם תכשיר אנגלי': 'material_name_en',
  'סוג פעילות': 'activity_type',
  'סוג פעילות אנגלי': 'activity_type_en',
  "מספר או'ם": 'un_number',
  'חומר פעיל': 'active_ingredient',
  'CAS.NO': 'cas_number',
  'קבוצת עמידות': 'resistance_group',
  'טרגט קוד': 'target_code',
  'ריכוז חומר פעיל': 'concentration',
  'ריכוש חומר פעיל אנגלי': 'concentration_en',
  'פורמולציה': 'formulation',
  'פורמולציה אנגלי': 'formulation_en',
  'בעל רשיון': 'license_holder',
  'בעל רשיון אנגלי': 'license_holder_en',
  'יצרן פורמולציה': 'manufacturer',
  'יצרן פורמולציה אנגלי': 'manufacturer_en',
  'רעילות': 'toxicity_info',
  'רעילות אנגלי': 'toxicity_info_en',
  'דרגת רעילות': 'toxicity_level',
  'דרגת רעילות אנגלי': 'toxicity_level_en',
  'תווית': 'label_url',
  'קבוצת גידולים': 'crop_group',
  'קבוצת גידולים אנגלי': 'crop_group_en',
  'גידול': 'crop_name',
  'גידול אנגלי': 'crop_name_en',
  'תאריך אישור וועדה': 'approval_date',
  'קבוצת נגעים': 'pest_group',
  'קבוצת נגעים אנגלי': 'pest_group_en',
  'קבוצת נגעים לטיני': 'pest_group_latin',
  'נגע': 'pest_name',
  'נגע אנגלי': 'pest_name_en',
  'נגע לטיני': 'pest_latin',
  'מינון ליישום': 'dosage_text',
  'נפח ליישום': 'volume_text',
  'כניסה מחדש': 'reentry_period',
  'תקופת המתנה': 'waiting_period',
  'שלב גידול': 'crop_stage',
  'גיל גידול': 'crop_age',
  'שלב עשב': 'weed_stage',
  'גיל עשב': 'weed_age',
  'אופי הפעלה': 'operation_type',
  'הערה גידול': 'crop_notes',
  'סוג קרקע': 'soil_type',
};

// Dosage unit patterns for parsing
export const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string }> = [
  { pattern: /מ"ל\/100 ליטר מים/, unit: 'מ"ל/100 ליטר מים' },
  { pattern: /גרם\/100 ליטר מים/, unit: 'גרם/100 ליטר מים' },
  { pattern: /סמ"ק\/100 ליטר מים/, unit: 'סמ"ק/100 ליטר מים' },
  { pattern: /ליטר\/דונם/, unit: 'ליטר/דונם' },
  { pattern: /ליטר\/עץ/, unit: 'ליטר/עץ' },
  { pattern: /גרם\/דונם/, unit: 'גרם/דונם' },
  { pattern: /גרם\/עץ/, unit: 'גרם/עץ' },
  { pattern: /קילו\/דונם/, unit: 'קילו/דונם' },
  { pattern: /קג\/דונם/, unit: 'קג/דונם' },
  { pattern: /מ"ל\/דונם/, unit: 'מ"ל/דונם' },
  { pattern: /סמ"ק\/דונם/, unit: 'סמ"ק/דונם' },
  { pattern: /סמק\/100 ליטר מים/, unit: 'סמ"ק/100 ליטר מים' },
  { pattern: /סמק\/דונם/, unit: 'סמ"ק/דונם' },
  { pattern: /ליטר/, unit: 'ליטר' },
  { pattern: /גרם/, unit: 'גרם' },
  { pattern: /קג/, unit: 'קג' },
  { pattern: /סמק/, unit: 'סמ"ק' },
  { pattern: /אחוז/, unit: 'אחוז' },
  { pattern: /%/, unit: 'אחוז' },
  { pattern: /יחידות/, unit: 'יחידות' },
  { pattern: /טון/, unit: 'טון' },
];

export interface ParsedDosage {
  value: number | null;
  unit_name: string | null;
  raw_text: string;
}

export interface CsvRow {
  [key: string]: string;
}

export function parseDosage(text: string): ParsedDosage {
  const raw_text = text.trim();
  if (!raw_text) return { value: null, unit_name: null, raw_text };

  const rangeMatch = raw_text.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  const singleMatch = raw_text.match(/(\d+\.?\d*)/);

  let value: number | null = null;
  if (rangeMatch) {
    value = parseFloat(rangeMatch[1]);
  } else if (singleMatch) {
    value = parseFloat(singleMatch[1]);
  }

  let unit_name: string | null = null;
  for (const { pattern, unit } of UNIT_PATTERNS) {
    if (pattern.test(raw_text)) {
      unit_name = unit;
      break;
    }
  }

  // Unit without a number: default to 1
  if (value === null && (unit_name === 'אחוז' || unit_name === 'ליטר/דונם')) {
    value = 1;
  }

  return { value, unit_name, raw_text };
}

export function mapRow(raw: Record<string, string>): CsvRow {
  const mapped: CsvRow = {};
  for (const [hebrewKey, value] of Object.entries(raw)) {
    const englishKey = HEADER_MAP[hebrewKey.trim()];
    if (englishKey) {
      mapped[englishKey] = value?.trim() || '';
    }
  }
  return mapped;
}

export function parseCsvContent(content: string): CsvRow[] {
  const rawRecords: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
  return rawRecords.map(mapRow);
}

export interface CropInfo {
  name: string;
  nameEn: string;
  rowCount: number;
}

export function extractCropList(rows: CsvRow[]): CropInfo[] {
  const cropCounts = new Map<string, { nameEn: string; count: number }>();

  for (const row of rows) {
    if (!row.crop_name) continue;
    const existing = cropCounts.get(row.crop_name);
    if (existing) {
      existing.count++;
    } else {
      cropCounts.set(row.crop_name, {
        nameEn: row.crop_name_en || '',
        count: 1,
      });
    }
  }

  return Array.from(cropCounts.entries())
    .map(([name, { nameEn, count }]) => ({ name, nameEn, rowCount: count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export function filterRowsByCrops(rows: CsvRow[], crops: string[]): CsvRow[] {
  const cropsSet = new Set(crops);
  return rows.filter((r) => cropsSet.has(r.crop_name));
}

export function buildRegistryRow(row: CsvRow, batchId: string, csvRowNumber: number) {
  return {
    crop_name: row.crop_name,
    crop_name_en: row.crop_name_en || null,
    pest_name: row.pest_name || null,
    pest_name_en: row.pest_name_en || null,
    material_name: row.material_name,
    material_name_en: row.material_name_en || null,
    activity_type: row.activity_type || null,
    activity_type_en: row.activity_type_en || null,
    dosage_text: row.dosage_text || null,
    volume_text: row.volume_text || null,
    license_number: row.license_number || null,
    active_ingredient: row.active_ingredient || null,
    cas_number: row.cas_number || null,
    resistance_group: row.resistance_group || null,
    target_code: row.target_code || null,
    concentration: row.concentration || null,
    concentration_en: row.concentration_en || null,
    formulation: row.formulation || null,
    formulation_en: row.formulation_en || null,
    toxicity_info: row.toxicity_info || null,
    toxicity_info_en: row.toxicity_info_en || null,
    toxicity_level: row.toxicity_level || null,
    toxicity_level_en: row.toxicity_level_en || null,
    license_holder: row.license_holder || null,
    license_holder_en: row.license_holder_en || null,
    manufacturer: row.manufacturer || null,
    manufacturer_en: row.manufacturer_en || null,
    label_url: row.label_url || null,
    crop_group: row.crop_group || null,
    crop_group_en: row.crop_group_en || null,
    pest_group: row.pest_group || null,
    pest_group_en: row.pest_group_en || null,
    pest_latin: row.pest_latin || null,
    approval_date: row.approval_date || null,
    waiting_period: row.waiting_period || null,
    reentry_period: row.reentry_period || null,
    crop_stage: row.crop_stage || null,
    crop_age: row.crop_age || null,
    weed_stage: row.weed_stage || null,
    weed_age: row.weed_age || null,
    operation_type: row.operation_type || null,
    crop_notes: row.crop_notes || null,
    soil_type: row.soil_type || null,
    import_batch_id: batchId,
    csv_row_number: csvRowNumber,
  };
}
