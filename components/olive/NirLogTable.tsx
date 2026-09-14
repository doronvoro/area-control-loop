'use client';

import { Pencil, Trash2 } from 'lucide-react';
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
import { PARAMETER_STATUS_CONFIG, type ParameterRule } from '@/types/database';
import { daysSinceLabel, evaluateParameter } from '@/lib/olive/logic';
import type { NirRow, NirSortField } from '@/lib/olive/nir-rows';
import { cn } from '@/lib/utils';

/**
 * The NIR log.
 *
 * On numbers and RTL: ui/table hardcodes `text-right` on every head and cell,
 * which is correct here and is left alone. Units live in the HEADER and the
 * cells hold a bare figure — a run of digits is treated as left-to-right by the
 * bidi algorithm whatever the paragraph direction, but "17.4%" can reorder. The
 * usual escape hatch is not available either: globals.css carries
 * `[dir="rtl"] * { direction: rtl }`, which overrides even an element's own
 * dir="ltr".
 */

interface NirLogTableProps {
  /** Already filtered, sorted and paged. */
  rows: NirRow[];
  rules: ParameterRule[];
  sort: SortState<NirSortField>;
  onSort: (field: NirSortField) => void;
  onEdit: (row: NirRow) => void;
  onDelete: (row: NirRow) => void;
  activeId?: string | null;
  now: Date;
}

/** Fixed decimals keep the column a clean stack under tabular-nums. */
function num(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits);
}

export function NirLogTable({
  rows,
  rules,
  sort,
  onSort,
  onEdit,
  onDelete,
  activeId,
  now,
}: NirLogTableProps) {
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
            className="hidden lg:table-cell"
          >
            מס׳
          </SortableTableHead>
          <SortableTableHead field="areaName" sort={sort} onSort={onSort}>
            חלקה
          </SortableTableHead>
          <TableHead className="hidden md:table-cell">טאקט · כיוון</TableHead>
          <SortableTableHead field="oil" sort={sort} onSort={onSort}>
            שמן %
          </SortableTableHead>
          <SortableTableHead field="water" sort={sort} onSort={onSort}>
            מים %
          </SortableTableHead>
          <SortableTableHead
            field="dry"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            שמן בחו״י %
          </SortableTableHead>
          <SortableTableHead
            field="green"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            ירוק %
          </SortableTableHead>
          <SortableTableHead
            field="acid"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            חומציות %
          </SortableTableHead>
          <SortableTableHead
            field="maturity"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            הבשלה
          </SortableTableHead>
          <SortableTableHead
            field="irrigAmount"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            השקיה
          </SortableTableHead>
          <SortableTableHead field="status" sort={sort} onSort={onSort}>
            סטטוס
          </SortableTableHead>
          <TableHead className="hidden lg:table-cell">דוגם</TableHead>
          <TableHead className="hidden xl:table-cell">הערות</TableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const oilMatch = evaluateParameter(rules, 'oil', row.oil);
          const sampleLocation = [row.subAreaName, row.direction].filter(Boolean).join(' · ');

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
              <TableCell className="hidden tabular-nums lg:table-cell">
                {row.reportNumber ?? '—'}
              </TableCell>
              <TableCell>
                <span className="font-medium">{row.areaName || '—'}</span>
                {row.variety && <span className="olive-muted block text-xs">{row.variety}</span>}
              </TableCell>
              <TableCell className="olive-muted hidden text-xs md:table-cell">
                {sampleLocation || '—'}
              </TableCell>
              <TableCell className="tabular-nums">{num(row.oil)}</TableCell>
              <TableCell className="tabular-nums">{num(row.water)}</TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">{num(row.dry, 2)}</TableCell>
              <TableCell className="hidden tabular-nums xl:table-cell">
                {num(row.green, 0)}
              </TableCell>
              <TableCell className="hidden tabular-nums xl:table-cell">
                {num(row.acid, 2)}
              </TableCell>
              <TableCell className="hidden tabular-nums xl:table-cell">
                {num(row.maturity)}
              </TableCell>
              <TableCell className="hidden tabular-nums xl:table-cell">
                {num(row.irrigAmount, 2)}
              </TableCell>
              <TableCell>
                {oilMatch ? (
                  <span
                    className={`olive-pill ${PARAMETER_STATUS_CONFIG[oilMatch.status].pillClass}`}
                  >
                    {oilMatch.message}
                  </span>
                ) : (
                  <span className="olive-muted">—</span>
                )}
              </TableCell>
              <TableCell className="olive-muted hidden text-xs lg:table-cell">
                {row.workerName || '—'}
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
                    aria-label={`ערוך בדיקה בחלקה ${row.areaName}`}
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
                    aria-label={`מחק בדיקה בחלקה ${row.areaName}`}
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
