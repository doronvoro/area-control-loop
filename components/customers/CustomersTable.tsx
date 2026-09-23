'use client';

import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead, type SortState } from '@/components/ui/sortable-table-head';
import type { CustomerRow, CustomerSortField } from '@/lib/customers/customer-rows';
import { cn } from '@/lib/utils';

/**
 * The customer list.
 *
 * On phone numbers, emails and RTL: ui/table hardcodes `text-right`, and
 * globals.css carries `[dir="rtl"] * { direction: rtl }`, which defeats a
 * per-element dir="ltr". It does NOT reset `unicode-bidi: isolate`, so <bdi> is
 * what keeps "050-1234567" and an address from reordering when they sit in a
 * cell beside Hebrew text. Same hazard the olive tables document for numbers,
 * different remedy — these values cannot move to the header.
 */

interface CustomersTableProps {
  /** Already filtered, sorted and paged. */
  rows: CustomerRow[];
  sort: SortState<CustomerSortField>;
  onSort: (field: CustomerSortField) => void;
  onEdit: (row: CustomerRow) => void;
  onRecovery: (row: CustomerRow) => void;
  onDelete: (row: CustomerRow) => void;
  canUpdate: boolean;
  canDelete: boolean;
  activeId?: string | null;
}

export function CustomersTable({
  rows,
  sort,
  onSort,
  onEdit,
  onRecovery,
  onDelete,
  canUpdate,
  canDelete,
  activeId,
}: CustomersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="name" sort={sort} onSort={onSort}>
            לקוח
          </SortableTableHead>
          <SortableTableHead field="customerType" sort={sort} onSort={onSort}>
            סוג
          </SortableTableHead>
          <SortableTableHead
            field="contactPerson"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            איש קשר
          </SortableTableHead>
          {/* Not sortable: it is the same contact as the column before it, whose
              subline already shows whichever number is on file. */}
          <TableHead className="hidden xl:table-cell">נייד</TableHead>
          <TableHead className="hidden lg:table-cell">אימייל</TableHead>
          <SortableTableHead
            field="city"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            עיר
          </SortableTableHead>
          <SortableTableHead field="isActive" sort={sort} onSort={onSort}>
            סטטוס
          </SortableTableHead>
          <SortableTableHead
            field="createdAt"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            נוצר
          </SortableTableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={canUpdate ? () => onEdit(row) : undefined}
            className={cn(
              canUpdate && 'cursor-pointer hover:bg-muted/50',
              activeId === row.id && 'bg-primary/10 hover:bg-primary/15'
            )}
          >
            <TableCell>
              <span className="font-medium">{row.name || '—'}</span>
              <span className="text-muted-foreground block text-xs">
                {row.businessId ? <bdi>ח.פ {row.businessId}</bdi> : ' '}
              </span>
            </TableCell>
            <TableCell>
              {row.customerType ? (
                <Badge variant="secondary">{row.customerTypeLabel}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {row.customerTypeLabel}
                </Badge>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <span className="text-sm">{row.contactPerson ?? '—'}</span>
              <span className="text-muted-foreground block text-xs tabular-nums">
                {row.contactPhone || row.contactMobile ? (
                  <bdi>{row.contactPhone ?? row.contactMobile}</bdi>
                ) : (
                  ' '
                )}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground hidden text-xs tabular-nums xl:table-cell">
              {row.contactMobile ? <bdi>{row.contactMobile}</bdi> : '—'}
            </TableCell>
            <TableCell className="hidden max-w-[14rem] lg:table-cell">
              <span className="block truncate text-xs" title={row.contactEmail ?? undefined}>
                {row.contactEmail ? <bdi>{row.contactEmail}</bdi> : '—'}
              </span>
              {/* Labelled, because the two addresses are different things and an
                  unlabelled second line would read as a typo of the first. */}
              <span
                className="text-muted-foreground block truncate text-xs"
                title={row.loginEmail ?? undefined}
              >
                {row.loginEmail ? <bdi>כניסה: {row.loginEmail}</bdi> : ' '}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground hidden text-xs xl:table-cell">
              {row.city ?? '—'}
            </TableCell>
            <TableCell>
              {row.isActive ? (
                <Badge>פעיל</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  לא פעיל
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
              {row.createdAtLabel}
            </TableCell>
            <TableCell className="p-1">
              <div className="flex items-center">
                {canUpdate && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      // The row itself opens the drawer; keep the click from
                      // firing twice.
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(row);
                      }}
                      aria-label={`ערוך את הלקוח ${row.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecovery(row);
                      }}
                      aria-label={`קישור לאיפוס סיסמה ללקוח ${row.name}`}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(row);
                    }}
                    aria-label={`מחק את הלקוח ${row.name}`}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
