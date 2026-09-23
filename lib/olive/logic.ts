/**
 * Olive harvest decision logic.
 *
 * Ported from the `olive-dashboard-prototype.html` prototype. Spec §7.2 is
 * explicit that this logic is the product of months of tuning with the client
 * and must not be changed without approval, so the port is deliberately
 * literal: the condition ORDER below is load-bearing, not stylistic.
 *
 * Everything here is pure — no Supabase, no fetch, no Date.now() without an
 * injected `now`. Thresholds arrive as rows rather than constants: alert bands
 * as `ParameterRule[]`, where the word "oil" never drives a branch, and the
 * status-card bands as `CategoryThresholds`, where it has to — "מוכן למסיק"
 * is a box across oil and water at once, which a per-parameter cascade cannot
 * express. See classifyPlotCategory.
 */

import { ParameterStatus, type ParameterRule } from '@/types/database';

// --- Types ---

/** Minimum a plot needs to expose for these functions. */
export interface PlotLike {
  id: string;
  name: string | null;
  variety: string | null;
  region: string | null;
  grower_name: string | null;
}

/** One NIR measurement, already flattened from report_areas + nir_report. */
export interface NirLike {
  report_date: string | null; // YYYY-MM-DD
  oil: number | null;
  water: number | null;
  dry: number | null;
  green: number | null;
  acid: number | null;
  maturity: number | null;
}

export interface WeatherDayLike {
  entry_date: string; // YYYY-MM-DD
  rain_mm: number | null;
  wind_kmh: number | null;
  is_manual: boolean;
  // Display only — no branch below reads these. Optional because a caller that
  // only cares about the flags should not have to invent them.
  temp_min?: number | null;
  temp_max?: number | null;
}

export interface VarietyWindowLike {
  variety: string;
  start_dm: string; // 'DD/MM'
  end_dm: string; // 'DD/MM'
}

export interface RuleMatch {
  status: ParameterStatus;
  severity: number;
  message: string;
}

/**
 * One upcoming day, after the manual-over-forecast merge.
 *
 * `rainFlagged`/`windFlagged` are set by the same loop that sets `rainSoon` and
 * pushes `weatherLines`, so a screen marking days from this list can never mark
 * a different set than the lines name. Nothing here feeds a harvest decision —
 * computePlotStatus reads the two booleans below, not this array.
 */
export interface UpcomingWeatherDay {
  date: string;
  rainMm: number | null;
  windKmh: number | null;
  tempMin: number | null;
  tempMax: number | null;
  isManual: boolean;
  rainFlagged: boolean;
  windFlagged: boolean;
}

export interface UpcomingWeather {
  upcoming: UpcomingWeatherDay[];
  rainSoon: boolean;
  windSoon: boolean;
  weatherLines: string[];
}

export type UrgencyLevel = 'ok' | 'plan' | 'urgent';

export interface PlotStatus {
  level: UrgencyLevel;
  headline: string;
  windowLine: string;
  oilMatch: RuleMatch | null;
}

export type PlotCategory = 'testing' | 'ready' | 'anomaly' | 'normal';

/**
 * Bands for the four status cards — the prototype's `categoryThresholds`.
 *
 * Deliberately NOT the same numbers as the parameter_rules bands, which drive
 * alert urgency. See classifyPlotCategory for why the two sets exist.
 */
export interface CategoryThresholds {
  readyOilMin: number;
  readyOilMax: number;
  readyWaterMin: number;
  readyWaterMax: number;
  anomalyWaterLow: number;
  anomalyWaterHigh: number;
  normalOilMax: number;
  normalWaterMax: number;
}

// Thresholds the client set for yield load. Not in parameter_rules because
// this reads an estimate, not a measurement.
const YIELD_LOAD_HIGH = 1300;
const YIELD_LOAD_MEDIUM = 900;

/**
 * The levels at which a forecast day counts as rain or wind. Spec §4.4.
 *
 * Separate from every threshold above because these read a forecast, not a
 * measurement — there is no band cascade, just "is tomorrow worse than this".
 */
export interface WeatherThresholds {
  rainAlertMm: number;
  windAlertKmh: number;
}

/**
 * Fallback weather levels — the values these were hardcoded to before the
 * client could tune them.
 *
 * The live values are a row in weather_alert_thresholds; this is what
 * computeUpcomingWeather uses when no caller supplies one, which covers both
 * the missing row and the window before the table exists in production.
 *
 * Kept in step with the seed in
 * 20260915110000_create_olive_weather_thresholds.sql. Change both together.
 */
export const DEFAULT_WEATHER_THRESHOLDS: WeatherThresholds = {
  rainAlertMm: 5,
  windAlertKmh: 25,
};

// --- Public API ---

