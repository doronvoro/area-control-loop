'use client';

import { useCallback, useMemo, useState } from 'react';
import { Building2, Loader2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { CustomersTable } from './CustomersTable';
import { CustomersToolbar } from './CustomersToolbar';
import { CustomerFormSheet, type CustomerEditorState } from './CustomerFormSheet';
import { RecoveryLinkDialog } from './RecoveryLinkDialog';
import { useApiData } from '@/hooks/useApiData';
import { usePagination } from '@/hooks/usePagination';
import { useTableSort } from '@/hooks/useTableSort';
import { showToast } from '@/lib/toast';
import {
  EMPTY_CUSTOMER_FILTERS,
  filterCustomerRows,
  hasActiveCustomerFilters,
  sortCustomerRows,
  toCustomerRow,
  type CustomerFilters,
  type CustomerRow,
  type CustomerSortField,
} from '@/lib/customers/customer-rows';

/**
 * The customer list.
 *
 * This was cards in a three-column grid: no search, no sort, no paging, and
 * every field beyond name and description had nowhere to be shown. Both the
 * save and the delete path ended in `window.location.reload()`, which threw
 * away the scroll position and re-ran the whole page to reflect one row.
 *
 * It is a table now, with the same drawer-and-refetch shape as the olive logs.
 */

// Module-level: an inline object would hand out a new `toggle` on every render.
const SORT_DEFAULT_DIRECTIONS: Partial<Record<CustomerSortField, 'asc' | 'desc'>> = {
  name: 'asc',
  customerType: 'asc',
  contactPerson: 'asc',
  city: 'asc',
};

interface CustomersPageContentProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CustomersPageContent({
  canCreate,
  canUpdate,
  canDelete,
}: CustomersPageContentProps) {
  const { data, loading, error, refetch } =
    useApiData<Record<string, unknown>[]>('/api/customers');

  const [filters, setFilters] = useState<CustomerFilters>(EMPTY_CUSTOMER_FILTERS);
  const [editor, setEditor] = useState<CustomerEditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerRow | null>(null);
  const [recovery, setRecovery] = useState<CustomerRow | null>(null);

  const rows = useMemo(() => (data ?? []).map(toCustomerRow), [data]);

  const { sort, toggle } = useTableSort<CustomerSortField>('name', 'asc', SORT_DEFAULT_DIRECTIONS);

  const visibleRows = useMemo(
    () => sortCustomerRows(filterCustomerRows(rows, filters), sort),
    [rows, filters, sort]
  );

  const pagination = usePagination(visibleRows, {
    resetKey: [filters.search, filters.customerType, filters.status, sort.field, sort.direction].join(
      '|'
    ),
  });

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      const response = await fetch(`/api/customers?id=${pendingDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast.error(payload.error || 'שגיאה במחיקת הלקוח');
        return;
      }

      showToast.success('הלקוח נמחק בהצלחה');
      // Close the drawer if it was showing the row that just went away.
      setEditor((current) =>
        current?.mode === 'edit' && current.row.id === pendingDelete.id ? null : current
      );
      await refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'שגיאה במחיקת הלקוח');
    }
  }, [pendingDelete, refetch]);

  // The `&& !data` guard matters: a refetch after saving the drawer would
  // otherwise blank the whole screen for the length of the request.
  if (loading && !data) {
    return (
      <>
        <CustomersHeader canCreate={false} total={0} active={0} onCreate={() => {}} />
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
        <CustomersHeader canCreate={false} total={0} active={0} onCreate={() => {}} />
        <div className="text-destructive py-12 text-center">
          <p>{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <CustomersHeader
        canCreate={canCreate}
        total={rows.length}
        active={activeCount}
        onCreate={() => setEditor({ mode: 'create' })}
      />

      <div className="space-y-4">
        <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <CustomersToolbar
            filters={filters}
            onFiltersChange={setFilters}
            onClear={() => setFilters(EMPTY_CUSTOMER_FILTERS)}
            shown={visibleRows.length}
            total={rows.length}
          />

          {visibleRows.length === 0 ? (
            <EmptyState
              filtered={hasActiveCustomerFilters(filters)}
              canCreate={canCreate}
              onClear={() => setFilters(EMPTY_CUSTOMER_FILTERS)}
              onCreate={() => setEditor({ mode: 'create' })}
            />
          ) : (
            <div aria-busy={loading} className={loading ? 'opacity-60 transition-opacity' : undefined}>
              <CustomersTable
                rows={pagination.pageItems}
                sort={sort}
                onSort={toggle}
                onEdit={(row) => setEditor({ mode: 'edit', row })}
                onRecovery={setRecovery}
                onDelete={setPendingDelete}
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
                itemLabel="לקוחות"
              />
            </div>
          )}
        </section>
      </div>

      {(canCreate || canUpdate) && (
        <CustomerFormSheet
          editor={editor}
          onOpenChange={(open) => !open && setEditor(null)}
          onSaved={refetch}
          onRecovery={setRecovery}
        />
      )}

      {canUpdate && (
        <RecoveryLinkDialog
          customer={recovery}
          open={recovery !== null}
          onOpenChange={(open) => !open && setRecovery(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmationDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title="מחיקת לקוח"
          // Names every cascade: workers, customer_areas and invitations all
          // cascade from customers.id, and the auth account is deleted after.
          description={`למחוק את הלקוח "${pendingDelete.name}"? הפעולה תמחק גם את כל העובדים שלו, את שיוכי השטחים ואת ההזמנות, ותסיר את חשבון ההתחברות. פעולה זו אינה ניתנת לביטול.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

function CustomersHeader({
  canCreate,
  total,
  active,
  onCreate,
}: {
  canCreate: boolean;
  total: number;
  active: number;
  onCreate: () => void;
}) {
  return (
    <PageHeader
      icon={Building2}
      title="ניהול לקוחות"
      description={total > 0 ? `${total} לקוחות · ${active} פעילים` : 'ניהול חשבונות לקוחות והגדרות גישה'}
    >
      {canCreate && (
        <Button type="button" onClick={onCreate}>
          <Plus className="ml-1 size-4" />
          לקוח חדש
        </Button>
      )}
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
      <Users className="text-muted-foreground/40 size-8" />
      {filtered ? (
        <>
          <p className="text-muted-foreground text-sm">לא נמצאו לקוחות התואמים לסינון</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            נקה סינון
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">אין לקוחות במערכת</p>
          {canCreate && (
            <Button type="button" variant="link" size="sm" onClick={onCreate}>
              הוסף לקוח ראשון
            </Button>
          )}
        </>
      )}
    </div>
  );
}
