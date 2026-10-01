/**
 * The varieties grid's row model, and the pure filter/sort over it.
 *
 * Same boundary as lib/growers/grower-rows.ts: the API's rows are coerced here
 * (counts and the NUMERIC dunam sum are not trusted to be numbers), and
 * everything below is pure so it tests without a DOM.
 */

import type { SortState } from '@/components/ui/sortable-table-head';

export interface VarietyRow {
  id: string;
  name: string;
  /**
   * Other spellings folded into this variety, e.g. "ארבקינה צעיר". Searchable,
   * so looking up an absorbed spelling still finds the variety that holds it.
   */
  aliases: string[];
  /** Olive plots of the asking tenant with this variety. */
  plotCount: number;
  totalDunam: number;
  /** Harvest windows (global) defined for this variety. */
  windowCount: number;
}

export type VarietySortField = 'name' | 'plotCount' | 'totalDunam' | 'windowCount';

export interface VarietyFilters {
  search: string;
  /** 'all' | 'with' (has plots) | 'without'. */
  plots: string;
}

export const EMPTY_VARIETY_FILTERS: VarietyFilters = { search: '', plots: 'all' };

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toVarietyRow(raw: Record<string, unknown>): VarietyRow {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
    plotCount: toNumber(raw.plot_count),
    totalDunam: toNumber(raw.total_dunam),
    windowCount: toNumber(raw.window_count),
  };
}

export function hasActiveVarietyFilters(filters: VarietyFilters): boolean {
  return filters.search.trim() !== '' || (filters.plots !== 'all' && filters.plots !== '');
}

export function filterVarietyRows(rows: VarietyRow[], filters: VarietyFilters): VarietyRow[] {
  const term = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.plots === 'with' && row.plotCount === 0) return false;
    if (filters.plots === 'without' && row.plotCount > 0) return false;
    if (!term) return true;
    return [row.name, ...row.aliases].some((name) => name.toLowerCase().includes(term));
  });
}

export function sortVarietyRows(
  rows: VarietyRow[],
  sort: SortState<VarietySortField>
): VarietyRow[] {
  const dir = sort.direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.field === 'name') return a.name.localeCompare(b.name, 'he') * dir;
    const diff = (a[sort.field] - b[sort.field]) * dir;
    // Ties fall back to the name, so equal counts do not shuffle between loads.
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'he');
  });
}
