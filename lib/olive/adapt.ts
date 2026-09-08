/**
 * Adapters between API payload shapes and the pure logic module.
 *
 * lib/olive/logic.ts deliberately knows nothing about how the data is stored —
 * it takes flat PlotLike / NirLike values. These functions do the flattening in
 * one place so the dashboard, the plot list and any future screen agree on it.
 */

import type { NirLike, PlotLike, VarietyWindowLike, WeatherDayLike } from './logic';

/** An `areas` row joined with its olive_plot_details, as /api/olive returns it. */
export interface ApiPlot {
  id: string;
  name: string | null;
  variety: string | null;
  planting_time: string | null;
  size: number | null;
  details?: {
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
  } | null;
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

export function toWeatherDayLike(row: Record<string, unknown>): WeatherDayLike {
  return {
    entry_date: String(row.entry_date),
    rain_mm: numeric(row.rain_mm),
    wind_kmh: numeric(row.wind_kmh),
    is_manual: Boolean(row.is_manual),
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
