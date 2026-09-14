'use client';

import { useCallback, useState } from 'react';
import type { SortDirection, SortState } from '@/components/ui/sortable-table-head';

/**
 * Sort field + direction for a table, with the usual toggle behaviour:
 * clicking the active column flips it, clicking another column switches to it.
 *
 * `defaultDirections` exists so a text column can open ascending (א→ת reads as
 * "from the start") while dates and numbers open descending (newest/largest
 * first), without every caller writing the same closure. Pass it as a
 * module-level constant — an inline object would hand out a new `toggle` on
 * every render.
 */
export function useTableSort<F extends string>(
  initialField: F,
  initialDirection: SortDirection = 'desc',
  defaultDirections?: Partial<Record<F, SortDirection>>
) {
  const [sort, setSort] = useState<SortState<F>>({
    field: initialField,
    direction: initialDirection,
  });

  const toggle = useCallback(
    (field: F) => {
      setSort((prev) =>
        prev.field === field
          ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
          : { field, direction: defaultDirections?.[field] ?? 'desc' }
      );
    },
    [defaultDirections]
  );

  return { sort, toggle, setSort };
}
