/**
 * The two threshold sets behind the מסיק screen, as editable data.
 *
 * WHY THIS MODULE EXISTS
 * The settings dialog and the two API routes have to agree about fifteen
 * numbers and nine cross-field rules. A second copy of those rules would drift,
 * and the drift would be invisible: the form would accept a tuning the server
 * rejects, or — worse — the server would accept one the database refuses, and
 * handleApiError would hand the operator a raw CHECK-constraint violation.
 *
 * So validation lives here, once, as pure functions. The form calls them from a
 * zod `superRefine`, the routes call them before writing, and
 * `olive-thresholds.test.ts` covers both at the same time.
 *
 * THE TWO SETS ARE NOT INTERCHANGEABLE — that confusion is what made תקינה
 * unreachable and the cards read 43/0/7/0 against the prototype's 37/6/7/0:
 *
 *   category bands  → plot_category_thresholds → classifyPlotCategory → the four cards
 *   alert bounds    → parameter_rules          → computePlotStatus    → urgency + NIR pills
 *
 * No React, no Supabase. Everything is a plain value in and a plain value out.
 */

import type { ParameterRule } from '@/types/database';
import { DEFAULT_CATEGORY_THRESHOLDS } from './constants';
import { DEFAULT_WEATHER_THRESHOLDS } from './logic';
import type { CategoryThresholds, WeatherThresholds } from './logic';

// --- Types ---

export type AlertBandKey =
  | 'oilLow'
  | 'oilHigh'
  | 'waterLow'
  | 'waterOpt'
  | 'waterHigh'
  | 'dryLow'
  | 'dryHigh';

export type AlertBounds = Record<AlertBandKey, number>;

export type AlertParameterCode = 'oil' | 'water' | 'dry';

/** One editable band of the status cards. `column` is both the wire name and the form field name. */
export interface CategoryBandField {
  column: string;
  key: keyof CategoryThresholds;
  label: string;
}

/** One editable forecast level. `unit` is the suffix its input shows. */
export interface WeatherBandField {
  column: string;
  key: keyof WeatherThresholds;
  label: string;
  unit: string;
}

/**
 * One editable bound of the alert cascade.
 *
 * `sortOrder` addresses the parameter_rules row. It never travels over the wire
 * — the client sends `key`, the server resolves the row — so no client can name
 * a rule row, reorder the cascade, or reach a column other than upper_bound.
 */
export interface AlertBandField {
  key: AlertBandKey;
  parameterCode: AlertParameterCode;
  sortOrder: number;
  label: string;
}

export interface FieldIssue {
  /** The wire/form field name, so a caller can put the message under the input. */
  field: string;
  message: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldIssue[] };

/** One row of work for updateParameterRuleBounds(). */
export interface AlertBoundUpdate {
  parameterCode: AlertParameterCode;
  sortOrder: number;
  upperBound: number;
}

// --- Field metadata ---

/** The eight status-card bands, in the order the dialog shows them. */
export const CATEGORY_BAND_FIELDS: CategoryBandField[] = [
  { column: 'ready_oil_min', key: 'readyOilMin', label: 'אחוז שמן מינימלי למוכן למסיק' },
  { column: 'ready_oil_max', key: 'readyOilMax', label: 'אחוז שמן מקסימלי למוכן למסיק' },
  { column: 'ready_water_min', key: 'readyWaterMin', label: 'אחוז מים מינימלי למוכן למסיק' },
  { column: 'ready_water_max', key: 'readyWaterMax', label: 'אחוז מים מקסימלי למוכן למסיק' },
  { column: 'anomaly_water_low', key: 'anomalyWaterLow', label: 'גבול המים התחתון לחריגה' },
  { column: 'anomaly_water_high', key: 'anomalyWaterHigh', label: 'גבול המים העליון לחריגה' },
  { column: 'normal_oil_max', key: 'normalOilMax', label: 'אחוז שמן מקסימלי לחלקה תקינה' },
  { column: 'normal_water_max', key: 'normalWaterMax', label: 'אחוז מים מקסימלי לחלקה תקינה' },
];

