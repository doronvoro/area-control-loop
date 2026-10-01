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
import type { VarietyRow, VarietySortField } from '@/lib/varieties/variety-rows';
import { cn } from '@/lib/utils';

/**
 * The variety list. Units in the header, bare figures in the cells, for the
 * RTL/bidi reason given at the top of GrowersTable.
 */
interface VarietiesTableProps {
  rows: VarietyRow[];
  sort: SortState<VarietySortField>;
  onSort: (field: VarietySortField) => void;
  onEdit: (row: VarietyRow) => void;
  onDelete: (row: VarietyRow) => void;
  onMerge: (row: VarietyRow) => void;
  onShowPlots: (row: VarietyRow) => void;
  canManage: boolean;
  activeId?: string | null;
}

export function VarietiesTable({
  rows,
  sort,
  onSort,
  onEdit,
  onDelete,
  onMerge,
  onShowPlots,
  canManage,
  activeId,
}: VarietiesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="name" sort={sort} onSort={onSort}>
            זן
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
          <SortableTableHead
            field="windowCount"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            חלונות קטיף
          </SortableTableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={canManage ? () => onEdit(row) : undefined}
            className={cn(
              canManage && 'cursor-pointer hover:bg-muted/50',
              activeId === row.id && 'bg-primary/10 hover:bg-primary/15'
            )}
          >
            <TableCell>
              <span className="font-medium">{row.name}</span>
              <span className="olive-muted block text-xs" title={row.aliases.join(', ')}>
                {row.aliases.length > 0 ? `גם: ${row.aliases.join(', ')}` : ' '}
              </span>
            </TableCell>
            <TableCell className="tabular-nums">{row.plotCount}</TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">
              {row.totalDunam > 0 ? row.totalDunam.toFixed(1) : '—'}
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {row.windowCount > 0 ? row.windowCount : '—'}
            </TableCell>
            <TableCell className="p-1">
              <div className="flex items-center">
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row);
                    }}
                    aria-label={`ערוך את הזן ${row.name}`}
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
                  aria-label={`הצג את החלקות מזן ${row.name}`}
                  title="הצג חלקות"
                >
                  <MapPin className="size-4" />
                </Button>
                {canManage && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMerge(row);
                      }}
                      aria-label={`מזג את הזן ${row.name} לזן אחר`}
                      title="מזג לזן אחר"
                    >
                      <Merge className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(row);
                      }}
                      aria-label={`מחק את הזן ${row.name}`}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