/**
 * Resolve a measured value to its rule band.
 *
 * Rules are evaluated in `sort_order`, first match wins. A rule matches when
 * the value falls at or below `upper_bound` (`upper_inclusive`) or strictly
 * below it (otherwise). A NULL `upper_bound` is the catch-all.
 *
 * The asymmetry is faithful to the prototype: oil 17.0 is "planned", not "not
 * ready", and oil 20.0 is "planned", not "immediate".
 *
 * Both the value and the bound are coerced to numbers first. Postgres NUMERIC
 * arrives over PostgREST as a STRING, so `upper_bound` is "17.00" rather than
 * 17 — and comparing two strings is lexical, where "9" > "17". Without this
 * coercion the thresholds would silently misfire on real data while every
 * fixture-based test kept passing.
 */
export function evaluateParameter(
  rules: ParameterRule[],
  parameterCode: string,
  value: number | string | null | undefined
): RuleMatch | null {
  const measured = toNumber(value);
  if (measured === null) return null;

  const applicable = rules
    .filter((r) => r.parameter_code === parameterCode)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of applicable) {
    const bound = toNumber(rule.upper_bound);
    const matches = bound === null || (rule.upper_inclusive ? measured <= bound : measured < bound);

    if (matches) {
      return { status: rule.status, severity: rule.severity, message: rule.message };
    }
  }

  return null;
}

/**
 * Collapse the next few days of weather into two booleans.
 *
 * Manual rows overwrite fetched forecast rows for the same date — they are
 * applied second, exactly as the prototype does. The two loops are not one loop
 * for that reason; merging them would drop the rule.
 *
 * `thresholds` defaults to the values these flags were hardcoded to, so a
 * caller with no tuned row behaves exactly as before.
 */
export function computeUpcomingWeather(
  days: WeatherDayLike[],
  now: Date,
  thresholds: WeatherThresholds = DEFAULT_WEATHER_THRESHOLDS
): UpcomingWeather {
  const todayStr = toDateString(now);
  const byDate = new Map<string, Omit<UpcomingWeatherDay, 'date'>>();

  const entry = (d: WeatherDayLike): Omit<UpcomingWeatherDay, 'date'> => ({
    rainMm: d.rain_mm,
    windKmh: d.wind_kmh,
    tempMin: d.temp_min ?? null,
    tempMax: d.temp_max ?? null,
    isManual: d.is_manual,
    rainFlagged: false,
    windFlagged: false,
  });

  for (const d of days.filter((d) => !d.is_manual)) {
    if (d.entry_date >= todayStr) {
      byDate.set(d.entry_date, entry(d));
    }
  }
  // Manual entries win.
  for (const d of days.filter((d) => d.is_manual)) {
    if (d.entry_date >= todayStr) {
      byDate.set(d.entry_date, entry(d));
    }
  }

  const upcoming = [...byDate.keys()].sort().map((date) => ({ date, ...byDate.get(date)! }));

  let rainSoon = false;
  let windSoon = false;
  const weatherLines: string[] = [];

  for (const w of upcoming) {
    if (w.rainMm !== null && w.rainMm > thresholds.rainAlertMm) {
      rainSoon = true;
      w.rainFlagged = true;
      weatherLines.push(`גשם צפוי ${w.date}: ${w.rainMm} מ"מ`);
    }
    if (w.windKmh !== null && w.windKmh > thresholds.windAlertKmh) {
      windSoon = true;
      w.windFlagged = true;
      weatherLines.push(`רוח חזקה צפויה ${w.date}: ${w.windKmh} קמ"ש`);
    }
  }

  return { upcoming, rainSoon, windSoon, weatherLines };
}

/**
 * Harvest urgency for one plot.
 *
 * IMPORTANT — the branch order is the specification. Two properties of it are
 * easy to "tidy" and must not be:
 *
 *   1. Wind alone never raises urgency. It only sharpens the headline of a plot
 *      that oil has already put at `plan`. The client is explicit that wind
 *      matters when you are already deciding, not on its own.
 *   2. Only OIL is read here. Water and dry-matter are deliberately absent —
 *      see the note on classifyPlotCategory below.
 */