/**
 * The seven editable bounds of the alert cascade.
 *
 * These are exactly the non-NULL `upper_bound` rows seeded in
 * 20260908100000_create_olive_parameters.sql, and exactly the seven keys the
 * prototype's own `thresholds` block carries — which is why
 * lib/olive/import-backup.ts reads its drift report off this same list rather
 * than keeping a second one.
 *
 * The catch-all rows (oil #3, water #4, dry #3) are deliberately absent: their
 * bound is NULL and must stay NULL, or the cascade loses its last band.
 */
export const ALERT_BAND_FIELDS: AlertBandField[] = [
  { key: 'oilLow', parameterCode: 'oil', sortOrder: 1, label: 'הסף של "לא מוכן למסיק"' },
  { key: 'oilHigh', parameterCode: 'oil', sortOrder: 2, label: 'הסף של "תוכנן למסיק"' },
  { key: 'waterLow', parameterCode: 'water', sortOrder: 1, label: 'הסף של "עקת מים"' },
  { key: 'waterOpt', parameterCode: 'water', sortOrder: 2, label: 'הסף של "אופטימום"' },
  { key: 'waterHigh', parameterCode: 'water', sortOrder: 3, label: 'הסף של "צמצום השקיה"' },
  { key: 'dryLow', parameterCode: 'dry', sortOrder: 1, label: 'הסף התחתון לשמן בחומר יבש' },
  { key: 'dryHigh', parameterCode: 'dry', sortOrder: 2, label: 'הסף של "תשומת לב / החלטה"' },
];

/**
 * Fallback bounds for the alert cascade — the prototype's `thresholds` block.
 *
 * Mirrors the seed in 20260908100000_create_olive_parameters.sql, the same way
 * DEFAULT_CATEGORY_THRESHOLDS mirrors 20260915100000. Change both together:
 * olive-logic.test.ts asserts this against its own copy of the seeded rules, so
 * a drift fails loudly rather than quietly restoring the wrong numbers.
 */
export const DEFAULT_ALERT_BOUNDS: AlertBounds = {
  oilLow: 17,
  oilHigh: 20,
  waterLow: 50,
  waterOpt: 54,
  waterHigh: 60,
  dryLow: 40,
  dryHigh: 45,
};

/**
 * The two forecast alert levels.
 *
 * `column` is both the wire name and the form field name, as with the category
 * bands — the weather tab posts flat snake_case, so no translation is needed
 * between the form and the request body.
 */
export const WEATHER_BAND_FIELDS: WeatherBandField[] = [
  { column: 'rain_alert_mm', key: 'rainAlertMm', label: 'סף הגשם', unit: 'מ״מ' },
  { column: 'wind_alert_kmh', key: 'windAlertKmh', label: 'סף הרוח', unit: 'קמ״ש' },
];

/**
 * Upper bound for the weather levels.
 *
 * Not 100, which is the cap every other field here carries because it is a
 * percentage. These are millimetres and km/h: 100 would reject a real gust.
 * 200 is still a guard against a typo like 2500.
 */
export const WEATHER_MAX = 200;

/** Every form field name, split by tab — the dialog uses these to route errors and dirty checks. */
export const CATEGORY_FIELD_NAMES = CATEGORY_BAND_FIELDS.map((f) => f.column);
export const ALERT_FIELD_NAMES = ALERT_BAND_FIELDS.map((f) => f.key);
export const WEATHER_FIELD_NAMES = WEATHER_BAND_FIELDS.map((f) => f.column);

// --- Parsing and validation ---

/**
 * Validate and convert the eight status-card bands.
 *
 * Accepts numbers or numeric strings, because the same values arrive from three
 * places that disagree about type: a JSON request body, a react-hook-form field
 * (always a string here — see the numeric-input convention in NirFormSheet),
 * and a PostgREST NUMERIC column (also a string).
 */
export function parseCategoryThresholds(
  input: Record<string, unknown>
): ParseResult<CategoryThresholds> {
  const read = readNumbers(
    input,
    CATEGORY_BAND_FIELDS.map((f) => ({ name: f.column, label: f.label }))
  );
  if (read.errors.length > 0) return { ok: false, errors: read.errors };

  const bands = {} as CategoryThresholds;
  for (const field of CATEGORY_BAND_FIELDS) bands[field.key] = read.values[field.column];

  const errors = categoryCrossIssues(bands);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: bands };
}

