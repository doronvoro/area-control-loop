/**
 * Pure helpers for /api/varieties. No database access here, so they unit-test
 * without a client — the same split as lib/services/grower.service.ts, whose
 * diffAliases this reuses.
 */
import { normalizeVarietyName } from '@/lib/olive/variety';

export { diffAliases } from '@/lib/services/grower.service';

/**
 * The alias list as the client sent it, cleaned: normalised the way the
 * database will store it, blanks dropped, duplicates removed, order kept.
 *
 * Not grower.service's normaliseAliases: that one only trims, and a variety
 * alias is compared after NFC + whitespace collapse (variety_normalize), so two
 * spellings the trigger treats as one must also be one here.
 */
export function normaliseVarietyAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const name = normalizeVarietyName(entry);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export interface VarietyPlotStats {
  count: number;
  dunam: number;
}

/** Plot count and total area per variety_id, over the caller's own plots. */
export function summarisePlotsByVariety(
  plots: { variety_id?: string | null; size?: unknown }[]
): Map<string, VarietyPlotStats> {
  const summary = new Map<string, VarietyPlotStats>();

  for (const plot of plots) {
    const varietyId = plot.variety_id;
    if (!varietyId) continue;

    const size = Number(plot.size);
    const stats = summary.get(varietyId) ?? { count: 0, dunam: 0 };
    stats.count += 1;
    if (plot.size != null && Number.isFinite(size)) stats.dunam += size;
    summary.set(varietyId, stats);
  }

  return summary;
}
