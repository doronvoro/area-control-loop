'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/ui/table-pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { NirFormSheet, type NirEditorState } from './NirFormSheet';
import { PlotCreateSheet } from './PlotCreateSheet';
import type { GrowerOption } from './GrowerPicker';
import { PlotDetailSheet } from './PlotDetailSheet';
import { PlotsToolbar } from './PlotsToolbar';
import { PlotsTable } from './PlotsTable';
import { useUser } from '@/components/providers/UserProvider';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useRowFlash } from '@/hooks/useRowFlash';
import { useTableSort } from '@/hooks/useTableSort';
import { classifyPlotCategory } from '@/lib/olive/logic';
import {
  toNirLike,
  toCategoryThresholds,
  type ApiNirReport,
  type ApiPlot,
} from '@/lib/olive/adapt';
import { toNirRow } from '@/lib/olive/nir-rows';
import { showToast } from '@/lib/toast';
import {
  EMPTY_PLOT_FILTERS,
  filterPlotRows,
  hasActivePlotFilters,
  nextOilWaterSort,
  plotTypeCounts,
  sortPlotRows,
  summarisePlotRows,
  toPlotRow,
  type PlotFilters,
  type PlotRow,
  type PlotSortField,
} from '@/lib/olive/plot-rows';
import { NONE } from '@/lib/forms/none-sentinel';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';
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
  /** Readings per plot IN THE SEASON, keyed by area id. Absent means none. */
  nirCountByArea?: Record<string, number>;
}

// Module-level so the stacked forms' memos do not see a new identity on every
// render of this page — an inline [] or {} would bust them on each keystroke.
const NO_RULES: ParameterRule[] = [];
const NO_PLOTS: ApiPlot[] = [];
const NO_ESTIMATES: Record<string, { kg_per_dunam?: unknown }> = {};
const NO_GROWERS: GrowerOption[] = [];

const SORT_DEFAULT_DIRECTIONS: Partial<Record<PlotSortField, 'asc' | 'desc'>> = {
  name: 'asc',
  growerName: 'asc',
  category: 'asc',
};

