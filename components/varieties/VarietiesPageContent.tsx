'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TablePagination } from '@/components/ui/table-pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { useUser } from '@/components/providers/UserProvider';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useTableSort } from '@/hooks/useTableSort';
import { showToast } from '@/lib/toast';
import {
  EMPTY_VARIETY_FILTERS,
  filterVarietyRows,
  hasActiveVarietyFilters,
  sortVarietyRows,
  toVarietyRow,
  type VarietyFilters,
  type VarietyRow,
  type VarietySortField,
} from '@/lib/varieties/variety-rows';
import { VarietiesTable } from './VarietiesTable';
import { VarietyFormSheet, type VarietyEditorState } from './VarietyFormSheet';
import { VarietyMergeDialog } from './VarietyMergeDialog';

/**
 * The olive variety list (זנים).
 *
 * Global, unlike growers: one list for every customer, so only admins and
 * customer owners edit it — the same rule as the shared thresholds screen
 * (OliveThresholdsPageContent), and the same check /api/varieties makes.
 * Plot counts are the viewing tenant's own.
 */

const SORT_DEFAULT_DIRECTIONS: Partial<Record<VarietySortField, 'asc' | 'desc'>> = {
  name: 'asc',
};

export function VarietiesPageContent() {
  const router = useRouter();
  const { user } = useUser();
  const canManage = Boolean(user?.isAdmin || user?.isCustomerOwner);
  const { data, loading, error, refetch } = useApiData<Record<string, unknown>[]>('/api/varieties');

  const [filters, setFilters] = useState<VarietyFilters>(EMPTY_VARIETY_FILTERS);
  const [editor, setEditor] = useState<VarietyEditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VarietyRow | null>(null);
  const [pendingMerge, setPendingMerge] = useState<VarietyRow | null>(null);

  const rows = useMemo(() => (data ?? []).map(toVarietyRow), [data]);
  const { sort, toggle } = useTableSort<VarietySortField>('name', 'asc', SORT_DEFAULT_DIRECTIONS);

  const visibleRows = useMemo(
    () => sortVarietyRows(filterVarietyRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const pagination = usePagination(visibleRows, {
    resetKey: [filters.search, filters.plots, sort.field, sort.direction].join('|'),
  });

  const totalPlots = useMemo(() => rows.reduce((sum, r) => sum + r.plotCount, 0), [rows]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      const response = await fetch(`/api/varieties?id=${pendingDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast.error(payload.error || 'שגיאה במחיקת הזן');
        return;
      }
      showToast.success('הזן נמחק');
      setEditor((current) =>
        current?.mode === 'edit' && current.row.id === pendingDelete.id ? null : current
      );
      await refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'שגיאה במחיקת הזן');
    }
  }, [pendingDelete, refetch]);

  const handleMerged = useCallback(async () => {
    setEditor(null);
    await refetch();
  }, [refetch]);

  /** The plots screen, pre-filtered to this variety. */
  const showPlots = useCallback(
    (row: VarietyRow) => router.push(`/olive/plots?variety=${encodeURIComponent(row.id)}`),
    [router]
  );

  const header = (
    <PageHeader
      icon={Leaf}
      title="זנים"
      description={
        rows.length > 0
          ? `${rows.length} זנים · ${totalPlots} חלקות · רשימה משותפת לכל הלקוחות`
          : 'רשימת זני הזית, משותפת לכל הלקוחות'
      }
    >
      {canManage && (
        <Button type="button" onClick={() => setEditor({ mode: 'create' })}>
          <Plus className="ml-1 size-4" />
          זן חדש
        </Button>
      )}
    </PageHeader>
  );

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

  const filtered = hasActiveVarietyFilters(filters);

  return (
    <div className="space-y-4">
      {header}

      <section className="olive-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="חיפוש זן או שם נוסף"
              className="h-9 pr-8"
            />
          </div>
          <Select
            value={filters.plots}
            onValueChange={(plots) => setFilters({ ...filters, plots })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הזנים</SelectItem>
              <SelectItem value="with">עם חלקות</SelectItem>
              <SelectItem value="without">ללא חלקות</SelectItem>
            </SelectContent>
          </Select>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_VARIETY_FILTERS)}
            >
              נקה
            </Button>
          )}
          <span className="olive-muted mr-auto text-xs tabular-nums">
            {visibleRows.length} / {rows.length}
          </span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Leaf className="text-muted-foreground/40 size-8" />
            <p className="olive-muted text-sm">
              {filtered ? 'לא נמצאו זנים התואמים לסינון' : 'אין זנים עדיין'}
            </p>
            {filtered && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_VARIETY_FILTERS)}
              >
                נקה סינון
              </Button>
            )}
          </div>
        ) : (
          <div
            aria-busy={loading}
            className={loading ? 'opacity-60 transition-opacity' : undefined}
          >
            <VarietiesTable
              rows={pagination.pageItems}
              sort={sort}
              onSort={toggle}
              onEdit={(row) => setEditor({ mode: 'edit', row })}
              onDelete={setPendingDelete}
              onMerge={setPendingMerge}
              onShowPlots={showPlots}
              canManage={canManage}
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
              itemLabel="זנים"
            />
          </div>
        )}
      </section>

      {canManage && (
        <>
          <VarietyFormSheet
            editor={editor}
            onOpenChange={(open) => !open && setEditor(null)}
            onSaved={refetch}
          />
          <VarietyMergeDialog
            source={pendingMerge}
            varieties={rows}
            onOpenChange={(open) => !open && setPendingMerge(null)}
            onMerged={handleMerged}
          />
        </>
      )}

      {pendingDelete && (
        <ConfirmationDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title="מחיקת זן"
          description={
            pendingDelete.plotCount > 0 || pendingDelete.windowCount > 0
              ? `הזן "${pendingDelete.name}" בשימוש. כדי להסיר אותו יש למזג אותו לזן אחר.`
              : `למחוק את הזן "${pendingDelete.name}"? פעולה זו אינה ניתנת לביטול.`
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
