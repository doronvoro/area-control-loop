'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { GrowersTable } from './GrowersTable';
import { GrowersToolbar } from './GrowersToolbar';
import { GrowerFormSheet, type GrowerEditorState } from './GrowerFormSheet';
import { GrowerMergeDialog } from './GrowerMergeDialog';
import { useUser } from '@/components/providers/UserProvider';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useTableSort } from '@/hooks/useTableSort';
import { showToast } from '@/lib/toast';
import {
  EMPTY_GROWER_FILTERS,
  filterGrowerRows,
  hasActiveGrowerFilters,
  sortGrowerRows,
  toGrowerRow,
  type GrowerFilters,
  type GrowerRow,
  type GrowerSortField,
} from '@/lib/growers/grower-rows';

/**
 * The grower list.
 *
 * Built on the same bones as /admin/customers — grid, toolbar, drawer, client
 * side filter/sort/page — but scoped to the selected tenant rather than to every
 * tenant, because a grower belongs to one. That is also why it lives under the
 * olive group: growers exist to be attached to olive plots.
 */

// Module-level: an inline object would hand out a new `toggle` on every render.
const SORT_DEFAULT_DIRECTIONS: Partial<Record<GrowerSortField, 'asc' | 'desc'>> = {
  name: 'asc',
  growerType: 'asc',
  contactPerson: 'asc',
  city: 'asc',
};

interface GrowersPageContentProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function GrowersPageContent({ canCreate, canUpdate, canDelete }: GrowersPageContentProps) {
  const router = useRouter();
  const { user } = useUser();
  const { data, loading, error, refetch } = useApiData<Record<string, unknown>[]>('/api/growers');

  const [filters, setFilters] = useState<GrowerFilters>(EMPTY_GROWER_FILTERS);
  const [editor, setEditor] = useState<GrowerEditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GrowerRow | null>(null);
  const [pendingMerge, setPendingMerge] = useState<GrowerRow | null>(null);

  /**
   * An admin scoped to nothing has no tenant to hang a grower on, and the route
   * would 400. SelectCustomerBanner already says so at the top of the page, so
   * this only has to not offer the button.
   */
  const hasTenant = !(user?.isAdmin && !user.selectedCustomer);

  const rows = useMemo(() => (data ?? []).map(toGrowerRow), [data]);

  const { sort, toggle } = useTableSort<GrowerSortField>('name', 'asc', SORT_DEFAULT_DIRECTIONS);

