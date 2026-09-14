'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TablePaginationProps {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Plural noun for the count line, e.g. "בדיקות". */
  itemLabel?: string;
  className?: string;
}

/**
 * Paging controls for a client-side paged table.
 *
 * Deliberately a plain div rendered *below* <Table>, not a <TableFooter>:
 * Table wraps itself in `overflow-x-auto`, and on a narrow screen the pager
 * must stay put rather than scroll sideways with the columns.
 *
 * The chevrons point the way the page reads: in RTL, ChevronRight goes back.
 */
export function TablePagination({
  page,
  pageCount,
  total,
  from,
  to,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'רשומות',
  className,
}: TablePaginationProps) {
  if (total === 0) return null;

  const isFirst = page <= 1;
  const isLast = page >= pageCount;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t px-2 py-3 text-sm',
        className
      )}
    >
      <div className="text-muted-foreground">
        מציג {from}–{to} מתוך {total} {itemLabel}
      </div>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">שורות בעמוד</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]" aria-label="שורות בעמוד">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isFirst}
            onClick={() => onPageChange(1)}
            aria-label="לעמוד הראשון"
          >
            <ChevronsRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isFirst}
            onClick={() => onPageChange(page - 1)}
            aria-label="לעמוד הקודם"
          >
            <ChevronRight className="size-4" />
          </Button>

          <span className="px-2 text-xs whitespace-nowrap tabular-nums">
            עמוד {page} מתוך {pageCount}
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isLast}
            onClick={() => onPageChange(page + 1)}
            aria-label="לעמוד הבא"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={isLast}
            onClick={() => onPageChange(pageCount)}
            aria-label="לעמוד האחרון"
          >
            <ChevronsLeft className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
