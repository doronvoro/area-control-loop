import type { PlotCategory } from './logic';

/**
 * The crop that switches the olive module on.
 *
 * Everything olive-scoped keys off this rather than off a customer id, so the
 * next olive grower needs no code change. It gates the nav in /api/user/me and
 * filters every olive query, so a pest-management area can never appear in a
 * plot picker or be counted on the harvest dashboard.
 */
export const OLIVE_CROP_NAME = 'זית';

/**
 * Takt names follow supabase/seed/olive_demo_seed.sql, which is also what the
 * NIR and harvest pickers display: טאקט 1, טאקט 2, …
 *
 * Shared rather than local to the importer because two paths now create takts —
 * the backup import and the plot-create drawer — and a plot whose takts are
 * named differently from every other plot's is a picker full of near-duplicates.
 */
export function taktName(index: number): string {
  return `טאקט ${index}`;
}

/**
 * Upper bound on takt_count, matching the database.
 *
 * olive_plot_details_takt_count_check is
 * `takt_count IS NULL OR (takt_count >= 1 AND takt_count <= 10)`. A looser
 * limit is not a guard, only a delay: the details upsert would reject the row
 * while the takt loop happily created the sub_areas.
 */
export const MAX_TAKT_COUNT = 10;

/**
 * Fallback bands for the four status cards.
 *
 * These are the prototype's own defaults, as its backup export writes them
 * under `categoryThresholds`. The live values are a row in
 * plot_category_thresholds — a backup import overwrites it with whatever the
 * client tuned — and this is only what the UI falls back to when that row is
 * missing, so the dashboard never silently classifies against zeros.
 *
 * Kept in step with the seed in
 * 20260915100000_create_olive_category_thresholds.sql. Change both together.
 */
export const DEFAULT_CATEGORY_THRESHOLDS = {
  readyOilMin: 18,
  readyOilMax: 24,
  readyWaterMin: 51,
  readyWaterMax: 54,
  anomalyWaterLow: 50,
  anomalyWaterHigh: 60,
  normalOilMax: 17,
  normalWaterMax: 60,
} as const;

/**
 * The four status cards, in the order /olive shows them.
 *
 * Shared rather than local to the dashboard because the settings dialog's
 * preview strip has to be recognisably the same four cards — same labels, same
 * colours, same order. Two copies would drift the moment one label changed, and
 * a preview that disagrees with the thing it previews is worse than none.
 */
export const PLOT_CATEGORY_CARDS: { key: PlotCategory; label: string; className: string }[] = [
  { key: 'testing', label: 'בבדיקות', className: 'olive-sc-testing' },
  { key: 'normal', label: 'חלקות תקינות', className: 'olive-sc-normal' },
  { key: 'anomaly', label: 'חריגות', className: 'olive-sc-anomaly' },
  { key: 'ready', label: 'מוכן למסיק', className: 'olive-sc-ready' },
];