/** Validate and convert the seven alert bounds. Same input tolerance as above. */
export function parseAlertBounds(input: Record<string, unknown>): ParseResult<AlertBounds> {
  const read = readNumbers(
    input,
    ALERT_BAND_FIELDS.map((f) => ({ name: f.key, label: f.label }))
  );
  if (read.errors.length > 0) return { ok: false, errors: read.errors };

  const bounds = {} as AlertBounds;
  for (const field of ALERT_BAND_FIELDS) bounds[field.key] = read.values[field.key];

  const errors = alertCrossIssues(bounds);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: bounds };
}

/**
 * Validate and convert the two forecast levels. Same input tolerance as above.
 *
 * No cross-field rule exists: rain and wind are independent flags, not a
 * cascade, so there is no ordering for one to violate.
 */
export function parseWeatherThresholds(
  input: Record<string, unknown>
): ParseResult<WeatherThresholds> {
  const read = readNumbers(
    input,
    WEATHER_BAND_FIELDS.map((f) => ({ name: f.column, label: f.label })),
    WEATHER_MAX
  );
  if (read.errors.length > 0) return { ok: false, errors: read.errors };

  const levels = {} as WeatherThresholds;
  for (const field of WEATHER_BAND_FIELDS) levels[field.key] = read.values[field.column];

  return { ok: true, value: levels };
}

/**
 * All three sets from one flat object — the dialog's form values, and the live
 * preview's only gate. A preview is drawn if and only if this returns ok.
 */
export function parseThresholdForm(
  input: Record<string, unknown>
): ParseResult<{ bands: CategoryThresholds; bounds: AlertBounds; weather: WeatherThresholds }> {
  const category = parseCategoryThresholds(input);
  const alert = parseAlertBounds(input);
  const weather = parseWeatherThresholds(input);

  if (!category.ok || !alert.ok || !weather.ok) {
    return {
      ok: false,
      errors: [
        ...(category.ok ? [] : category.errors),
        ...(alert.ok ? [] : alert.errors),
        ...(weather.ok ? [] : weather.errors),
      ],
    };
  }

  return {
    ok: true,
    value: { bands: category.value, bounds: alert.value, weather: weather.value },
  };
}

/**
 * Cross-field issues only — the entry point for the form's zod `superRefine`.
 *
 * Per-field rules (present, numeric, 0..100) stay in zod, where they map
 * cleanly onto FormMessage; repeating them here would double every message.
 * Returns nothing when a value will not parse: there is no sense comparing
 * bands you could not read, and zod has already flagged those fields.
 */
export function validateThresholdForm(input: Record<string, unknown>): FieldIssue[] {
  const bands = partialNumbers(
    input,
    CATEGORY_BAND_FIELDS.map((f) => [f.column, f.key as string])
  ) as Partial<CategoryThresholds>;
  const bounds = partialNumbers(
    input,
    ALERT_BAND_FIELDS.map((f) => [f.key, f.key])
  ) as Partial<AlertBounds>;

  return [...categoryCrossIssues(bands), ...alertCrossIssues(bounds)];
}

/**
 * Tunings that are legal but probably not what the user meant.
 *
 * Warnings, never rejections. classifyPlotCategory's own notes anticipate the
 * client widening the ready box, and the app has no standing to refuse a tuning
 * the grower wants — it only has standing to point out the consequence.
 */
export function warnCategoryThresholds(bands: CategoryThresholds): string[] {
  const warnings: string[] = [];

  if (bands.normalOilMax >= bands.readyOilMin) {
    warnings.push(
      'טווח "חלקות תקינות" חופף ל"מוכן למסיק". "מוכן למסיק" נבדק ראשון ולכן הוא שגובר.'
    );
  }

  if (bands.readyWaterMin < bands.anomalyWaterLow || bands.readyWaterMax > bands.anomalyWaterHigh) {
    warnings.push(
      'טווח המים ל"מוכן למסיק" יוצא מטווח המים התקין, כך שחלקה יכולה להיות מוכנה למסיק ולחרוג בו-זמנית.'
    );
  }

  if (bands.normalWaterMax > bands.anomalyWaterHigh) {
    warnings.push('אחוז המים המקסימלי לחלקה תקינה גבוה מגבול החריגה, ולכן לא ייבדק בפועל.');
  }

  return warnings;
}

// --- Conversions ---

