'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Tractor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { TablePagination } from '@/components/ui/table-pagination';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useTableSort } from '@/hooks/useTableSort';
import { showToast } from '@/lib/toast';
import type { Season } from '@/types/database';
import type { ApiPlot } from '@/lib/olive/adapt';
import {
  EMPTY_HARVEST_FILTERS,
  filterHarvestRows,
  hasActiveHarvestFilters,
  sortHarvestRows,
  toHarvestRow,
  type HarvestFilters,
  type HarvestRow,
  type HarvestSortField,
} from '@/lib/olive/harvest-rows';
import { HarvestFormSheet, type HarvestEditorState } from './HarvestFormSheet';
import { HarvestLogToolbar } from './HarvestLogToolbar';
import { HarvestLogTable } from './HarvestLogTable';

/**
 * The harvest log.
 *
 * The screen used to be the entry form with the log bolted underneath it, so
 * reaching the passes already recorded meant scrolling past a form you had
 * already used. It is the other way round now: the log is the page, and the
 * form opens over it in a drawer — for a new pass, or pre-filled for one
 * already recorded.
 *
 * Filtering, sorting and paging are all client-side over one season's rows.
 * The season is the only control that goes back to the server.
 */

interface HarvestPayload {
  reports: Record<string, unknown>[];
  season: Season | null;
  scope: 'season' | 'all';
  truncated: boolean;
}

interface YieldPayload {
  estimates: Record<string, { kg_per_dunam?: unknown }>;
}

const SORT_DEFAULT_DIRECTIONS: Partial<Record<HarvestSortField, 'asc' | 'desc'>> = {
  areaName: 'asc',
};

