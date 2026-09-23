'use client';

import { MapPin, Merge, Pencil, Trash2 } from 'lucide-react';
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
import type { GrowerRow, GrowerSortField } from '@/lib/growers/grower-rows';
import { cn } from '@/lib/utils';

/**
 * The grower list.
 *
 * Numbers and RTL, as in PlotsTable: units live in the HEADER and the cells hold
 * a bare figure, because a digit run is LTR under the bidi algorithm whatever
 * the paragraph direction, but "48 דונם" reorders — and globals.css carries
 * `[dir="rtl"] * { direction: rtl }`, so a per-element dir="ltr" cannot save it.
 * Phone numbers cannot move to a header, so they are wrapped in <bdi>, which
 * survives that rule because it does not reset `unicode-bidi: isolate`.
 */

interface GrowersTableProps {
  /** Already filtered, sorted and paged. */
  rows: GrowerRow[];
  sort: SortState<GrowerSortField>;
  onSort: (field: GrowerSortField) => void;
  onEdit: (row: GrowerRow) => void;
  onDelete: (row: GrowerRow) => void;
  /** Opens the merge dialog with this row as the grower being absorbed. */
  onMerge: (row: GrowerRow) => void;
  /** Opens the plots page filtered to this grower. */
  onShowPlots: (row: GrowerRow) => void;
  canUpdate: boolean;
  canDelete: boolean;
  activeId?: string | null;
}

export function GrowersTable({
  rows,
  sort,
  onSort,
  onEdit,
  onDelete,
  onMerge,
  onShowPlots,
  canUpdate,
  canDelete,
  activeId,
}: GrowersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="name" sort={sort} onSort={onSort}>
            מגדל
          </SortableTableHead>
          <SortableTableHead field="growerType" sort={sort} onSort={onSort}>
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
          <SortableTableHead field="plotCount" sort={sort} onSort={onSort}>
            חלקות
          </SortableTableHead>
          <SortableTableHead
            field="totalDunam"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            דונם
          </SortableTableHead>
          <SortableTableHead field="isActive" sort={sort} onSort={onSort}>
            סטטוס
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
              {/* Aliases displace the ח.פ line rather than adding a row: they
                  are the rarer of the two, and the column is already narrow. */}
              <span className="olive-muted block text-xs" title={row.aliases.join(', ')}>
                {row.aliases.length > 0 ? (
                  `גם: ${row.aliases.join(', ')}`
                ) : row.businessId ? (
                  <bdi>ח.פ {row.businessId}</bdi>
                ) : (
                  ' '
                )}
              </span>
            </TableCell>
            <TableCell>
              <span
                className={`olive-pill ${row.growerType ? 'olive-pill-ok' : 'olive-pill-idle'}`}
              >
                {row.growerTypeLabel}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <span className="text-sm">{row.contactPerson ?? '—'}</span>
              <span className="olive-muted block text-xs tabular-nums">
                {row.contactPhone || row.contactMobile ? (
                  <bdi>{row.contactPhone ?? row.contactMobile}</bdi>
                ) : (
                  ' '
                )}
              </span>
            </TableCell>
            <TableCell className="olive-muted hidden text-xs tabular-nums xl:table-cell">
              {row.contactMobile ? <bdi>{row.contactMobile}</bdi> : '—'}
            </TableCell>
            <TableCell className="hidden max-w-[14rem] lg:table-cell">
              <span className="block truncate text-xs" title={row.contactEmail ?? undefined}>
                {row.contactEmail ? <bdi>{row.contactEmail}</bdi> : '—'}
              </span>
            </TableCell>
            <TableCell className="olive-muted hidden text-xs xl:table-cell">
              {row.city ?? '—'}
            </TableCell>
            <TableCell className="tabular-nums">{row.plotCount}</TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">
              {row.totalDunam > 0 ? row.totalDunam.toFixed(1) : '—'}
            </TableCell>
            <TableCell>
              <span className={`olive-pill ${row.isActive ? 'olive-pill-ok' : 'olive-pill-idle'}`}>
                {row.isActive ? 'פעיל' : 'לא פעיל'}
              </span>
            </TableCell>
            <TableCell className="p-1">
              <div className="flex items-center">
                {canUpdate && (
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
                    aria-label={`ערוך את המגדל ${row.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={row.plotCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowPlots(row);
                  }}
                  aria-label={`הצג את החלקות של ${row.name}`}
                >
                  <MapPin className="size-4" />
                </Button>
                {/* Merging needs both permissions, as /api/growers/merge does:
                    it reassigns plots and deletes a grower. */}
                {canUpdate && canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMerge(row);
                    }}
                    aria-label={`מזג את המגדל ${row.name} למגדל אחר`}
                    title="מזג למגדל אחר"
                  >
                    <Merge className="size-4" />
                  </Button>
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
                    aria-label={`מחק את המגדל ${row.name}`}
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
