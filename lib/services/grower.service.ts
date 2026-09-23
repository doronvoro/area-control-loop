import { PlotType } from '@/types/database';

/**
 * Grower writes, and the plot roll-up the list shows beside each one.
 *
 * Both halves are pure, so the route stays thin and the field whitelist is
 * testable — the same split lib/services/customer.service.ts uses.
 */

/** Everything a client may write. `name` and `customer_id` are set by the route. */
const PROFILE_FIELDS = [
  'contact_person',
  'contact_phone',
  'contact_mobile',
  'contact_email',
  'address',
  'city',
  'business_id',
  'notes',
] as const;

const GROWER_TYPES: string[] = Object.values(PlotType);

/** Is this a code the grower_type CHECK will accept? */
export function isGrowerType(value: unknown): boolean {
  return typeof value === 'string' && GROWER_TYPES.includes(value);
}

/**
 * '' to null.
 *
 * Every text field arrives from a react-hook-form input, which yields '' for
 * "not filled in" — storing that would make `city IS NULL` and `city = ''` both
 * mean "no city".
 */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The column set a create or update writes.
 *
 * Only keys actually present in the body are copied, so a partial patch stays
 * partial; `id`, `customer_id` and `created_at` are never copied, so a client
 * cannot move a grower to another tenant by sending one.
 */
export function buildGrowerWrite(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of PROFILE_FIELDS) {
    if (field in body) patch[field] = text(body[field]);
  }
  if ('grower_type' in body) {
    patch.grower_type = isGrowerType(body.grower_type) ? body.grower_type : null;
  }
  if ('is_active' in body) patch.is_active = body.is_active !== false;

  return patch;
}

/**
 * The alias list a client sent, cleaned up.
 *
 * Trimmed, blanks dropped, duplicates collapsed keeping first position, so the
 * order the operator typed survives a round trip. Anything that is not an array
 * of strings yields [] rather than throwing — the field is optional, and a
 * malformed one must not take the rest of the save down with it.
 *
 * Case is NOT folded. Hebrew has no case, and folding would make "Gashur" and
 * "gashur" the same alias in a tenant that uses both for different bodies.
 */
export function normaliseAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * What to insert and what to remove to turn `current` into `next`.
 *
 * A diff rather than delete-all-then-insert: the alias rows are what the import
 * resolver reads, and a save that briefly empties them would let a concurrent
 * import create the very grower the alias exists to prevent.
 */
export function diffAliases(
  current: string[],
  next: string[]
): { added: string[]; removed: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  return {
    added: next.filter((alias) => !currentSet.has(alias)),
    removed: current.filter((alias) => !nextSet.has(alias)),
  };
}

export interface GrowerPlotStats {
  count: number;
  dunam: number;
}

/**
 * Plot count and total area per grower id.
 *
 * Takes the plots the CALLER can see (getOlivePlots over the tenant's own
 * areas), so a plot shared with another tenant is counted for whoever is asking
 * rather than for whichever grower row the backfill happened to link it to.
 *
 * `size` is NUMERIC, which PostgREST sends as a string — summing it raw would
 * concatenate. Plots with no grower are skipped rather than bucketed under a
 * null key; the list only renders rows that exist in `growers`.
 */
export function summarisePlotsByGrower(
  plots: { details?: { grower_id?: string | null } | null; size?: unknown }[]
): Map<string, GrowerPlotStats> {
  const summary = new Map<string, GrowerPlotStats>();

  for (const plot of plots) {
    const growerId = plot.details?.grower_id;
    if (!growerId) continue;

    const size = Number(plot.size);
    const stats = summary.get(growerId) ?? { count: 0, dunam: 0 };
    stats.count += 1;
    if (Number.isFinite(size)) stats.dunam += size;
    summary.set(growerId, stats);
  }

  // Rounded once, here, rather than in the cell: a sum of two-decimal NUMERICs
  // lands on values like 734.2999999999998, and every consumer would otherwise
  // have to know that.
  for (const stats of summary.values()) {
    stats.dunam = Math.round(stats.dunam * 10) / 10;
  }

  return summary;
}