/**
 * The current bounds as stored in parameter_rules.
 *
 * upper_bound is NUMERIC, so PostgREST sends it as a string — "17.00", not 17.
 * Left uncoerced it would seed the form with "17.00" and make the service's
 * diff believe every bound had changed. Same trap evaluateParameter and
 * toCategoryThresholds each document.
 *
 * Partial by design: a rule row the database does not have is simply absent,
 * and the caller falls back to DEFAULT_ALERT_BOUNDS for it.
 */
export function readAlertBounds(rules: ParameterRule[]): Partial<AlertBounds> {
  const bounds: Partial<AlertBounds> = {};

  for (const field of ALERT_BAND_FIELDS) {
    const row = rules.find(
      (r) => r.parameter_code === field.parameterCode && r.sort_order === field.sortOrder
    );
    const value = toNumber(row?.upper_bound);
    if (value !== null) bounds[field.key] = value;
  }

  return bounds;
}

/**
 * The rules as they would be with these bounds applied — what the live preview
 * classifies against.
 *
 * Returns new objects and never touches the input. A mutating version would
 * change the dashboard behind the open dialog as the user typed.
 *
 * A rule whose stored `upper_bound` is NULL is left alone even when a band
 * claims its sort_order: that row is the cascade's catch-all, and giving it a
 * bound would silently drop the last band.
 */
export function applyAlertBounds(rules: ParameterRule[], bounds: AlertBounds): ParameterRule[] {
  return rules.map((rule) => {
    const field = ALERT_BAND_FIELDS.find(
      (f) => f.parameterCode === rule.parameter_code && f.sortOrder === rule.sort_order
    );
    if (!field || rule.upper_bound === null) return rule;

    return { ...rule, upper_bound: bounds[field.key] };
  });
}

/** camelCase bands -> the plot_category_thresholds columns. */
export function toCategoryColumns(bands: CategoryThresholds): Record<string, number> {
  const columns: Record<string, number> = {};
  for (const field of CATEGORY_BAND_FIELDS) columns[field.column] = bands[field.key];
  return columns;
}

/** camelCase levels -> the weather_alert_thresholds columns. */
export function toWeatherColumns(levels: WeatherThresholds): Record<string, number> {
  const columns: Record<string, number> = {};
  for (const field of WEATHER_BAND_FIELDS) columns[field.column] = levels[field.key];
  return columns;
}

/** Bounds -> the rows updateParameterRuleBounds() should touch. */
export function toAlertUpdates(bounds: AlertBounds): AlertBoundUpdate[] {
  return ALERT_BAND_FIELDS.map((field) => ({
    parameterCode: field.parameterCode,
    sortOrder: field.sortOrder,
    upperBound: bounds[field.key],
  }));
}

/**
 * Seed values for the dialog's form, which holds every number as a string.
 *
 * Numbers are stringified rather than passed through, so a column that arrives
 * as "17.00" shows as "17" in the input.
 */
export function categoryToForm(bands: CategoryThresholds): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of CATEGORY_BAND_FIELDS) values[field.column] = String(bands[field.key]);
  return values;
}

export function alertToForm(bounds: Partial<AlertBounds>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of ALERT_BAND_FIELDS) {
    values[field.key] = String(bounds[field.key] ?? DEFAULT_ALERT_BOUNDS[field.key]);
  }
  return values;
}

export function weatherToForm(levels: Partial<WeatherThresholds>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of WEATHER_BAND_FIELDS) {
    values[field.column] = String(levels[field.key] ?? DEFAULT_WEATHER_THRESHOLDS[field.key]);
  }
  return values;
}

/** Defaults as form strings, for the "restore defaults" buttons. */
export function defaultCategoryForm(): Record<string, string> {
  return categoryToForm(DEFAULT_CATEGORY_THRESHOLDS);
}

export function defaultAlertForm(): Record<string, string> {
  return alertToForm(DEFAULT_ALERT_BOUNDS);
}

// --- Private helpers ---

/**
 * Read every named field as a number in 0..`max`, collecting one issue per field
 * rather than throwing on the first.
 *
 * The range is not a database constraint — for the bands it is the fact that all
 * five of those measurements are percentages. A bound of 600 would not fail any
 * CHECK; it would just mean a band no sample can ever leave.
 *
 * `max` is a parameter because the weather levels are the one set that is NOT a
 * percentage: capping wind at 100 would reject a real 120 km/h gust with a
 * message about percentages.
 */
