import { describe, it, expect } from 'vitest';
import {
  parseDosage,
  mapRow,
  parseCsvContent,
  extractCropList,
  filterRowsByCrops,
  buildRegistryRow,
} from '@/lib/pesticide-registry';
import { loadCsvFixture } from '../helpers/csv-test-data';

/**
 * Tests for the pure CSV parsing functions used by the pesticide registry import.
 * These functions are the foundation of the data that feeds into the cascade API.
 */

// ─── parseDosage ─────────────────────────────────────────────────────

describe('parseDosage', () => {
  it('parses ml/100L unit', () => {
    const result = parseDosage('100 מ"ל/100 ליטר מים');
    expect(result.value).toBe(100);
    expect(result.unit_name).toBe('מ"ל/100 ליטר מים');
  });

  it('parses range value (takes first number)', () => {
    const result = parseDosage('50-100 מ"ל/100 ליטר מים');
    expect(result.value).toBe(50);
    expect(result.unit_name).toBe('מ"ל/100 ליטר מים');
  });

  it('parses gram/dunam unit', () => {
    const result = parseDosage('200 גרם/דונם');
    expect(result.value).toBe(200);
    expect(result.unit_name).toBe('גרם/דונם');
  });

  it('parses liter/dunam unit', () => {
    const result = parseDosage('0.5 ליטר/דונם');
    expect(result.value).toBe(0.5);
    expect(result.unit_name).toBe('ליטר/דונם');
  });

  it('parses liter/dunam whole number', () => {
    const result = parseDosage('2 ליטר/דונם');
    expect(result.value).toBe(2);
    expect(result.unit_name).toBe('ליטר/דונם');
  });

  it('returns null value and unit for empty string', () => {
    const result = parseDosage('');
    expect(result.value).toBeNull();
    expect(result.unit_name).toBeNull();
    expect(result.raw_text).toBe('');
  });

  it('defaults value to 1 for percent unit without number', () => {
    const result = parseDosage('אחוז');
    expect(result.value).toBe(1);
    expect(result.unit_name).toBe('אחוז');
  });

  it('defaults value to 1 for liter/dunam without number', () => {
    const result = parseDosage('ליטר/דונם');
    expect(result.value).toBe(1);
    expect(result.unit_name).toBe('ליטר/דונם');
  });

  it('parses % as אחוז', () => {
    const result = parseDosage('5%');
    expect(result.value).toBe(5);
    expect(result.unit_name).toBe('אחוז');
  });

  it('parses kg/dunam unit', () => {
    const result = parseDosage('3 קג/דונם');
    expect(result.value).toBe(3);
    expect(result.unit_name).toBe('קג/דונם');
  });

  it('extracts number but no unit for unrecognized text', () => {
    const result = parseDosage('5 unknown');
    expect(result.value).toBe(5);
    expect(result.unit_name).toBeNull();
  });

  it('preserves raw_text', () => {
    const result = parseDosage('  100 מ"ל/100 ליטר מים  ');
    expect(result.raw_text).toBe('100 מ"ל/100 ליטר מים');
  });
});

// ─── mapRow ──────────────────────────────────────────────────────────

describe('mapRow', () => {
  it('maps Hebrew headers to English field names', () => {
    const raw = {
      'גידול': 'עגבנייה',
      'נגע': 'כנימת עלה',
      'שם תכשיר': 'אקטרה',
      'מינון ליישום': '100 מ"ל/100 ליטר מים',
    };
    const mapped = mapRow(raw);
    expect(mapped.crop_name).toBe('עגבנייה');
    expect(mapped.pest_name).toBe('כנימת עלה');
    expect(mapped.material_name).toBe('אקטרה');
    expect(mapped.dosage_text).toBe('100 מ"ל/100 ליטר מים');
  });

  it('ignores unknown headers', () => {
    const raw = {
      'גידול': 'עגבנייה',
      'unknown_column': 'some value',
    };
    const mapped = mapRow(raw);
    expect(mapped.crop_name).toBe('עגבנייה');
    expect(mapped['unknown_column']).toBeUndefined();
  });

  it('trims values', () => {
    const raw = { 'גידול': '  עגבנייה  ' };
    const mapped = mapRow(raw);
    expect(mapped.crop_name).toBe('עגבנייה');
  });

  it('converts empty values to empty string', () => {
    const raw = { 'גידול': '' };
    const mapped = mapRow(raw);
    expect(mapped.crop_name).toBe('');
  });
});

