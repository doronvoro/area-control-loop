'use client';

import { useMemo, useState } from 'react';

interface UsePaginationOptions {
  /** Rows per page to start with. Default 25. */
  pageSize?: number;
  /**
   * Any string derived from the filters and sort feeding `items`. When it
   * changes the page falls back to 1 — being left on page 3 of a list that was
   * just re-filtered or re-ordered is disorienting.
   */
  resetKey?: string;
}

/**
 * Client-side paging over an already-filtered, already-sorted array.
 *
 * Two deliberate choices:
 *
 * - The page is *derived*, never clamped by an effect. Delete the last row on
 *   page 4 and `page` reads 3 in the same render — no frame of empty table, and
 *   nothing to double-fire under StrictMode.
 * - The reset adjusts state during render (the documented React pattern) rather
 *   than in `useEffect`, for the same reason.
 */
export function usePagination<T>(items: T[], options?: UsePaginationOptions) {
  const [pageSize, setPageSize] = useState(options?.pageSize ?? 25);
  const [rawPage, setRawPage] = useState(1);

  const resetKey = options?.resetKey;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setRawPage(1);
  }

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(rawPage, pageCount);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    pageCount,
    total,
    pageSize,
    /** 1-based index of the first row shown, 0 when there are none. */
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    /** 1-based index of the last row shown. */
    to: Math.min(page * pageSize, total),
    pageItems,
    setPage: setRawPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setRawPage(1);
    },
  };
}
