import { describe, it, expect } from 'vitest';
import {
  parseCategoryThresholds,
  parseAlertBounds,
  parseThresholdForm,
  validateThresholdForm,
  warnCategoryThresholds,
  readAlertBounds,
  applyAlertBounds,
  toCategoryColumns,
  toAlertUpdates,
  categoryToForm,
  alertToForm,
  CATEGORY_BAND_FIELDS,
  ALERT_BAND_FIELDS,
  DEFAULT_ALERT_BOUNDS,
  type ParseResult,
} from '@/lib/olive/thresholds';
import { DEFAULT_CATEGORY_THRESHOLDS } from '@/lib/olive/constants';
import { evaluateParameter } from '@/lib/olive/logic';
import { ParameterStatus, type ParameterRule } from '@/types/database';

/**
 * These cover the settings dialog AND both API routes at once — that is the
 * whole reason the validation is a pure module. If a rule here is wrong, the
 * form and the server are wrong together, which is at least consistent; if this
 * module is bypassed, they drift apart silently.
 */

// ─── fixtures ────────────────────────────────────────────────────────────────

let ruleSeq = 0;
function rule(
  parameter_code: string,
  upper_bound: number | null,
  upper_inclusive: boolean,
  status: ParameterStatus,
  severity: number,
  message: string,
  sort_order: number
): ParameterRule {
  return {
    id: `r${++ruleSeq}`,
    parameter_code,
    upper_bound,
    upper_inclusive,
    status,
    severity,
    message,
    sort_order,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

/** Mirrors the seed in 20260908100000_create_olive_parameters.sql exactly. */
const RULES: ParameterRule[] = [
  rule('oil', 17, false, ParameterStatus.IDLE, 0, 'לא מוכן למסיק', 1),
  rule('oil', 20, true, ParameterStatus.PLAN, 2, 'תוכנן למסיק', 2),
  rule('oil', null, true, ParameterStatus.URGENT, 3, 'מסיק מיידי', 3),

  rule('water', 50, false, ParameterStatus.URGENT, 3, 'עקת מים', 1),
  rule('water', 54, true, ParameterStatus.OK, 1, 'אופטימום', 2),
  rule('water', 60, true, ParameterStatus.PLAN, 2, 'צמצום השקיה', 3),
  rule('water', null, true, ParameterStatus.URGENT, 3, 'סגירת מים מיידית', 4),

  rule('dry', 40, false, ParameterStatus.IDLE, 0, '—', 1),
  rule('dry', 45, true, ParameterStatus.PLAN, 2, 'תשומת לב / החלטה', 2),
  rule('dry', null, true, ParameterStatus.URGENT, 3, 'מסיק', 3),
];

/** The seeded status-card bands as they arrive over the wire, snake_case. */
const SEED_CATEGORY = {
  ready_oil_min: 18,
  ready_oil_max: 24,
  ready_water_min: 51,
  ready_water_max: 54,
  anomaly_water_low: 50,
  anomaly_water_high: 60,
  normal_oil_max: 17,
  normal_water_max: 60,
};

const SEED_ALERT = { ...DEFAULT_ALERT_BOUNDS };

/** The dialog's form values: both sets, flat, every value a string. */
const SEED_FORM = { ...categoryToForm(DEFAULT_CATEGORY_THRESHOLDS), ...alertToForm(SEED_ALERT) };

/** The fields a parse complained about, in order — what a caller routes to inputs. */
function fieldsOf<T>(result: ParseResult<T>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.field);
}

// ─── parseCategoryThresholds ─────────────────────────────────────────────────

describe('parseCategoryThresholds', () => {
  it('accepts the seeded bands', () => {
    const result = parseCategoryThresholds(SEED_CATEGORY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(DEFAULT_CATEGORY_THRESHOLDS);
  });

  /**
   * Three callers disagree about type: a JSON body sends numbers, the form
   * sends strings, and PostgREST sends NUMERIC as "18.00". All must work.
   */
  it('accepts numeric strings, including trailing-zero NUMERIC', () => {
    const result = parseCategoryThresholds({
      ...SEED_CATEGORY,
      ready_oil_min: '18.00',
      normal_oil_max: '17',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.readyOilMin).toBe(18);
      expect(result.value.normalOilMax).toBe(17);
    }
  });

  it('rejects a missing, blank or null field, naming it', () => {
    for (const bad of [undefined, '', null]) {
      const result = parseCategoryThresholds({ ...SEED_CATEGORY, normal_oil_max: bad });
      expect(fieldsOf(result)).toEqual(['normal_oil_max']);
    }
  });

  it('rejects values that are not finite numbers', () => {
    for (const bad of ['abc', Infinity, NaN, {}]) {
      const result = parseCategoryThresholds({ ...SEED_CATEGORY, ready_oil_max: bad });
      expect(fieldsOf(result)).toEqual(['ready_oil_max']);
    }
  });

  // All five measurements are percentages. 600 breaks no CHECK — it just makes
  // a band nothing can ever leave.
  it('rejects values outside 0..100', () => {
    expect(fieldsOf(parseCategoryThresholds({ ...SEED_CATEGORY, normal_oil_max: -1 }))).toEqual([
      'normal_oil_max',
    ]);
    expect(fieldsOf(parseCategoryThresholds({ ...SEED_CATEGORY, ready_oil_max: 101 }))).toEqual([
      'ready_oil_max',
    ]);
  });

  it('accepts the boundary values 0 and 100', () => {
    const result = parseCategoryThresholds({
      ...SEED_CATEGORY,
      ready_oil_min: 0,
      ready_oil_max: 100,
    });
    expect(result.ok).toBe(true);
  });

  it('collects every bad field rather than stopping at the first', () => {
    const result = parseCategoryThresholds({
      ...SEED_CATEGORY,
      ready_oil_min: '',
      normal_water_max: 'x',
    });
    expect(fieldsOf(result)).toEqual(['ready_oil_min', 'normal_water_max']);
  });

  // The three CHECK constraints on plot_category_thresholds.
  it('rejects each inverted band, on the field that has to move', () => {
    expect(fieldsOf(parseCategoryThresholds({ ...SEED_CATEGORY, ready_oil_min: 25 }))).toEqual([
      'ready_oil_max',
    ]);
    expect(fieldsOf(parseCategoryThresholds({ ...SEED_CATEGORY, ready_water_min: 55 }))).toEqual([
      'ready_water_max',
    ]);
    expect(fieldsOf(parseCategoryThresholds({ ...SEED_CATEGORY, anomaly_water_low: 61 }))).toEqual([
      'anomaly_water_high',
    ]);
  });

  /**
   * The database CHECKs are `<=`, so a one-point band is legal. Tightening this
   * to `<` here would reject a tuning Postgres would have accepted — the easy
   * mistake when mirroring a constraint by hand.
   */
  it('accepts equal min and max, because the CHECKs are <=', () => {
    const result = parseCategoryThresholds({
      ...SEED_CATEGORY,
      ready_oil_min: 20,
      ready_oil_max: 20,
      ready_water_min: 52,
      ready_water_max: 52,
      anomaly_water_low: 55,
      anomaly_water_high: 55,
    });
    expect(result.ok).toBe(true);
  });

  it('returns Hebrew messages', () => {
    const result = parseCategoryThresholds({ ...SEED_CATEGORY, ready_oil_min: 25 });
    if (result.ok) throw new Error('expected a failure');
    expect(result.errors[0].message).toContain('חייב להיות קטן או שווה');
  });
});

// ─── parseAlertBounds ────────────────────────────────────────────────────────

describe('parseAlertBounds', () => {
  it('accepts the seeded bounds', () => {
    const result = parseAlertBounds(SEED_ALERT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(DEFAULT_ALERT_BOUNDS);
  });

  it('rejects a missing or unparseable bound, naming it', () => {
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, waterOpt: undefined }))).toEqual([
      'waterOpt',
    ]);
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, dryHigh: 'x' }))).toEqual(['dryHigh']);
  });

  it('rejects bounds outside 0..100', () => {
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, oilHigh: 120 }))).toEqual(['oilHigh']);
  });

  /**
   * parameter_rules has no CHECK for ordering. An out-of-order bound produces a
   * rule that can never match — first-match-wins retires the band, and every
   * message in it, without a word.
   */
  it('rejects each break in the cascade order, on the upper field', () => {
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, oilLow: 21 }))).toEqual(['oilHigh']);
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, waterLow: 55 }))).toEqual(['waterOpt']);
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, waterHigh: 53 }))).toEqual(['waterHigh']);
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, dryLow: 46 }))).toEqual(['dryHigh']);
  });

  it('reports both breaks when the middle bound is dragged below its neighbours', () => {
    const result = parseAlertBounds({ ...SEED_ALERT, waterOpt: 45, waterHigh: 40 });
    expect(fieldsOf(result)).toEqual(['waterOpt', 'waterHigh']);
  });

  // Strict here, unlike the category CHECKs: equal bounds leave an empty band.
  it('rejects equal neighbouring bounds', () => {
    expect(fieldsOf(parseAlertBounds({ ...SEED_ALERT, oilLow: 20 }))).toEqual(['oilHigh']);
  });
});

