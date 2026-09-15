'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/ui/table-pagination';
import { PlotDetailSheet } from './PlotDetailSheet';
import { PlotsToolbar } from './PlotsToolbar';
import { PlotsTable } from './PlotsTable';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useRowFlash } from '@/hooks/useRowFlash';
import { useTableSort } from '@/hooks/useTableSort';
import { classifyPlotCategory } from '@/lib/olive/logic';
import { toNirLike, toCategoryThresholds, type ApiPlot } from '@/lib/olive/adapt';
import {
  EMPTY_PLOT_FILTERS,
  filterPlotRows,
  hasActivePlotFilters,
  sortPlotRows,
  toPlotRow,
  type PlotFilters,
  type PlotRow,
  type PlotSortField,
} from '@/lib/olive/plot-rows';
import type { ParameterRule } from '@/types/database';

/**
 * The plot list.
 *
 * This was a nested accordion — plots grouped by grower type, each one a card
 * you had to open to see anything, with a single case-sensitive search over the
 * lot and no way to order them. Everything the rows were scored on (the latest
 * oil and water, the days since that reading, the yield band) was computed and
 * then thrown away behind a grey pill.
 *
 * It is a table now: the grower type is a column and a filter rather than a
 * grouping, the measurements are visible and sortable, and "which plots have
 * not been measured in three weeks" is one click on a column header.
 *
 * ~45 plots, so filtering, sorting and paging are all client-side.
 */

interface DashboardPayload {
  plots: ApiPlot[];
  latestNir: Record<string, unknown>;
  yieldEstimates: Record<string, { kg_per_dunam?: unknown }>;
  harvestedAreaIds: string[];
  parameterRules: ParameterRule[];
  categoryThresholds: Record<string, unknown> | null;
  /** The active season. A yield estimate cannot be written without one. */
  season: { id: string; name: string } | null;
}

// Module-level so the stacked forms' memos do not see a new identity on every
// render of this page — an inline [] or {} would bust them on each keystroke.
const NO_RULES: ParameterRule[] = [];
const NO_PLOTS: ApiPlot[] = [];
const NO_ESTIMATES: Record<string, { kg_per_dunam?: unknown }> = {};

const SORT_DEFAULT_DIRECTIONS: Partial<Record<PlotSortField, 'asc' | 'desc'>> = {
  name: 'asc',
  growerName: 'asc',
  region: 'asc',
  category: 'asc',
};

export function OlivePlotsContent() {
  const { data, loading, error, refetch } = useApiData<DashboardPayload>('/api/olive/dashboard');
  const [filters, setFilters] = useState<PlotFilters>(EMPTY_PLOT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { flashId, arm, commit } = useRowFlash();

  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    if (!data) return [];
    const harvested = new Set(data.harvestedAreaIds || []);
    const bands = toCategoryThresholds(data.categoryThresholds);

    return (data.plots || []).map((plot) => {
      const nir = toNirLike(data.latestNir?.[plot.id] as never);
      return toPlotRow({
        plot,
        nir,
        category: classifyPlotCategory(nir, data.parameterRules || [], bands),
        harvested: harvested.has(plot.id),
        yieldEstimate: data.yieldEstimates?.[plot.id] ?? null,
        now,
      });
    });
  }, [data, now]);

  // Derived, not a snapshot: a reading saved from the drawer stacked on top of
  // the plot drawer moves this plot's category and last-measured, and the stat
  // cards in that drawer read them from here. The id is stable across a
  // refetch, so the drawer itself does not remount.
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  // Arm, do not flash. A save reaches here while the drawer is still covering
  // the table — and a create-save from the drawer stacked on top of it leaves
  // that one open for the next reading, so this can fire several times before
  // anything closes.
  const handleSaved = useCallback(() => {
    arm(selectedId);
    return refetch();
  }, [arm, refetch, selectedId]);

  // Both conditions carry weight: without the first the flash plays behind the
  // closing drawer, without the second it plays under the refetch's dim.
  useEffect(() => {
    if (selectedId === null && !loading) commit();
  }, [selectedId, loading, commit]);

  const { sort, toggle } = useTableSort<PlotSortField>('name', 'asc', SORT_DEFAULT_DIRECTIONS);

  const visibleRows = useMemo(
    () => sortPlotRows(filterPlotRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const pagination = usePagination(visibleRows, {
    pageSize: 50,
    resetKey: [
      filters.search,
      filters.plotType,
      filters.category,
      filters.harvest,
      filters.nir,
      sort.field,
      sort.direction,
    ].join('|'),
  });

  // The `&& !data` guard matters: refetch() after saving the details dialog
  // would otherwise blank the whole screen for the length of the request.
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="olive-card overflow-hidden">
        <PlotsToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onClear={() => setFilters(EMPTY_PLOT_FILTERS)}
          shown={visibleRows.length}
          total={rows.length}
        />

        {visibleRows.length === 0 ? (
          <EmptyState
            filtered={hasActivePlotFilters(filters)}
            onClear={() => setFilters(EMPTY_PLOT_FILTERS)}
          />
        ) : (
          <div
            aria-busy={loading}
            className={loading ? 'opacity-60 transition-opacity' : undefined}
          >
            <PlotsTable
              rows={pagination.pageItems}
              sort={sort}
              onSort={toggle}
              onEdit={(row: PlotRow) => setSelectedId(row.id)}
              activeId={selectedId}
              flashId={flashId}
            />
            <TablePagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              total={pagination.total}
              from={pagination.from}
              to={pagination.to}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="חלקות"
            />
          </div>
        )}
      </section>

      {/*
        The plot's own screen. The details form inside it has existed all along
        with nothing able to open it — the old state setter was never called
        with a plot, so it was unreachable code.
      */}
      <PlotDetailSheet
        row={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        rules={data?.parameterRules ?? NO_RULES}
        plots={data?.plots ?? NO_PLOTS}
        estimates={data?.yieldEstimates ?? NO_ESTIMATES}
        seasonId={data?.season?.id ?? null}
        onSaved={handleSaved}
      />
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <MapPin className="text-muted-foreground/40 size-8" />
      {filtered ? (
        <>
          <p className="olive-muted text-sm">לא נמצאו חלקות התואמות לסינון</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            נקה סינון
          </Button>
        </>
      ) : (
        <p className="olive-muted text-sm">אין חלקות זית ללקוח זה</p>
      )}
    </div>
  );
}