  const visibleRows = useMemo(
    () => sortGrowerRows(filterGrowerRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const pagination = usePagination(visibleRows, {
    resetKey: [
      filters.search,
      filters.growerType,
      filters.status,
      filters.plots,
      sort.field,
      sort.direction,
    ].join('|'),
  });

  const totals = useMemo(
    () => ({
      plots: rows.reduce((sum, r) => sum + r.plotCount, 0),
      dunam: rows.reduce((sum, r) => sum + r.totalDunam, 0),
    }),
    [rows]
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      const response = await fetch(`/api/growers?id=${pendingDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        // The 409 "still has plots" message lands here. A toast rather than a
        // banner: the dialog is already closing, and the row is still on screen.
        showToast.error(payload.error || 'שגיאה במחיקת המגדל');
        return;
      }

      showToast.success('המגדל נמחק');
      setEditor((current) =>
        current?.mode === 'edit' && current.row.id === pendingDelete.id ? null : current
      );
      await refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'שגיאה במחיקת המגדל');
    }
  }, [pendingDelete, refetch]);

  /**
   * A merge changes the row that was merged INTO as well as removing the source
   * — plot count, dunam and its alias list — and the drawer may be open on
   * either. Closing it is cheaper than reconciling a stale row against the
   * refetch, and the operator's next move is the list, not the drawer.
   */
  const handleMerged = useCallback(async () => {
    setEditor(null);
    await refetch();
  }, [refetch]);

  /** The plots screen, pre-searched for this grower. */
  const showPlots = useCallback(
    (row: GrowerRow) => router.push(`/olive/plots?grower=${encodeURIComponent(row.name)}`),
    [router]
  );

  const header = (
    <PageHeader
      icon={Users}
      title="מגדלים"
      description={
        rows.length > 0
          ? `${rows.length} מגדלים · ${totals.plots} חלקות · ${totals.dunam.toFixed(1)} דונם`
          : 'המגדלים שחלקותיהם מנוהלות אצל הלקוח הנבחר'
      }
    >
      {canCreate && (
        <Button
          type="button"
          onClick={() => setEditor({ mode: 'create' })}
          disabled={!hasTenant}
          title={hasTenant ? undefined : 'בחר לקוח כדי להוסיף מגדל'}
        >
          <Plus className="ml-1 size-4" />
          מגדל חדש
        </Button>
      )}
    </PageHeader>
  );

  // The `&& !data` guard matters: a refetch after saving the drawer would
  // otherwise blank the whole screen for the length of the request.
  if (loading && !data) {
    return (
      <>
        {header}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <span className="text-muted-foreground mr-2">טוען נתונים...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <div className="text-destructive py-12 text-center">
          <p>{error}</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <section className="olive-card overflow-hidden">
        <GrowersToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onClear={() => setFilters(EMPTY_GROWER_FILTERS)}
          shown={visibleRows.length}
          total={rows.length}
        />

        {visibleRows.length === 0 ? (
          <EmptyState
            filtered={hasActiveGrowerFilters(filters)}
            canCreate={canCreate && hasTenant}
            hasTenant={hasTenant}
            onClear={() => setFilters(EMPTY_GROWER_FILTERS)}
            onCreate={() => setEditor({ mode: 'create' })}
          />
        ) : (
          <div
            aria-busy={loading}
            className={loading ? 'opacity-60 transition-opacity' : undefined}
          >
            <GrowersTable
              rows={pagination.pageItems}
              sort={sort}
              onSort={toggle}
              onEdit={(row) => setEditor({ mode: 'edit', row })}
              onDelete={setPendingDelete}
              onMerge={setPendingMerge}
              onShowPlots={showPlots}
              canUpdate={canUpdate}
              canDelete={canDelete}
              activeId={editor?.mode === 'edit' ? editor.row.id : null}
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
              itemLabel="מגדלים"
            />
          </div>
        )}
      </section>

      {(canCreate || canUpdate) && (
        <GrowerFormSheet
          editor={editor}
          onOpenChange={(open) => !open && setEditor(null)}
          onSaved={refetch}
        />
      )}

      {canUpdate && canDelete && (
        <GrowerMergeDialog
          source={pendingMerge}
          // The whole list, not the page: the target is usually the biggest
          // grower and the source a stray, and the two rarely share a page.
          growers={rows}
          onOpenChange={(open) => !open && setPendingMerge(null)}
          onMerged={handleMerged}
        />
      )}

      {pendingDelete && (
        <ConfirmationDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title="מחיקת מגדל"
          description={
            pendingDelete.plotCount > 0
              ? `למגדל "${pendingDelete.name}" משויכות ${pendingDelete.plotCount} חלקות. יש לשייך אותן למגדל אחר לפני המחיקה.`
              : `למחוק את המגדל "${pendingDelete.name}"? פעולה זו אינה ניתנת לביטול.`
          }
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function EmptyState({
  filtered,
  canCreate,
  hasTenant,
  onClear,
  onCreate,
}: {
  filtered: boolean;
  canCreate: boolean;
  hasTenant: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <Users className="text-muted-foreground/40 size-8" />
      {filtered ? (
        <>
          <p className="olive-muted text-sm">לא נמצאו מגדלים התואמים לסינון</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            נקה סינון
          </Button>
        </>
      ) : (
        <>
          <p className="olive-muted text-sm">אין מגדלים ללקוח זה</p>
          {canCreate ? (
            <Button type="button" variant="link" size="sm" onClick={onCreate}>
              הוסף מגדל ראשון
            </Button>
          ) : (
            !hasTenant && (
              <p className="olive-muted text-xs">בחר לקוח בתפריט הצדדי כדי לנהל מגדלים</p>
            )
          )}
        </>
      )}
    </div>
  );
}
