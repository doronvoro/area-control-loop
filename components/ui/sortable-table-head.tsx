'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

interface SortableTableHeadProps<F extends string> {
  field: F;
  sort: SortState<F>;
  onSort: (field: F) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * A table header that sorts on click.
 *
 * The icon + `me-1` spacing is lifted from ReportsTable, which grew this
 * pattern first; three admin managers then copied it by hand. This is the
 * shared version — the logical margin keeps it correct under RTL.
 */
export function SortableTableHead<F extends string>({
  field,
  sort,
  onSort,
  children,
  className,
}: SortableTableHeadProps<F>) {
  const active = sort.field === field;

  return (
    <TableHead className={className}>
      <button
        // Not a submit: these tables can sit inside a form (the NIR drawer
        // portals one), and a bare <button> would submit it on every sort.
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'flex items-center font-medium transition-colors hover:text-foreground',
          !active && 'text-muted-foreground'
        )}
        aria-label={`מיין לפי ${typeof children === 'string' ? children : field}`}
      >
        {!active ? (
          <ArrowUpDown className="me-1 h-3.5 w-3.5 opacity-50" />
        ) : sort.direction === 'asc' ? (
          <ArrowUp className="me-1 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="me-1 h-3.5 w-3.5" />
        )}
        {children}
      </button>
    </TableHead>
  );
}