export function computePlotStatus(
  plot: PlotLike,
  latestNir: NirLike | null,
  rules: ParameterRule[],
  weather: UpcomingWeather,
  windows: VarietyWindowLike[],
  now: Date
): PlotStatus {
  const oilMatch = latestNir ? evaluateParameter(rules, 'oil', latestNir.oil) : null;
  const oilStatus = oilMatch?.status ?? null;

  let level: UrgencyLevel = 'ok';
  let headline = 'ללא דחיפות מיוחדת';

  if (oilStatus === ParameterStatus.URGENT && weather.rainSoon) {
    level = 'urgent';
    headline = 'מסיק דחוף — שמן בטווח מיידי וגשם בדרך';
  } else if (oilStatus === ParameterStatus.URGENT) {
    level = 'urgent';
    headline = 'מסיק מיידי לפי NIR';
  } else if (oilStatus === ParameterStatus.PLAN && weather.rainSoon && weather.windSoon) {
    level = 'plan';
    headline = 'שקול הקדמת מסיק — גשם ורוח חזקה צפויים';
  } else if (oilStatus === ParameterStatus.PLAN && weather.rainSoon) {
    level = 'plan';
    headline = 'שקול הקדמת מסיק — גשם צפוי';
  } else if (oilStatus === ParameterStatus.PLAN && weather.windSoon) {
    level = 'plan';
    headline = 'שקול הקדמת מסיק — רוח חזקה צפויה';
  } else if (oilStatus === ParameterStatus.PLAN) {
    level = 'plan';
    headline = 'מתוכנן למסיק בקרוב';
  }

  let windowLine = '';
  if (plot.variety) {
    const variety = plot.variety.trim();
    const matching = windows.filter((w) => w.variety.trim() === variety);

    if (matching.length > 0) {
      const inWindow = matching.some((w) => isDateInWindow(w.start_dm, w.end_dm, now));
      windowLine = inWindow
        ? `בתוך חלון הקטיף המוגדר לזן ${plot.variety}`
        : `מחוץ לחלון הקטיף המוגדר לזן ${plot.variety}`;

      // A harvest window can only lift a quiet plot; it never overrides oil.
      if (inWindow && level === 'ok') {
        level = 'plan';
        headline = 'בתוך חלון הקטיף העונתי לזן';
      }
    }
  }

  return { level, headline, windowLine, oilMatch };
}

/**
 * Which of the four dashboard status cards a plot belongs to.
 *
 * WHY THIS READS `thresholds` AND NOT JUST `rules`
 * The prototype keeps two independent threshold blocks. `thresholds` are the
 * alert bands, ported to parameter_rules and read by computePlotStatus above.
 * `categoryThresholds` are these — the status cards, and nothing else.
 *
 * The first port collapsed the two, mapping תקינה onto the oil PLAN band
 * (17..20) when the prototype means oil at or BELOW normalOilMax (≤ 17). Every
 * early-season sample therefore fell past תקינה into בבדיקות, where it sat
 * next to plots nobody had sampled at all: the גשור 2026 backup read 43/0/7/0
 * here against the prototype's own 37/6/7/0, the difference being its six
 * plots at oil 9.2..11.8. Reading the card bands from their own source is the
 * fix; `olive-logic.test.ts` pins that dataset so it cannot regress.
 *
 * ORDER. Ready is tested first, matching the old branch order. It no longer
 * decides anything on its own — readyWater 51..54 sits inside the non-anomalous
 * water band, so ready and anomaly cannot both hold — but leaving it first
 * keeps the precedence visible if the client ever widens the ready box.
 *
 * DRY-MATTER IS RETAINED, AND IS THE ONE THING NOT FROM categoryThresholds.
 * The prototype's categoryThresholds block carries no dry key, so a literal
 * port would drop the dry-urgent → חריגה rule. The גשור data cannot settle
 * which is right (every dry reading there is 14..28, far below the urgent
 * band), and dropping it would silently retire a signal the app has been
 * raising. It stays, sourced from parameter_rules, until the client says
 * otherwise — that is open decision #1 in their design doc.
 *
 * KNOWN DIVERGENCE FROM computePlotStatus — PRESERVED ON PURPOSE.
 * This function reads oil, water AND dry-matter; computePlotStatus reads only
 * oil. A plot at oil 19.4 / water 57.2 / dry 45.33 therefore reads "שקול
 * הקדמת מסיק" (plan) in the alerts list while counting as "חריגה" (anomaly)
 * on the status card. Spec §7.2 forbids changing tuned logic without client
 * approval; the tests pin both outputs so the split cannot close by accident.
 *
 * A measurement missing the value a band needs fails that band. Such a plot
 * lands in בבדיקות, which is what it is — a sample that still has to be read.
 */
export function classifyPlotCategory(
  latestNir: NirLike | null,
  rules: ParameterRule[],
  thresholds: CategoryThresholds
): PlotCategory {
  if (!latestNir) return 'testing';

  const oil = toNumber(latestNir.oil);
  const water = toNumber(latestNir.water);

  const oilReady = within(oil, thresholds.readyOilMin, thresholds.readyOilMax);
  const waterReady = within(water, thresholds.readyWaterMin, thresholds.readyWaterMax);
  if (oilReady && waterReady) return 'ready';

  if (water !== null && (water < thresholds.anomalyWaterLow || water > thresholds.anomalyWaterHigh))
    return 'anomaly';

  // Sourced from parameter_rules, not categoryThresholds — see the note above.
  if (evaluateParameter(rules, 'dry', latestNir.dry)?.status === ParameterStatus.URGENT)
    return 'anomaly';

  if (
    oil !== null &&
    oil <= thresholds.normalOilMax &&
    water !== null &&
    water <= thresholds.normalWaterMax
  )
    return 'normal';

  return 'testing';
}