export function OlivePlotsContent({ initialSearch = null }: { initialSearch?: string | null }) {
  const { data, loading, error, refetch } = useApiData<DashboardPayload>('/api/olive/dashboard');
  // A second, small request rather than widening the dashboard payload: the
  // growers list is only needed by the two drawers, and the dashboard is fetched
  // on every save.
  const { data: growerData } = useApiData<{ id: string; name: string }[]>('/api/growers');
  // Lazy initial state rather than an effect, so arriving from the growers page
  // renders filtered on the first paint instead of flashing the full list.
  const [filters, setFilters] = useState<PlotFilters>(
    initialSearch ? { ...EMPTY_PLOT_FILTERS, search: initialSearch } : EMPTY_PLOT_FILTERS
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The NIR form, opened from a row's flask over this table. Separate from the
  // one PlotDetailSheet stacks on itself: this one has no drawer underneath.
  const [nirEditor, setNirEditor] = useState<NirEditorState | null>(null);
  // The create drawer. Its own state rather than a mode of `selectedId`, for the
  // same reason nirEditor has its own: it is a different component over the same
  // table, not another way of opening the plot drawer.
  const [createOpen, setCreateOpen] = useState(false);
  const { flash, arm, commit } = useRowFlash();

  const { user } = useUser();
  /**
   * An admin scoped to nothing cannot create a plot: customer_areas is the only
   * thing that would make it reachable, and there is no tenant to link it to.
   * SelectCustomerBanner already says so at the top of the page, so this only
   * has to not offer the button.
   */
  const canCreate = !(user?.isAdmin && !user.selectedCustomer);

  // Consume the deep link once, so a reload or a cleared search box does not
  // resurrect the filter. Empty deps on purpose: with initialSearch in them this
  // would re-fire whenever the prop identity changed.
  useEffect(() => {
    if (initialSearch) window.history.replaceState(null, '', '/olive/plots');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const growers = useMemo<GrowerOption[]>(
    () => (growerData ?? []).map((g) => ({ id: g.id, name: g.name })),
    [growerData]
  );

  /**
   * The grower filter's options. Derived from `growers` rather than from
   * growerData again, so the drawers' list and the filter's cannot drift.
   *
   * No explicit "all" entry: SearchableSelect shows its placeholder when the
   * value is '' and its clear-X only when it is not, so an "all" item would be
   * a second spelling of one state.
   */
  const growerOptions = useMemo<SearchableSelectOption[]>(
    () => [
      ...growers.map((g) => ({ value: g.id, label: g.name })),
      { value: NONE, label: 'ללא מגדל' },
    ],
    [growers]
  );

  const now = useMemo(() => new Date(), []);

  // Same map NirPageContent builds, for the same reason: toNirRow resolves a
  // reading's sub_area_id to a takt name through it.
  const taktNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const plot of data?.plots ?? []) {
      for (const takt of plot.takts ?? []) map.set(takt.id, takt.name);
    }
    return map;
  }, [data]);

  /**
   * Open the plot's latest reading, from the שמן / מים cell.
   *
   * The row carries the measurements but not the reading, so the raw report is
   * looked up here rather than parked on PlotRow — one object per plot that only
   * this handler would ever read.
   */
  const openLatestNir = useCallback(
    (row: PlotRow) => {
      const latest = data?.latestNir?.[row.id];
      if (!latest) return;
      setNirEditor({ mode: 'edit', row: toNirRow(latest as never, taktNameById) });
    },
    [data, taktNameById]
  );

  /**
   * The client's tuned category bands. Hoisted out of the `rows` memo below
   * because the table quotes them in the tooltip that explains each category
   * pill — the same row that classified the plots has to be the one the
   * explanation is written from.
   */
  const bands = useMemo(() => toCategoryThresholds(data?.categoryThresholds), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const harvested = new Set(data.harvestedAreaIds || []);

    return (data.plots || []).map((plot) => {
      const latest = data.latestNir?.[plot.id] as ApiNirReport | undefined;
      const nir = toNirLike(latest);
      return toPlotRow({
        plot,
        nir,
        nirSentToClientAt: latest?.detail?.sent_to_client_at ?? null,
        nirCountInSeason: data.nirCountByArea?.[plot.id] ?? 0,
        category: classifyPlotCategory(nir, data.parameterRules || [], bands),
        harvested: harvested.has(plot.id),
        yieldEstimate: data.yieldEstimates?.[plot.id] ?? null,
        now,
      });
    });
  }, [data, bands, now]);

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
    arm(selectedId, 'saved');
    return refetch();
  }, [arm, refetch, selectedId]);

  /**
   * Closing arms too, so you always get the row back after the drawer covers
   * the table — but as a release, not as a save. `arm` keeps a pending 'saved'
   * over the 'released' that follows it, so a save-then-close still announces
   * the save.
   */
  const handleClose = useCallback(() => {
    arm(selectedId, 'released');
    setSelectedId(null);
  }, [arm, selectedId]);

  /**
   * A NIR reading saved from a row's flask. It moves that plot's category and
   * last-measured, so the table refetches — but the flash is armed on the plot
   * that was measured, not on `selectedId`, which is null in this flow.
   */
  const handleNirSaved = useCallback(() => {
    arm(nirEditor?.mode === 'create' ? nirEditor.areaId : null, 'saved');
    return refetch();
  }, [arm, nirEditor, refetch]);

  /**
   * A plot just created. The row does not exist until the refetch lands, so the
   * flash is armed on its id and the drawer is deliberately NOT reopened on it:
   * `selected` is derived from `rows`, so opening it here would hand
   * PlotDetailSheet a null row for one render.
   */
  const handleCreated = useCallback(
    (areaId: string) => {
      arm(areaId || null, 'saved');
      return refetch();
    },
    [arm, refetch]
  );

  /**
   * The yield estimate, saved from its cell. It lives in another table keyed by
   * season, hence the second endpoint and the early return: without an active
   * season the write has nowhere to land, and the cell is read-only anyway.
   */
  const seasonId = data?.season?.id ?? null;
  const handleYieldSave = useCallback(
    async (areaId: string, kgPerDunam: number | null) => {
      if (!seasonId) return false;

      try {
        const response = await fetch('/api/olive/yield', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area_id: areaId, season_id: seasonId, kg_per_dunam: kgPerDunam }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'שגיאה בשמירה');
        }
        showToast.success('הערכת היבול נשמרה');
        arm(areaId, 'saved');
        await refetch();
        return true;
      } catch (err) {
        showToast.error(err instanceof Error && err.message ? err.message : 'שגיאה בשמירה');
        return false;
      }
    },
    [arm, refetch, seasonId]
  );

  // Every condition carries weight: without the first the flash plays behind the
  // closing plot drawer, without the second behind the NIR drawer — which stays
  // open after a create-save, for the next reading — without the third behind
  // the create drawer, and without the last it plays under the refetch's dim.
  useEffect(() => {
    if (selectedId === null && nirEditor === null && !createOpen && !loading) commit();
  }, [selectedId, nirEditor, createOpen, loading, commit]);

  const { sort, toggle, setSort } = useTableSort<PlotSortField>(
    'name',
    'asc',
    SORT_DEFAULT_DIRECTIONS
  );

  // The updater form, so the cycle reads the live sort without `sort` in the
  // deps handing out a new callback on every sort change.
  const cycleOilWater = useCallback(() => setSort(nextOilWaterSort), [setSort]);

  const visibleRows = useMemo(
    () => sortPlotRows(filterPlotRows(rows, filters), sort),
    [rows, filters, sort]
  );

  // Over every row the filters let through, not over the page the table draws:
  // a total that moves when you turn the page is not a total.
  const summary = useMemo(() => summarisePlotRows(visibleRows), [visibleRows]);

  // What each grower-type chip shows. One extra filter pass over ~45 rows per
  // keystroke, which is free, and it keeps the chips honest about the other
  // filters rather than quoting the unfiltered list.
  const typeCounts = useMemo(() => plotTypeCounts(rows, filters), [rows, filters]);

  const pagination = usePagination(visibleRows, {
    pageSize: 50,
    // The whole filter object, not a hand-listed subset: that list was a second
    // place to remember every time a filter was added, and forgetting it leaves
    // you on a page that no longer exists, staring at an empty table.
    // PlotFilters is flat strings and every writer spreads the previous object,
    // so key order — and the serialisation — is stable.
    resetKey: `${JSON.stringify(filters)}|${sort.field}|${sort.direction}`,
  });

  // The `&& !data` guard matters: refetch() after saving the details dialog
  // would otherwise blank the whole screen for the length of the request.
  if (loading && !data) {
    return (
      <>
        <PlotsHeader canCreate={false} onCreate={() => {}} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PlotsHeader canCreate={false} onCreate={() => {}} />
        <div className="py-12 text-center text-destructive">
          <p>{error}</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <PlotsHeader canCreate={canCreate} onCreate={() => setCreateOpen(true)} />

      {/* The panel brings its own surface, so it sits beside the table's card
          rather than inside it. The wrapper's space-y-4 supplies the gap. */}
      <PlotsToolbar
        filters={filters}
        onFiltersChange={setFilters}
        onClear={() => setFilters(EMPTY_PLOT_FILTERS)}
        growerOptions={growerOptions}
        typeCounts={typeCounts}
        shown={visibleRows.length}
        total={rows.length}
        // Arriving from the growers screen lands a term in the search box; open
        // the panel so the shortened list has a visible cause.
        defaultExpanded={Boolean(initialSearch)}
      />

      <section className="olive-card overflow-hidden">
        {visibleRows.length === 0 ? (
          <EmptyState
            filtered={hasActivePlotFilters(filters)}
            canCreate={canCreate}
            onClear={() => setFilters(EMPTY_PLOT_FILTERS)}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <div
            aria-busy={loading}
            className={loading ? 'opacity-60 transition-opacity' : undefined}
          >
            <PlotsTable
              rows={pagination.pageItems}
              summary={summary}
              sort={sort}
              onSort={toggle}
              onEdit={(row: PlotRow) => setSelectedId(row.id)}
              onCycleOilWater={cycleOilWater}
              onOpenNir={openLatestNir}
              onAddNir={(row: PlotRow) => setNirEditor({ mode: 'create', areaId: row.id })}
              bands={bands}
              seasonId={seasonId}
              onYieldSave={handleYieldSave}
              activeId={selectedId}
              flash={flash}
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
        onOpenChange={(open) => !open && handleClose()}
        rules={data?.parameterRules ?? NO_RULES}
        plots={data?.plots ?? NO_PLOTS}
        estimates={data?.yieldEstimates ?? NO_ESTIMATES}
        seasonId={seasonId}
        growers={growers.length ? growers : NO_GROWERS}
        onSaved={handleSaved}
      />

      {/*
        The flask's form. A sibling of the plot drawer, and outside any
        conditional, for the same reason PlotDetailSheet keeps its own stacked
        pair out here: nothing may yank an open drawer mid-animation.

        `lockPlot` because the plot is implied by the row whose flask was
        clicked. Not `stacked` — that narrows the drawer and lightens its scrim
        to keep a drawer underneath visible, and here there is none.
      */}
      <NirFormSheet
        editor={nirEditor}
        onOpenChange={(open) => !open && setNirEditor(null)}
        plots={data?.plots ?? NO_PLOTS}
        rules={data?.parameterRules ?? NO_RULES}
        onSaved={handleNirSaved}
        lockPlot
      />

      {/*
        New plots. The customer is shown, not chosen: it is whichever tenant the
        sidebar switcher is on, because a plot linked to any other one would
        disappear from this table the moment the drawer closed.
      */}
      <PlotCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        customerName={user?.selectedCustomer?.name ?? null}
        growers={growers.length ? growers : NO_GROWERS}
        onSaved={handleCreated}
      />
    </div>
  );
}

function PlotsHeader({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <PageHeader icon={MapPin} title="חלקות זית" description="פרטי חלקות, זנים ועומס יבול">
      <Button
        type="button"
        onClick={onCreate}
        disabled={!canCreate}
        title={canCreate ? undefined : 'בחר לקוח כדי להוסיף חלקה'}
      >
        <Plus className="ml-1 size-4" />
        חלקה חדשה
      </Button>
    </PageHeader>
  );
}

function EmptyState({
  filtered,
  canCreate,
  onClear,
  onCreate,
}: {
  filtered: boolean;
  canCreate: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
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
        <>
          <p className="olive-muted text-sm">אין חלקות זית ללקוח זה</p>
          {canCreate ? (
            <Button type="button" variant="link" size="sm" onClick={onCreate}>
              הוסף חלקה ראשונה
            </Button>
          ) : (
            <p className="olive-muted text-xs">בחר לקוח בתפריט הצדדי כדי להוסיף חלקה</p>
          )}
        </>
      )}
    </div>
  );
}