function readNumbers(
  input: Record<string, unknown>,
  fields: { name: string; label: string }[],
  max = 100
): { values: Record<string, number>; errors: FieldIssue[] } {
  const values: Record<string, number> = {};
  const errors: FieldIssue[] = [];

  for (const field of fields) {
    const raw = input[field.name];

    if (raw === null || raw === undefined || raw === '') {
      errors.push({ field: field.name, message: `נדרש ערך ב${field.label}` });
      continue;
    }

    const value = toNumber(raw);
    if (value === null) {
      errors.push({ field: field.name, message: `${field.label} חייב להיות מספר` });
      continue;
    }

    if (value < 0 || value > max) {
      errors.push({ field: field.name, message: `${field.label} חייב להיות בין 0 ל-${max}` });
      continue;
    }

    values[field.name] = value;
  }

  return { values, errors };
}

/** The parseable subset, keyed by domain key. Unreadable fields are simply absent. */
function partialNumbers(
  input: Record<string, unknown>,
  pairs: [inputName: string, outputKey: string][]
): Record<string, number> {
  const values: Record<string, number> = {};

  for (const [inputName, outputKey] of pairs) {
    const value = toNumber(input[inputName]);
    if (value !== null) values[outputKey] = value;
  }

  return values;
}

/**
 * The three CHECK constraints on plot_category_thresholds, mirrored.
 *
 * They are `<=` in the database, so equality is legal and must stay legal here
 * — a ready box one point wide is a strange tuning, not an invalid one.
 */
function categoryCrossIssues(bands: Partial<CategoryThresholds>): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (
    bands.readyOilMin !== undefined &&
    bands.readyOilMax !== undefined &&
    bands.readyOilMin > bands.readyOilMax
  ) {
    issues.push({
      field: 'ready_oil_max',
      message: 'אחוז השמן המינימלי למוכן למסיק חייב להיות קטן או שווה למקסימלי',
    });
  }

  if (
    bands.readyWaterMin !== undefined &&
    bands.readyWaterMax !== undefined &&
    bands.readyWaterMin > bands.readyWaterMax
  ) {
    issues.push({
      field: 'ready_water_max',
      message: 'אחוז המים המינימלי למוכן למסיק חייב להיות קטן או שווה למקסימלי',
    });
  }

  if (
    bands.anomalyWaterLow !== undefined &&
    bands.anomalyWaterHigh !== undefined &&
    bands.anomalyWaterLow > bands.anomalyWaterHigh
  ) {
    issues.push({
      field: 'anomaly_water_high',
      message: 'גבול המים התחתון לחריגה חייב להיות קטן או שווה לגבול העליון',
    });
  }

  return issues;
}

/**
 * The cascade has to stay ordered, or first-match-wins stops meaning anything.
 *
 * parameter_rules carries no CHECK for this — nothing in the database stops a
 * waterOpt below waterLow. It would simply produce a rule that can never match,
 * silently retiring the band and every message in it.
 *
 * Strict `<`, not `<=`: equal bounds make the band between them empty.
 */
function alertCrossIssues(bounds: Partial<AlertBounds>): FieldIssue[] {
  const ordered: [AlertBandKey, AlertBandKey, string][] = [
    ['oilLow', 'oilHigh', 'הסף של "לא מוכן למסיק" חייב להיות קטן מהסף של "תוכנן למסיק"'],
    ['waterLow', 'waterOpt', 'הסף של "עקת מים" חייב להיות קטן מהסף של "אופטימום"'],
    ['waterOpt', 'waterHigh', 'הסף של "אופטימום" חייב להיות קטן מהסף של "צמצום השקיה"'],
    ['dryLow', 'dryHigh', 'הסף התחתון לשמן בחומר יבש חייב להיות קטן מהסף של "תשומת לב / החלטה"'],
  ];

  const issues: FieldIssue[] = [];

  for (const [lower, upper, message] of ordered) {
    const low = bounds[lower];
    const high = bounds[upper];
    if (low !== undefined && high !== undefined && low >= high) {
      issues.push({ field: upper, message });
    }
  }

  return issues;
}

/** Number or null. Rejects '', null, undefined, NaN and Infinity alike. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