/** Yield load band from the per-dunam estimate. Spec §4.3. */
export function yieldLoadInfo(
  kgPerDunam: number | string | null | undefined
): { label: string; status: ParameterStatus } | null {
  const estimate = toNumber(kgPerDunam);
  if (estimate === null) return null;

  if (estimate > YIELD_LOAD_HIGH) {
    return { label: 'עומס יבול: גבוה', status: ParameterStatus.PLAN };
  }
  if (estimate >= YIELD_LOAD_MEDIUM) {
    return { label: 'עומס יבול: בינוני', status: ParameterStatus.OK };
  }
  return { label: 'עומס יבול: נמוך', status: ParameterStatus.IDLE };
}

/**
 * A yield estimate out of what someone typed.
 *
 * This is the only guard on the value there is. `yield_estimates.kg_per_dunam`
 * carries no CHECK constraint and the route coerces with a bare `Number()`, and
 * rejecting NaN here is the part that matters: `JSON.stringify(NaN)` is `null`,
 * so a typo'd "12a" would not fail loudly — it would silently clear the
 * estimate and look like a successful save.
 *
 * An empty field is a deliberate clear, not a mistake, so it parses to null.
 */
export function parseYieldDraft(
  raw: string
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };

  const parsed = Number(trimmed);
  // NUMERIC(10,2) is eight digits before the point. Past that the insert fails
  // in the database, long after the row has left the screen.
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99999999.99) {
    // The same string the plot drawer's zod refine uses, so the two entry
    // points for this field cannot disagree about what is wrong.
    return { ok: false, message: 'נדרש ערך חיובי' };
  }

  return { ok: true, value: parsed };
}

/**
 * Free-text plot search.
 *
 * Matches a plain substring across name/region/variety/grower, and also matches
 * the initials of the plot name, so someone entering data in the grove can type
 * "מא" to reach "מיצר — 2003 — ארבקינה".
 */
export function plotMatchesSearch(plot: PlotLike, term: string): boolean {
  if (!term) return true;

  const haystack = [plot.name, plot.region, plot.variety, plot.grower_name]
    .filter(Boolean)
    .join(' ');
  if (haystack.includes(term)) return true;

  const initials = (plot.name || '')
    .split(/[\s—\-·]+/)
    .map((word) => word[0] || '')
    .join('');
  return initials.includes(term);
}

/** Parse a 'DD/MM' fragment. Returns null when malformed. */
export function parseDM(value: string): { d: number; m: number } | null {
  const match = value.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!match) return null;
  return { d: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

/**
 * Is `now` inside a recurring day/month window?
 *
 * Windows may wrap the turn of the year (e.g. 15/11 → 20/01), which is why the
 * comparison is on a synthetic month*31+day ordinal rather than real dates.
 */
export function isDateInWindow(startDm: string, endDm: string, now: Date): boolean {
  const start = parseDM(startDm);
  const end = parseDM(endDm);
  if (!start || !end) return false;

  const ordinal = (o: { d: number; m: number }) => o.m * 31 + o.d;
  const today = ordinal({ m: now.getMonth() + 1, d: now.getDate() });
  const startVal = ordinal(start);
  const endVal = ordinal(end);

  if (startVal <= endVal) return today >= startVal && today <= endVal;
  return today >= startVal || today <= endVal;
}

/**
 * "היום" / "אתמול" / "לפני N ימים". Null for a missing or future date.
 *
 * Accepts either a plain YYYY-MM-DD or a full ISO timestamp. report_areas.
 * report_date is timestamptz, not date, so it arrives as
 * "2026-09-07T00:00:00+00:00" — appending T00:00:00 to that produced an
 * Invalid Date and every plot silently reported no measurement.
 */
export function daysSinceLabel(dateStr: string | null, now: Date): string | null {
  if (!dateStr) return null;

  const then = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
}

// --- Private helpers ---

/**
 * Coerce a value that may arrive as a Postgres NUMERIC string.
 *
 * Returns null for anything not a finite number, so callers can treat "missing"
 * and "unparseable" identically rather than propagating NaN into a comparison.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Inclusive band test. A missing value is never inside a band — the prototype's
 * JS would coerce '' to 0 and call that in range, which is how a blank reading
 * could read as "מוכן למסיק".
 */
function within(value: number | null, min: number, max: number): boolean {
  return value !== null && value >= min && value <= max;
}

/** Local-date YYYY-MM-DD. Avoids toISOString(), which shifts across timezones. */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
