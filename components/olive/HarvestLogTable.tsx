'use client';

import { Flag, Pencil, Trash2 } from 'lucide-react';
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
import { daysSinceLabel } from '@/lib/olive/logic';
import type { HarvestRow, HarvestSortField } from '@/lib/olive/harvest-rows';
import { cn } from '@/lib/utils';

/**
 * The harvest log.
 *
 * On numbers and RTL: ui/table hardcodes `text-right` on every head and cell,
 * which is correct here and is left alone. Units live in the HEADER and the
 * cells hold a bare figure — a run of digits is treated as left-to-right by the
 * bidi algorithm whatever the paragraph direction, but "5000 ק״ג" can reorder.
 * The usual escape hatch is not available either: globals.css carries
 * `[dir="rtl"] * { direction: rtl }`, which overrides even an element's own
 * dir="ltr".
 */

interface HarvestLogTableProps {
  /** Already filtered, sorted and paged. */
  rows: HarvestRow[];
  sort: SortState<HarvestSortField>;
  onSort: (field: HarvestSortField) => void;
  onEdit: (row: HarvestRow) => void;
  onDelete: (row: HarvestRow) => void;
  activeId?: string | null;
  now: Date;
}

/** Fixed decimals keep the column a clean stack under tabular-nums. */
function num(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

export function HarvestLogTable({
  rows,
  sort,
  onSort,
  onEdit,
  onDelete,
  activeId,
  now,
}: HarvestLogTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="reportDate" sort={sort} onSort={onSort}>
            תאריך
          </SortableTableHead>
          <SortableTableHead
            field="reportNumber"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            מס׳
          </SortableTableHead>
          <SortableTableHead field="areaName" sort={sort} onSort={onSort}>
            חלקה
          </SortableTableHead>
          <SortableTableHead field="passNumber" sort={sort} onSort={onSort}>
            מעבר
          </SortableTableHead>
          <TableHead className="hidden lg:table-cell">מוסקת · מפעיל</TableHead>
          <TableHead className="hidden md:table-cell">טאקט</TableHead>
          <SortableTableHead
            field="areaDoneDunam"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            שטח (דונם)
          </SortableTableHead>
          <SortableTableHead field="fruitKg" sort={sort} onSort={onSort}>
            פרי (ק״ג)
          </SortableTableHead>
          <SortableTableHead field="oilKg" sort={sort} onSort={onSort}>
            שמן (ק״ג)
          </SortableTableHead>
          <SortableTableHead
            field="kgPerDunam"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            ק״ג לדונם
          </SortableTableHead>
          <SortableTableHead
            field="oilPercent"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            שמן מהפרי %
          </SortableTableHead>
          <SortableTableHead field="isFinal" sort={sort} onSort={onSort}>
            אחרון
          </SortableTableHead>
          <TableHead className="hidden xl:table-cell">הערות</TableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const equipment = [row.harvesterLabel, row.operator].filter(Boolean).join(' · ');

          return (
            <TableRow
              key={row.id}
              onClick={() => onEdit(row)}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                activeId === row.id && 'bg-primary/10 hover:bg-primary/15'
              )}
            >
              <TableCell>
                {row.reportDate ?? '—'}
                <span className="olive-muted block text-xs">
                  {daysSinceLabel(row.reportDate, now) ?? ''}
                </span>
              </TableCell>
              <TableCell className="hidden tabular-nums xl:table-cell">
                {row.reportNumber ?? '—'}
              </TableCell>
              <TableCell>
                <span className="font-medium">{row.areaName || '—'}</span>
                {row.variety && <span className="olive-muted block text-xs">{row.variety}</span>}
              </TableCell>
              <TableCell className="tabular-nums">{row.passNumber ?? '—'}</TableCell>
              <TableCell className="olive-muted hidden text-xs lg:table-cell">
                {equipment || '—'}
              </TableCell>
              <TableCell className="olive-muted hidden text-xs md:table-cell">
                {row.subAreaName ?? 'כל החלקה'}
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">
                {num(row.areaDoneDunam, 1)}
                {row.plotSize !== null && row.areaDoneDunam !== null && (
                  <span className="olive-muted block text-xs">מתוך {row.plotSize.toFixed(0)}</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{num(row.fruitKg)}</TableCell>
              <TableCell className="tabular-nums">{num(row.oilKg)}</TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">
                {num(row.kgPerDunam)}
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">
                {num(row.oilPercent, 1)}
              </TableCell>
              <TableCell>
                {row.isFinal ? (
                  <span className="olive-pill olive-pill-ok inline-flex items-center gap-1">
                    <Flag className="size-3" />
                    כן
                  </span>
                ) : (
                  <span className="olive-muted">—</span>
                )}
              </TableCell>
              <TableCell
                className="olive-muted hidden max-w-[16rem] truncate text-xs xl:table-cell"
                title={row.notes || undefined}
              >
                {row.notes || '—'}
              </TableCell>
              <TableCell className="p-1">
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    // The row itself opens the editor; keep the click from
                    // firing twice.
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row);
                    }}
                    aria-label={`ערוך מעבר בחלקה ${row.areaName}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(row);
                    }}
                    aria-label={`מחק מעבר בחלקה ${row.areaName}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
