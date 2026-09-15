import { describe, it, expect } from 'vitest';
import {
  parseBackup,
  parsePlantingDate,
  validateDefaultTaktCount,
} from '@/lib/olive/import-backup';

/**
 * The backup parser is the first thing an uploaded file meets.
 *
 * It matters more since the admin import page exists: a browser upload is a
 * blob of someone else's making, and "looks like a backup but is not" has to
 * fail with a message the operator can act on rather than half-importing.
 */

function html(payload: string): string {
  return [
    '<!doctype html><html><head><title>גיבוי</title></head><body>',
    '<h1>דשבורד המסיק</h1>',
    `<script type="application/json" id="raw-backup-data">${payload}</script>`,
    '<script>console.log("unrelated")</script>',
    '</body></html>',
  ].join('\n');
}

const MINIMAL = { plots: [{ id: 'p-1', name: 'חלקה' }] };

describe('parseBackup', () => {
  it('pulls the payload out of the dashboard HTML', () => {
    const parsed = parseBackup(html(JSON.stringify(MINIMAL)));
    expect(parsed.plots).toHaveLength(1);
    expect(parsed.plots?.[0].name).toBe('חלקה');
  });

  it('accepts a bare .json export, which is the other thing people send', () => {
    const parsed = parseBackup(JSON.stringify(MINIMAL));
    expect(parsed.plots).toHaveLength(1);
  });

  it('ignores other script tags on the page', () => {
    const parsed = parseBackup(
      html(JSON.stringify({ plots: [{ id: 'p-1' }, { id: 'p-2' }], harvestYear: '2026' }))
    );
    expect(parsed.plots).toHaveLength(2);
    expect(parsed.harvestYear).toBe('2026');
  });

  it('keeps the whole payload, not just the plots', () => {
    const parsed = parseBackup(
      html(
        JSON.stringify({
          ...MINIMAL,
          nirTests: [{ id: 'n-1', plotId: 'p-1', takt: '2' }],
          ownYieldData: [{ block: 'מיצר', year: '2003', variety: 'ארבקינה', kg: 1500 }],
          exportedAt: '2026-09-11T21:04:31.451Z',
        })
      )
    );
    expect(parsed.nirTests?.[0].takt).toBe('2');
    expect(parsed.ownYieldData?.[0].kg).toBe(1500);
    expect(parsed.exportedAt).toBe('2026-09-11T21:04:31.451Z');
  });

  // Both threshold blocks travel in the export and they are not interchangeable:
  // `categoryThresholds` is written to plot_category_thresholds, `thresholds`
  // is only compared against parameter_rules and reported. Losing either at the
  // parse step would be silent — the import would just not mention them.
  it('keeps both threshold blocks', () => {
    const parsed = parseBackup(
      html(
        JSON.stringify({
          ...MINIMAL,
          thresholds: { oilLow: 17, oilHigh: 20, dryLow: 38, dryHigh: 50 },
          categoryThresholds: { normalOilMax: 17, normalWaterMax: 60, readyOilMin: 18 },
        })
      )
    );
    expect(parsed.thresholds?.dryLow).toBe(38);
    expect(parsed.categoryThresholds?.normalOilMax).toBe(17);
  });

  it('rejects a file that is not JSON at all', () => {
    expect(() => parseBackup('<html><body>just a web page</body></html>')).toThrow(
      /לא ניתן לקרוא את קובץ הגיבוי/
    );
  });

  it('rejects malformed JSON inside an otherwise correct script tag', () => {
    expect(() => parseBackup(html('{ "plots": [ '))).toThrow(/לא ניתן לקרוא את קובץ הגיבוי/);
  });

  // Valid JSON with no plots is the dangerous case: it parses, so without this
  // check the import would run happily and write nothing, reporting success.
  it('rejects valid JSON that carries no plots array', () => {
    expect(() => parseBackup(JSON.stringify({ nirTests: [] }))).toThrow(/אין מערך חלקות/);
  });

  it('rejects plots that is present but not an array', () => {
    expect(() => parseBackup(JSON.stringify({ plots: 'many' }))).toThrow(/אין מערך חלקות/);
  });

  it('accepts an empty plots array — an export with nothing in it is still a backup', () => {
    expect(parseBackup(JSON.stringify({ plots: [] })).plots).toEqual([]);
  });
});

/**
 * The planting date.
 *
 * '2006/7' is July 2006 — the grower's notation, confirmed against the source
 * file. Reading it as "the 2006/7 season" is what put three מיצר plots on
 * 1 January 2006, half a year from where the file placed them, so the month
 * being kept is the point of every case below.
 */