const NO_ESTIMATES: Record<string, { kg_per_dunam?: unknown }> = {};

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function HarvestPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  // Lazy initial state rather than an effect, so a deep link opens the drawer on
  // the first render with nothing to reconcile afterwards.
  const [editor, setEditor] = useState<HarvestEditorState | null>(
    initialAreaId ? { mode: 'create', areaId: initialAreaId } : null
  );
  const [seasonId, setSeasonId] = useState<string>('');
  const [filters, setFilters] = useState<HarvestFilters>(() =>
    initialAreaId ? { ...EMPTY_HARVEST_FILTERS, areaId: initialAreaId } : EMPTY_HARVEST_FILTERS
  );
  const [pendingDelete, setPendingDelete] = useState<HarvestRow | null>(null);

  // Reference data. None of it changes while the screen is open.
  const { data: plots, loading: plotsLoading } = useApiData<ApiPlot[]>('/api/olive/plots');
  const { data: seasons } = useApiData<Season[]>('/api/olive/seasons');
  // Only the planned per-dunam figure, and only for the drawer's live readout.
  const { data: yieldData } = useApiData<YieldPayload>('/api/olive/yield');

  // The log itself. Not useApiData: that flips `loading` on every url change,
  // which is the full-table spinner this screen is meant to avoid, and it has
  // no race guard for someone toggling the season twice quickly.
  const [payload, setPayload] = useState<HarvestPayload | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchReports = useCallback(
    async (showLoader = false) => {
      const id = ++requestId.current;
      if (showLoader) setReportsLoading(true);
      try {
        const query = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : '';
        const response = await fetch(`/api/olive/harvest${query}`);
        if (!response.ok) throw new Error('שגיאה בטעינת דוחות המסיק');
        const data: HarvestPayload = await response.json();
        if (id !== requestId.current) return; // a newer request already won
        setPayload(data);
        setError(null);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(messageOf(err, 'שגיאה בטעינת הנתונים'));
      } finally {
        if (id === requestId.current) setReportsLoading(false);
      }
    },
    [seasonId]
  );

  useEffect(() => {
    fetchReports(true);
  }, [fetchReports]);

  // Adopt whichever season the server resolved, so the picker shows what is
  // actually on screen rather than an empty box.
  useEffect(() => {
    if (!seasonId && payload) setSeasonId(payload.season?.id ?? 'all');
  }, [payload, seasonId]);

  // Consume the deep link once. Empty deps on purpose: with initialAreaId in
  // them this re-runs and loops.
  useEffect(() => {
    if (initialAreaId) window.history.replaceState(null, '', '/olive/harvest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estimates = yieldData?.estimates ?? NO_ESTIMATES;

  const taktNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const plot of plots ?? []) {
      for (const takt of plot.takts ?? []) map.set(takt.id, takt.name);
    }
    return map;
  }, [plots]);

  const plotOptions = useMemo(
    () =>
      (plots ?? []).map((p) => ({
        value: p.id,
        label: [p.name, p.variety].filter(Boolean).join(' · '),
      })),
    [plots]
  );

  const rows = useMemo(
    () => (payload?.reports ?? []).map((report) => toHarvestRow(report, taktNameById)),
    [payload, taktNameById]
  );

  const { sort, toggle } = useTableSort<HarvestSortField>(
    'reportDate',
    'desc',
    SORT_DEFAULT_DIRECTIONS
  );

  const visibleRows = useMemo(
    () => sortHarvestRows(filterHarvestRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const pagination = usePagination(visibleRows, {
    resetKey: [
      filters.search,
      filters.areaId,
      filters.harvester,
      filters.finality,
      sort.field,
      sort.direction,
      seasonId,
    ].join('|'),
  });

  /** Season totals — the numbers the log is actually kept for. */
  const totals = useMemo(() => {
    let fruit = 0;
    let oil = 0;
    let dunam = 0;
    for (const row of visibleRows) {
      fruit += row.fruitKg ?? 0;
      oil += row.oilKg ?? 0;
      dunam += row.areaDoneDunam ?? 0;
    }
    return { fruit, oil, dunam, oilPercent: fruit > 0 ? (oil / fruit) * 100 : null };
  }, [visibleRows]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      const response = await fetch(`/api/olive/harvest?id=${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה במחיקה');
      }
      showToast.success('הדוח נמחק');
      if (editor?.mode === 'edit' && editor.row.id === pendingDelete.id) setEditor(null);
      await fetchReports();
    } catch (err) {
      showToast.error(messageOf(err, 'שגיאה במחיקה'));
    }
  };

  // The first load only. After that the rows stay on screen while refetching.
  const firstLoad = plotsLoading || (reportsLoading && !payload);

  if (firstLoad) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  const seasonLabel =
    payload?.scope === 'season' && payload.season ? `עונת ${payload.season.name}` : 'כל העונות';

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Tractor}
        title="רישום מסיק"
        description={`יומן מעברי מסיק — ${seasonLabel}`}
      >
        <Button type="button" onClick={() => setEditor({ mode: 'create', areaId: null })}>
          <Plus className="ml-1 size-4" />
          מעבר חדש
        </Button>
      </PageHeader>

      {error && (
        <div className="olive-error-banner flex items-center gap-3 p-4">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {payload?.truncated && (
        <div className="olive-error-banner flex items-center gap-3 p-4">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            מוצגים המעברים האחרונים בלבד — יש יותר מעברים בטווח שנבחר. צמצם את הטווח כדי לראות את
            כולם.
          </p>
        </div>
      )}

      {/* Totals for whatever is currently filtered in — the season's bottom line. */}
      {visibleRows.length > 0 && (
        <div className="olive-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Total label="מעברים" value={String(visibleRows.length)} />
          <Total label="שטח שנמסק (דונם)" value={totals.dunam.toFixed(1)} />
          <Total label="סה״כ פרי (ק״ג)" value={totals.fruit.toFixed(0)} />
          <Total
            label="סה״כ שמן (ק״ג)"
            value={totals.oil.toFixed(0)}
            hint={totals.oilPercent !== null ? `${totals.oilPercent.toFixed(1)}% מהפרי` : undefined}
          />
        </div>
      )}

      <section className="olive-card overflow-hidden">
        <HarvestLogToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onClear={() => setFilters(EMPTY_HARVEST_FILTERS)}
          plotOptions={plotOptions}
          seasons={seasons ?? []}
          seasonId={seasonId}
          onSeasonChange={setSeasonId}
          seasonLoading={reportsLoading}
          shown={visibleRows.length}
          total={rows.length}
        />

        {visibleRows.length === 0 ? (
          <EmptyState
            filtered={hasActiveHarvestFilters(filters)}
            onClear={() => setFilters(EMPTY_HARVEST_FILTERS)}
            onCreate={() => setEditor({ mode: 'create', areaId: null })}
          />
        ) : (
          <div
            aria-busy={reportsLoading}
            className={reportsLoading ? 'opacity-60 transition-opacity' : undefined}
          >
            <HarvestLogTable
              rows={pagination.pageItems}
              sort={sort}
              onSort={toggle}
              onEdit={(row) => setEditor({ mode: 'edit', row })}
              onDelete={setPendingDelete}
              activeId={editor?.mode === 'edit' ? editor.row.id : null}
              now={new Date()}
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
              itemLabel="מעברים"
            />
          </div>
        )}
      </section>

      <HarvestFormSheet
        editor={editor}
        onOpenChange={(open) => !open && setEditor(null)}
        plots={plots ?? []}
        estimates={estimates}
        onSaved={fetchReports}
      />

      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="מחיקת דוח מסיק"
        description={
          pendingDelete
            ? `למחוק את מעבר ${pendingDelete.passNumber ?? ''} מתאריך ${pendingDelete.reportDate ?? '—'} בחלקה ${pendingDelete.areaName || '—'}? המעברים הבאים בחלקה לא ימוספרו מחדש. פעולה זו אינה ניתנת לביטול.`
            : ''
        }
        confirmText="מחק"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="olive-muted text-xs font-semibold">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {hint && <div className="olive-muted text-xs">{hint}</div>}
    </div>
  );
}

function EmptyState({
  filtered,
  onClear,
  onCreate,
}: {
  filtered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <Tractor className="text-muted-foreground/40 size-8" />
      {filtered ? (
        <>
          <p className="olive-muted text-sm">לא נמצאו מעברים התואמים לסינון</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            נקה סינון
          </Button>
        </>
      ) : (
        <>
          <p className="olive-muted text-sm">אין מעברי מסיק עדיין</p>
          <Button type="button" onClick={onCreate}>
            <Plus className="ml-1 size-4" />
            מעבר חדש
          </Button>
        </>
      )}
    </div>
  );
}
