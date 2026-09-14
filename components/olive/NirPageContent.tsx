'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FlaskConical, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { TablePagination } from '@/components/ui/table-pagination';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useTableSort } from '@/hooks/useTableSort';
import { showToast } from '@/lib/toast';
import type { ParameterRule, Season } from '@/types/database';
import type { ApiNirReport, ApiPlot } from '@/lib/olive/adapt';
import {
  EMPTY_NIR_FILTERS,
  filterNirRows,
  hasActiveNirFilters,
  sortNirRows,
  toNirRow,
  type NirFilters,
  type NirSortField,
} from '@/lib/olive/nir-rows';
import { NirFormSheet, type NirEditorState } from './NirFormSheet';
import { NirLogToolbar } from './NirLogToolbar';
import { NirLogTable } from './NirLogTable';

/**
 * The NIR log.
 *
 * The screen used to be the entry form with the log bolted underneath it, so
 * reaching your own data meant scrolling past a form you had already used. It
 * is the other way round now: the log is the page, and the form opens over it
 * in a drawer — for a new reading, or pre-filled for one already recorded.
 *
 * Filtering, sorting and paging are all client-side over one season's rows.
 * The season is the only control that goes back to the server.
 */

interface NirPayload {
  reports: ApiNirReport[];
  season: Season | null;
  scope: 'season' | 'all';
  truncated: boolean;
}

const SORT_DEFAULT_DIRECTIONS: Partial<Record<NirSortField, 'asc' | 'desc'>> = {
  areaName: 'asc',
};

const NO_RULES: ParameterRule[] = [];

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function NirPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  // Lazy initial state rather than an effect, so arriving from the plots page
  // opens the drawer on the first render with nothing to reconcile afterwards.
  const [editor, setEditor] = useState<NirEditorState | null>(
    initialAreaId ? { mode: 'create', areaId: initialAreaId } : null
  );
  const [seasonId, setSeasonId] = useState<string>('');
  const [filters, setFilters] = useState<NirFilters>(() =>
    initialAreaId ? { ...EMPTY_NIR_FILTERS, areaId: initialAreaId } : EMPTY_NIR_FILTERS
  );
  const [pendingDelete, setPendingDelete] = useState<ReturnType<typeof toNirRow> | null>(null);

  // Reference data. None of it changes while the screen is open.
  const { data: plots, loading: plotsLoading } = useApiData<ApiPlot[]>('/api/olive/plots');
  const { data: parameters, loading: parametersLoading } = useApiData<{
    parameterRules: ParameterRule[];
  }>('/api/olive/parameters');
  const { data: seasons } = useApiData<Season[]>('/api/olive/seasons');

  // The log itself. Not useApiData: that flips `loading` on every url change,
  // which is the full-table spinner this screen is meant to avoid, and it has
  // no race guard for someone toggling the season twice quickly.
  const [payload, setPayload] = useState<NirPayload | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchReports = useCallback(
    async (showLoader = false) => {
      const id = ++requestId.current;
      if (showLoader) setReportsLoading(true);
      try {
        const query = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : '';
        const response = await fetch(`/api/olive/nir${query}`);
        if (!response.ok) throw new Error('שגיאה בטעינת הבדיקות');
        const data: NirPayload = await response.json();
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
    if (initialAreaId) window.history.replaceState(null, '', '/olive/nir');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A shared empty array, not a fresh `[]`, so the memos below do not
  // recompute on every render while the rules are still loading.
  const rules = parameters?.parameterRules ?? NO_RULES;

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
    () => (payload?.reports ?? []).map((report) => toNirRow(report, taktNameById)),
    [payload, taktNameById]
  );

  const { sort, toggle } = useTableSort<NirSortField>(
    'reportDate',
    'desc',
    SORT_DEFAULT_DIRECTIONS
  );

  const visibleRows = useMemo(() => {
    const filtered = filterNirRows(rows, filters, rules);
    return sortNirRows(filtered, sort, rules);
  }, [rows, filters, rules, sort]);

  const pagination = usePagination(visibleRows, {
    resetKey: [
      filters.search,
      filters.areaId,
      filters.status,
      filters.direction,
      sort.field,
      sort.direction,
      seasonId,
    ].join('|'),
  });

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      const response = await fetch(`/api/olive/nir?id=${pendingDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה במחיקה');
      }
      showToast.success('הבדיקה נמחקה');
      if (editor?.mode === 'edit' && editor.row.id === pendingDelete.id) setEditor(null);
      await fetchReports();
    } catch (err) {
      showToast.error(messageOf(err, 'שגיאה במחיקה'));
    }
  };

  // The first load only. After that the rows stay on screen while refetching.
  const firstLoad = plotsLoading || parametersLoading || (reportsLoading && !payload);

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
        icon={FlaskConical}
        title="בדיקות NIR"
        description={`יומן בדיקות בשלות — ${seasonLabel}`}
      >
        <Button type="button" onClick={() => setEditor({ mode: 'create', areaId: null })}>
          <Plus className="ml-1 size-4" />
          בדיקה חדשה
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
            מוצגות הבדיקות האחרונות בלבד — יש יותר בדיקות בטווח שנבחר. צמצם את הטווח כדי לראות את
            כולן.
          </p>
        </div>
      )}

      <section className="olive-card overflow-hidden">
        <NirLogToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onClear={() => setFilters(EMPTY_NIR_FILTERS)}
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
            filtered={hasActiveNirFilters(filters)}
            onClear={() => setFilters(EMPTY_NIR_FILTERS)}
            onCreate={() => setEditor({ mode: 'create', areaId: null })}
          />
        ) : (
          <div
            aria-busy={reportsLoading}
            className={reportsLoading ? 'opacity-60 transition-opacity' : undefined}
          >
            <NirLogTable
              rows={pagination.pageItems}
              rules={rules}
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
              itemLabel="בדיקות"
            />
          </div>
        )}
      </section>

      <NirFormSheet
        editor={editor}
        onOpenChange={(open) => !open && setEditor(null)}
        plots={plots ?? []}
        rules={rules}
        onSaved={fetchReports}
      />

      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="מחיקת בדיקה"
        description={
          pendingDelete
            ? `למחוק את הבדיקה מתאריך ${pendingDelete.reportDate ?? '—'} בחלקה ${pendingDelete.areaName || '—'}? פעולה זו אינה ניתנת לביטול.`
            : ''
        }
        confirmText="מחק"
        variant="destructive"
        onConfirm={handleDelete}
      />
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
      <FlaskConical className="text-muted-foreground/40 size-8" />
      {filtered ? (
        <>
          <p className="olive-muted text-sm">לא נמצאו בדיקות התואמות לסינון</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            נקה סינון
          </Button>
        </>
      ) : (
        <>
          <p className="olive-muted text-sm">אין בדיקות עדיין</p>
          <Button type="button" onClick={onCreate}>
            <Plus className="ml-1 size-4" />
            בדיקה חדשה
          </Button>
        </>
      )}
    </div>
  );
}