describe('parsePlantingDate', () => {
  it('reads year/month as a year and a month', () => {
    expect(parsePlantingDate('2006/7')).toEqual({ date: '2006-07-01', precision: 'month' });
    expect(parsePlantingDate('2006/07')).toEqual({ date: '2006-07-01', precision: 'month' });
    expect(parsePlantingDate('2006/12')).toEqual({ date: '2006-12-01', precision: 'month' });
  });

  it('takes the four-digit part as the year, whichever side it sits on', () => {
    expect(parsePlantingDate('7/2006')).toEqual({ date: '2006-07-01', precision: 'month' });
    expect(parsePlantingDate('07/2006')).toEqual({ date: '2006-07-01', precision: 'month' });
  });

  it('accepts - and . as separators, which is how the same field gets typed', () => {
    expect(parsePlantingDate('2006-7')).toEqual({ date: '2006-07-01', precision: 'month' });
    expect(parsePlantingDate('2006.7')).toEqual({ date: '2006-07-01', precision: 'month' });
  });

  it('keeps the day when the file records one', () => {
    expect(parsePlantingDate('15/7/2006')).toEqual({ date: '2006-07-15', precision: 'day' });
    expect(parsePlantingDate('2006-07-15')).toEqual({ date: '2006-07-15', precision: 'day' });
  });

  // The common case, and the one the flags stay quiet about: nothing was lost,
  // because nothing beyond the year was ever written down.
  it('places a bare year on 1 January and says so', () => {
    expect(parsePlantingDate('2003')).toEqual({ date: '2003-01-01', precision: 'year' });
  });

  // Falling back to the year beats dropping the plot's date entirely.
  it('falls back to the year when the second part is not a month', () => {
    expect(parsePlantingDate('2006/13')).toEqual({ date: '2006-01-01', precision: 'year' });
    expect(parsePlantingDate('2006/0')).toEqual({ date: '2006-01-01', precision: 'year' });
  });

  it('rejects a day that does not exist rather than rolling it into next month', () => {
    expect(parsePlantingDate('31/9/2006')).toEqual({ date: '2006-01-01', precision: 'year' });
    expect(parsePlantingDate('29/2/2007')).toEqual({ date: '2007-01-01', precision: 'year' });
    expect(parsePlantingDate('29/2/2008')).toEqual({ date: '2008-02-29', precision: 'day' });
  });

  it('finds a year inside free text, which is what the field really holds', () => {
    expect(parsePlantingDate('נטע 2006')).toEqual({ date: '2006-01-01', precision: 'year' });
  });

  it('returns nothing for a value with no year in it', () => {
    expect(parsePlantingDate('לא ידוע')).toEqual({ date: null, precision: 'none' });
    expect(parsePlantingDate('')).toEqual({ date: null, precision: 'none' });
    expect(parsePlantingDate(undefined)).toEqual({ date: null, precision: 'none' });
  });
});

/**
 * The operator-supplied takt count.
 *
 * The prototype seeds every plot with `taktCount: ''` and asks the user to fill
 * it in later; on the real גשור export nobody did, so this is the only way
 * those plots get takts at all. It throws rather than flags because a bad value
 * is a mistyped form field, not dirty data in someone's export.
 */
describe('validateDefaultTaktCount', () => {
  it('treats null and undefined as "not supplied"', () => {
    expect(validateDefaultTaktCount(null)).toBeNull();
    expect(validateDefaultTaktCount(undefined)).toBeNull();
  });

  it('accepts the range the prototype dropdown and the DB CHECK both allow', () => {
    // olive_plot_details_takt_count_check is BETWEEN 1 AND 10, and the
    // prototype's own <select> offers exactly 1..10.
    for (const n of [1, 2, 3, 5, 10]) {
      expect(validateDefaultTaktCount(n)).toBe(n);
    }
  });

  it('rejects values the DB CHECK would reject, before any row is written', () => {
    for (const n of [0, -1, 11, 99]) {
      expect(() => validateDefaultTaktCount(n)).toThrow(/בין 1 ל-10/);
    }
  });

  it('rejects a fraction — takts are whole subdivisions', () => {
    expect(() => validateDefaultTaktCount(2.5)).toThrow(/מספר שלם/);
  });

  it('rejects NaN, which is what Number("") and Number("abc") produce', () => {
    expect(() => validateDefaultTaktCount(Number('abc'))).toThrow(/בין 1 ל-10/);
  });
});