// ─── parseThresholdForm ──────────────────────────────────────────────────────

describe('parseThresholdForm', () => {
  it('reads both sets out of one flat form object of strings', () => {
    const result = parseThresholdForm(SEED_FORM);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bands).toEqual(DEFAULT_CATEGORY_THRESHOLDS);
      expect(result.value.bounds).toEqual(DEFAULT_ALERT_BOUNDS);
    }
  });

  it('merges failures from both tabs', () => {
    const result = parseThresholdForm({ ...SEED_FORM, normal_oil_max: '', dryHigh: '' });
    expect(fieldsOf(result)).toEqual(['normal_oil_max', 'dryHigh']);
  });
});

// ─── validateThresholdForm ───────────────────────────────────────────────────

describe('validateThresholdForm', () => {
  it('passes the seeded form', () => {
    expect(validateThresholdForm(SEED_FORM)).toEqual([]);
  });

  it('reports cross-field problems across both tabs at once', () => {
    const issues = validateThresholdForm({ ...SEED_FORM, ready_oil_min: '25', oilLow: '21' });
    expect(issues.map((i) => i.field)).toEqual(['ready_oil_max', 'oilHigh']);
  });

  /**
   * Per-field rules stay in zod, which already flags them under the input.
   * Repeating them here would render every message twice.
   */
  it('stays silent about fields that are merely blank or unparseable', () => {
    expect(validateThresholdForm({ ...SEED_FORM, ready_oil_min: '', oilLow: 'x' })).toEqual([]);
  });
});

