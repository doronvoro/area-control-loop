'use client';

import Link from 'next/link';
import { FlaskConical, Pencil } from 'lucide-react';
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
import {
  HARVESTER_LABELS,
  PARAMETER_STATUS_CONFIG,
  PLOT_TYPE_LABELS,
  WATER_TYPE_LABELS,
} from '@/types/database';
import { categoryLabel, type PlotRow, type PlotSortField } from '@/lib/olive/plot-rows';
import type { PlotCategory } from '@/lib/olive/logic';
import { cn } from '@/lib/utils';

/**
 * The plot list.
 *
 * On numbers and RTL: ui/table hardcodes `text-right` on every head and cell,
 * which is correct here. Units live in the HEADER and the cells hold a bare
 * figure — a run of digits is an LTR run under the bidi algorithm whatever the
 * paragraph direction, but "48 דונם" can reorder, and globals.css carries
 * `[dir="rtl"] * { direction: rtl }` so a per-element dir="ltr" cannot save it.
 */

/**
 * Category tint. The old list rendered every category in the same grey pill,
 * so the classification it computed was effectively invisible.
 */
const CATEGORY_PILL: Record<PlotCategory, string> = {
  testing: 'olive-pill-idle',
  normal: 'olive-pill-ok',
  anomaly: 'olive-pill-urgent',
  ready: 'olive-pill-plan',
};

interface PlotsTableProps {
  /** Already filtered, sorted and paged. */
  rows: PlotRow[];
  sort: SortState<PlotSortField>;
  onSort: (field: PlotSortField) => void;
  onEdit: (row: PlotRow) => void;
  activeId?: string | null;
  /** The row that was just saved — highlighted briefly, then back to normal. */
  flashId?: string | null;
}

function num(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

function label(map: Record<string, string>, value: string | null): string {
  if (!value) return '—';
  return map[value] ?? value;
}

export function PlotsTable({ rows, sort, onSort, onEdit, activeId, flashId }: PlotsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="name" sort={sort} onSort={onSort}>
            חלקה
          </SortableTableHead>
          <SortableTableHead
            field="growerName"
            sort={sort}
            onSort={onSort}
            className="hidden lg:table-cell"
          >
            מגדל
          </SortableTableHead>
          <SortableTableHead
            field="region"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            אזור
          </SortableTableHead>
          <SortableTableHead
            field="size"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            גודל (דונם)
          </SortableTableHead>
          <SortableTableHead
            field="taktCount"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            טאקטים
          </SortableTableHead>
          <TableHead className="hidden xl:table-cell">מים · מוסקת</TableHead>
          <SortableTableHead field="category" sort={sort} onSort={onSort}>
            קטגוריה
          </SortableTableHead>
          <SortableTableHead field="daysSinceNir" sort={sort} onSort={onSort}>
            בדיקה אחרונה
          </SortableTableHead>
          <SortableTableHead
            field="oil"
            sort={sort}
            onSort={onSort}
            className="hidden sm:table-cell"
          >
            שמן %
          </SortableTableHead>
          <SortableTableHead
            field="water"
            sort={sort}
            onSort={onSort}
            className="hidden lg:table-cell"
          >
            מים %
          </SortableTableHead>
          <SortableTableHead
            field="yieldKgPerDunam"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            עומס יבול
          </SortableTableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={() => onEdit(row)}
            className={cn(
              'cursor-pointer hover:bg-muted/50',
              activeId === row.id && 'bg-primary/10 hover:bg-primary/15',
              // A running animation outranks the hover rule, so moving the
              // mouse over the row mid-flash does not cut it short.
              flashId === row.id && 'olive-row-flash'
            )}
          >
            <TableCell>
              <span className="font-medium">{row.name || '—'}</span>
              <span className="olive-muted block text-xs">
                {[row.variety, row.plotType ? PLOT_TYPE_LABELS[row.plotType as never] : null]
                  .filter(Boolean)
                  .join(' · ') || ' '}
                {row.harvested && <span className="text-primary font-semibold"> · נמסק</span>}
              </span>
            </TableCell>
            <TableCell className="olive-muted hidden text-xs lg:table-cell">
              {row.growerName ?? '—'}
            </TableCell>
            <TableCell className="olive-muted hidden text-xs xl:table-cell">
              {row.region ?? '—'}
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">{num(row.size, 1)}</TableCell>
            <TableCell className="hidden tabular-nums xl:table-cell">{row.taktCount}</TableCell>
            <TableCell className="olive-muted hidden text-xs xl:table-cell">
              {[label(WATER_TYPE_LABELS, row.waterType), label(HARVESTER_LABELS, row.harvester)]
                .filter((v) => v !== '—')
                .join(' · ') || '—'}
            </TableCell>
            <TableCell>
              <span className={`olive-pill ${CATEGORY_PILL[row.category]}`}>
                {categoryLabel(row.category)}
              </span>
            </TableCell>
            <TableCell>
              {row.lastMeasuredLabel ? (
                <span className="text-xs">{row.lastMeasuredLabel}</span>
              ) : (
                <span className="olive-muted text-xs">טרם נבדקה</span>
              )}
            </TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">{num(row.oil, 1)}</TableCell>
            <TableCell className="hidden tabular-nums lg:table-cell">{num(row.water, 1)}</TableCell>
            <TableCell className="hidden md:table-cell">
              {row.yieldLoad ? (
                <span
                  className={`olive-pill ${PARAMETER_STATUS_CONFIG[row.yieldLoad.status].pillClass}`}
                >
                  {row.yieldLoad.label}
                </span>
              ) : (
                <span className="olive-muted">—</span>
              )}
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
                  aria-label={`ערוך פרטי חלקה ${row.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button asChild type="button" variant="ghost" size="sm">
                  <Link
                    href={`/olive/nir?areaId=${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`הוסף בדיקת NIR בחלקה ${row.name}`}
                  >
                    <FlaskConical className="size-4" />
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
