'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';

interface UsePaginationOptions {
  /** Rows per page to start with. Default 25. */
  pageSize?: number;
  /**
   * Any string derived from the filters and sort feeding `items`. When it
   * changes the page falls back to 1 — being left on page 3 of a list that was
   * just re-filtered or re-ordered is disorienting.
   */
  resetKey?: string;
  /**
   * localStorage key under which the user's chosen page size is remembered.
   * Omit it and the size resets to `pageSize` on every visit.
   */
  storageKey?: string;
}

// Only the tab that changes the size needs to see it, and it already holds the
// choice in state — no cross-tab sync, so nothing to subscribe to.
const noopSubscribe = () => () => {};

function readSavedSize(storageKey: string | undefined): number | null {
  if (!storageKey) return null;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  } catch {
    // Storage blocked (private mode, disabled site data) — use the default.
    return null;
  }
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
  const storageKey = options?.storageKey;
  // A size picked during this visit wins; otherwise the remembered one; otherwise
  // the default. useSyncExternalStore gives the server render (no localStorage)
  // its own snapshot, so restoring the saved size is not a hydration mismatch.
  const [chosenSize, setChosenSize] = useState<number | null>(null);
  const savedSize = useSyncExternalStore(
    noopSubscribe,
    () => readSavedSize(storageKey),
    () => null
  );
  const pageSize = chosenSize ?? savedSize ?? options?.pageSize ?? 25;
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
      setChosenSize(size);
      setRawPage(1);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(size));
        } catch {
          // Not remembered this time; the choice still applies to this visit.
        }
      }
    },
  };
}
