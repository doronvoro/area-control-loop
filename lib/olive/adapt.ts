/**
 * Adapters between API payload shapes and the pure logic module.
 *
 * lib/olive/logic.ts deliberately knows nothing about how the data is stored —
 * it takes flat PlotLike / NirLike values. These functions do the flattening in
 * one place so the dashboard, the plot list and any future screen agree on it.
 */

import type {
  CategoryThresholds,
  NirLike,
  PlotLike,
  VarietyWindowLike,
  WeatherDayLike,
  WeatherThresholds,
} from './logic';
import { DEFAULT_WEATHER_THRESHOLDS } from './logic';
import { DEFAULT_CATEGORY_THRESHOLDS } from './constants';

/** An `areas` row joined with its olive_plot_details, as /api/olive returns it. */
export interface ApiPlot {
  id: string;
  name: string | null;
  variety: string | null;
  planting_time: string | null;
  size: number | null;
  details?: {
    /** The grower record. grower_name is the display value kept alongside it. */
    grower_id?: string | null;
    grower_name: string | null;
    region: string | null;
    plot_type: string | null;
    harvester: string | null;
    water_type: string | null;
    takt_count: number | null;
    plant_year_label: string | null;
  } | null;
  takts?: { id: string; name: string }[];
  [key: string]: unknown;
}

/** A report_areas row joined with its nir_report detail. */
export interface ApiNirReport {
  id: string;
  report_date: string | null;
  created_at: string;
  detail?: {
    oil: number | null;
    water: number | null;
    dry: number | null;
    green: number | null;
    acid: number | null;
    maturity: number | null;
    irrig_amount: number | null;
    direction: string | null;
    /** An ISO instant, not a calendar day. NULL = not sent. */
    sent_to_client_at: string | null;
    /** auth.users.id — resolve it through `sent_by_name`, not by embedding. */
    sent_to_client_by: string | null;
  } | null;
  /**
   * Resolved from detail.sent_to_client_by by the API, since PostgREST cannot
   * embed auth.users. Sits beside `detail` rather than inside it because that
   * object mirrors the nir_report row and this is not one of its columns.
   */
  sent_by_name?: string | null;
  [key: string]: unknown;
}

export function toPlotLike(plot: ApiPlot): PlotLike {
  return {
    id: plot.id,
    name: plot.name,
    variety: plot.variety,
    region: plot.details?.region ?? null,
    grower_name: plot.details?.grower_name ?? null,
  };
}

/**
 * Flatten a NIR report into the measurement the logic reads.
 *
 * Falls back to created_at when report_date is null, so a measurement saved
 * without an explicit date still sorts and labels sensibly.
 */
export function toNirLike(report: ApiNirReport | null | undefined): NirLike | null {
  if (!report?.detail) return null;

  return {
    // report_date is timestamptz; keep only the calendar day.
    report_date: (report.report_date ?? report.created_at)?.slice(0, 10) ?? null,
    oil: numeric(report.detail.oil),
    water: numeric(report.detail.water),
    dry: numeric(report.detail.dry),
    green: numeric(report.detail.green),
    acid: numeric(report.detail.acid),
    maturity: numeric(report.detail.maturity),
  };
}

/**
 * Flatten a weather_days row.
 *
 * Temperature is carried for display only — nothing in logic.ts branches on it.
 * It is coerced like every other NUMERIC because PostgREST sends "18.50", which
 * a chip would print as `18.50°` rather than `19°`.
 *
 * A column that is absent stays null rather than becoming 0: a chip reading
 * `0 מ"מ` claims no rain is expected, where `—` admits there is no data.
 */
export function toWeatherDayLike(row: Record<string, unknown>): WeatherDayLike {
  return {
    entry_date: String(row.entry_date),
    rain_mm: numeric(row.rain_mm),
    wind_kmh: numeric(row.wind_kmh),
    is_manual: Boolean(row.is_manual),
    temp_min: numeric(row.temp_min),
    temp_max: numeric(row.temp_max),
  };
}

/**
 * Flatten the weather_alert_thresholds row into the levels the flags read.
 *
 * Same NUMERIC-string trap and the same fallback rule as toCategoryThresholds:
 * a missing row degrades to the values these flags shipped with, so the
 * dashboard keeps flagging rain at 5 mm rather than at 0.
 */
export function toWeatherThresholds(
  row: Record<string, unknown> | null | undefined
): WeatherThresholds {
  return {
    rainAlertMm: numeric(row?.rain_alert_mm) ?? DEFAULT_WEATHER_THRESHOLDS.rainAlertMm,
    windAlertKmh: numeric(row?.wind_alert_kmh) ?? DEFAULT_WEATHER_THRESHOLDS.windAlertKmh,
  };
}

/**
 * Flatten the plot_category_thresholds row into the bands the logic reads.
 *
 * Every column is NUMERIC, so PostgREST sends strings — comparing those
 * directly is lexical, where "9" > "17", and the bands would misfire on real
 * data while fixture-based tests kept passing. That is the same trap
 * evaluateParameter() documents for upper_bound.
 *
 * A missing row (or a column that somehow arrives unparseable) falls back to
 * the prototype's default for that band rather than to zero, so the dashboard
 * degrades to the shipped behaviour instead of classifying everything as ready.
 */
export function toCategoryThresholds(
  row: Record<string, unknown> | null | undefined
): CategoryThresholds {
  const band = (key: string, fallback: number) => numeric(row?.[key]) ?? fallback;

  return {
    readyOilMin: band('ready_oil_min', DEFAULT_CATEGORY_THRESHOLDS.readyOilMin),
    readyOilMax: band('ready_oil_max', DEFAULT_CATEGORY_THRESHOLDS.readyOilMax),
    readyWaterMin: band('ready_water_min', DEFAULT_CATEGORY_THRESHOLDS.readyWaterMin),
    readyWaterMax: band('ready_water_max', DEFAULT_CATEGORY_THRESHOLDS.readyWaterMax),
    anomalyWaterLow: band('anomaly_water_low', DEFAULT_CATEGORY_THRESHOLDS.anomalyWaterLow),
    anomalyWaterHigh: band('anomaly_water_high', DEFAULT_CATEGORY_THRESHOLDS.anomalyWaterHigh),
    normalOilMax: band('normal_oil_max', DEFAULT_CATEGORY_THRESHOLDS.normalOilMax),
    normalWaterMax: band('normal_water_max', DEFAULT_CATEGORY_THRESHOLDS.normalWaterMax),
  };
}

export function toVarietyWindowLike(row: Record<string, unknown>): VarietyWindowLike {
  return {
    variety: String(row.variety ?? ''),
    start_dm: String(row.start_dm ?? ''),
    end_dm: String(row.end_dm ?? ''),
  };
}

/**
 * Postgres NUMERIC arrives as a string over PostgREST. Coerce once here rather
 * than leaving every comparison in the logic to guess.
 */
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