// ─── warnCategoryThresholds ──────────────────────────────────────────────────

describe('warnCategoryThresholds', () => {
  it('has nothing to say about the seeded bands', () => {
    expect(warnCategoryThresholds(DEFAULT_CATEGORY_THRESHOLDS)).toEqual([]);
  });

  it('flags a normal band that overlaps the ready box', () => {
    const warnings = warnCategoryThresholds({ ...DEFAULT_CATEGORY_THRESHOLDS, normalOilMax: 19 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('חופף');
  });

  it('flags a ready-water box that leaves the non-anomalous range', () => {
    const warnings = warnCategoryThresholds({
      ...DEFAULT_CATEGORY_THRESHOLDS,
      readyWaterMax: 65,
    });
    expect(warnings.some((w) => w.includes('יוצא מטווח המים התקין'))).toBe(true);
  });
});

// ─── readAlertBounds ─────────────────────────────────────────────────────────

describe('readAlertBounds', () => {
  /**
   * Pins DEFAULT_ALERT_BOUNDS to the migration seed. RULES above is the copy of
   * that seed kept by review; this assertion stops the constant drifting from
   * it and quietly restoring the wrong numbers.
   */
  it('reads exactly the defaults off the seeded rules', () => {
    expect(readAlertBounds(RULES)).toEqual(DEFAULT_ALERT_BOUNDS);
  });

  // NUMERIC arrives as a string. Left uncoerced, the form shows "17.00" and the
  // service's diff believes all seven bounds changed.
  it('coerces the NUMERIC strings PostgREST actually sends', () => {
    const asStrings = RULES.map((r) => ({
      ...r,
      upper_bound: r.upper_bound === null ? null : (`${r.upper_bound}.00` as unknown as number),
    }));
    expect(readAlertBounds(asStrings)).toEqual(DEFAULT_ALERT_BOUNDS);
  });

  it('omits a band whose rule row is absent, rather than inventing one', () => {
    const withoutDry = RULES.filter((r) => r.parameter_code !== 'dry');
    const bounds = readAlertBounds(withoutDry);
    expect(bounds.dryLow).toBeUndefined();
    expect(bounds.oilLow).toBe(17);
  });

  it('never reads a catch-all row as a bound', () => {
    expect(Object.values(readAlertBounds(RULES))).not.toContain(null);
    expect(Object.keys(readAlertBounds(RULES))).toHaveLength(ALERT_BAND_FIELDS.length);
  });
});

// ─── applyAlertBounds ────────────────────────────────────────────────────────

describe('applyAlertBounds', () => {
  const RETUNED = { ...DEFAULT_ALERT_BOUNDS, oilHigh: 22, dryHigh: 30 };

  it('does not touch the input array or its objects', () => {
    const before = JSON.parse(JSON.stringify(RULES));
    const applied = applyAlertBounds(RULES, RETUNED);

    expect(RULES).toEqual(before);
    expect(applied).not.toBe(RULES);
    expect(applied[0]).not.toBe(RULES[0]);
  });

  it('changes upper_bound and nothing else', () => {
    const applied = applyAlertBounds(RULES, RETUNED);

    applied.forEach((row, i) => {
      const original = RULES[i];
      expect(row.id).toBe(original.id);
      expect(row.parameter_code).toBe(original.parameter_code);
      expect(row.sort_order).toBe(original.sort_order);
      expect(row.status).toBe(original.status);
      expect(row.severity).toBe(original.severity);
      expect(row.message).toBe(original.message);
      expect(row.upper_inclusive).toBe(original.upper_inclusive);
    });
  });

  // Giving a catch-all a bound would drop the cascade's last band entirely.
  it('leaves the NULL catch-all rows unbounded', () => {
    const applied = applyAlertBounds(RULES, RETUNED);
    const catchAlls = applied.filter((r) => RULES.find((o) => o.id === r.id)!.upper_bound === null);

    expect(catchAlls).toHaveLength(3);
    for (const row of catchAlls) expect(row.upper_bound).toBeNull();
  });

  it('applies only the seven editable bounds', () => {
    const applied = applyAlertBounds(RULES, RETUNED);
    const changed = applied.filter((r, i) => r.upper_bound !== RULES[i].upper_bound);

    expect(changed.map((r) => `${r.parameter_code}#${r.sort_order}`)).toEqual(['oil#2', 'dry#2']);
  });

  // The behavioural proof: the preview classifies against these, so a retune
  // has to actually move a reading into a different band.
  it('changes how a reading scores', () => {
    expect(evaluateParameter(RULES, 'oil', 21)?.status).toBe(ParameterStatus.URGENT);
    expect(evaluateParameter(applyAlertBounds(RULES, RETUNED), 'oil', 21)?.status).toBe(
      ParameterStatus.PLAN
    );
  });
});

// ─── conversions ─────────────────────────────────────────────────────────────

describe('conversions', () => {
  it('maps every band to its real column, with no extras', () => {
    const columns = toCategoryColumns(DEFAULT_CATEGORY_THRESHOLDS);
    expect(columns).toEqual(SEED_CATEGORY);
    expect(Object.keys(columns)).toHaveLength(CATEGORY_BAND_FIELDS.length);
  });

  it('turns bounds into one update per editable rule row', () => {
    expect(toAlertUpdates(DEFAULT_ALERT_BOUNDS)).toEqual([
      { parameterCode: 'oil', sortOrder: 1, upperBound: 17 },
      { parameterCode: 'oil', sortOrder: 2, upperBound: 20 },
      { parameterCode: 'water', sortOrder: 1, upperBound: 50 },
      { parameterCode: 'water', sortOrder: 2, upperBound: 54 },
      { parameterCode: 'water', sortOrder: 3, upperBound: 60 },
      { parameterCode: 'dry', sortOrder: 1, upperBound: 40 },
      { parameterCode: 'dry', sortOrder: 2, upperBound: 45 },
    ]);
  });

  it('seeds the form with clean strings, not "17.00"', () => {
    expect(categoryToForm(DEFAULT_CATEGORY_THRESHOLDS).normal_oil_max).toBe('17');
    expect(alertToForm({ oilLow: 17.0 }).oilLow).toBe('17');
  });

  it('fills a missing bound from the defaults when seeding the form', () => {
    expect(alertToForm({}).waterOpt).toBe('54');
  });

  it('round-trips the form back through the parser', () => {
    const result = parseThresholdForm(SEED_FORM);
    if (!result.ok) throw new Error('expected the seeded form to parse');
    expect(toCategoryColumns(result.value.bands)).toEqual(SEED_CATEGORY);
  });
});