// ─── parseCsvContent ─────────────────────────────────────────────────

describe('parseCsvContent', () => {
  it('parses the fixture CSV correctly', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);

    expect(rows.length).toBe(7); // 7 data rows in fixture
  });

  it('maps all fields for first row', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    const first = rows[0];

    expect(first.crop_name).toBe('עגבנייה');
    expect(first.pest_name).toBe('כנימת עלה');
    expect(first.material_name).toBe('אקטרה');
    expect(first.dosage_text).toBe('100 מ"ל/100 ליטר מים');
    expect(first.active_ingredient).toBe('תיאמתוקסם');
    expect(first.license_number).toBe('1001');
  });

  it('handles the range dosage in row 4', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    // Row 4 (index 3): Confidor on Apple, 50-100 מ"ל/100 ליטר מים
    expect(rows[3].dosage_text).toBe('50-100 מ"ל/100 ליטר מים');
  });
});

// ─── extractCropList ─────────────────────────────────────────────────

describe('extractCropList', () => {
  it('returns unique crops with row counts', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    const crops = extractCropList(rows);

    // Fixture has 2 crops: עגבנייה (4 rows) and תפוח (3 rows)
    expect(crops.length).toBe(2);

    const tomato = crops.find((c) => c.name === 'עגבנייה');
    expect(tomato).toBeDefined();
    expect(tomato!.rowCount).toBe(4);
    expect(tomato!.nameEn).toBe('Tomato');

    const apple = crops.find((c) => c.name === 'תפוח');
    expect(apple).toBeDefined();
    expect(apple!.rowCount).toBe(3);
    expect(apple!.nameEn).toBe('Apple');
  });

  it('sorts by Hebrew locale', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    const crops = extractCropList(rows);

    // Verify sorted order
    for (let i = 1; i < crops.length; i++) {
      expect(crops[i - 1].name.localeCompare(crops[i].name, 'he')).toBeLessThanOrEqual(0);
    }
  });
});

// ─── filterRowsByCrops ───────────────────────────────────────────────

describe('filterRowsByCrops', () => {
  it('filters to selected crops only', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);

    const tomatoRows = filterRowsByCrops(rows, ['עגבנייה']);
    expect(tomatoRows.length).toBe(4);
    expect(tomatoRows.every((r) => r.crop_name === 'עגבנייה')).toBe(true);
  });

  it('filters multiple crops', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);

    const filtered = filterRowsByCrops(rows, ['עגבנייה', 'תפוח']);
    expect(filtered.length).toBe(7); // all rows
  });

  it('returns empty array for non-existent crop', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);

    const filtered = filterRowsByCrops(rows, ['אבוקדו']);
    expect(filtered.length).toBe(0);
  });
});

// ─── buildRegistryRow ────────────────────────────────────────────────

describe('buildRegistryRow', () => {
  it('maps all fields and sets batch metadata', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    const batchId = 'test-batch-001';

    const result = buildRegistryRow(rows[0], batchId, 1);

    expect(result.crop_name).toBe('עגבנייה');
    expect(result.pest_name).toBe('כנימת עלה');
    expect(result.material_name).toBe('אקטרה');
    expect(result.dosage_text).toBe('100 מ"ל/100 ליטר מים');
    expect(result.import_batch_id).toBe(batchId);
    expect(result.csv_row_number).toBe(1);
    expect(result.active_ingredient).toBe('תיאמתוקסם');
    expect(result.license_number).toBe('1001');
  });

  it('sets null for missing optional fields', () => {
    const content = loadCsvFixture();
    const rows = parseCsvContent(content);
    const result = buildRegistryRow(rows[0], 'batch', 0);

    // These fields are empty in the CSV fixture
    expect(result.soil_type).toBeNull();
    expect(result.crop_stage).toBeNull();
    expect(result.weed_stage).toBeNull();
  });
});
