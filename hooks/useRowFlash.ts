'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Briefly highlight the row that just changed.
 *
 * Arming and showing are deliberately two moments. A save usually happens while
 * something is still covering the table — a drawer, a loading dim — and a
 * highlight played then is a highlight nobody sees. So the caller arms the row
 * on save and commits it when the row is actually on screen; only the commit
 * renders anything.
 *
 * That split also collapses a burst: several saves before the drawer closes arm
 * the same row repeatedly and produce one flash, not one per save.
 */
export function useRowFlash(durationMs = 1400) {
  const [flashId, setFlashId] = useState<string | null>(null);
  // A ref, not state: arming must not re-render, or a save would repaint the
  // table underneath the very thing that is hiding it.
  const pending = useRef<string | null>(null);

  /** Remember a row to flash later. Renders nothing on its own. */
  const arm = useCallback((id: string | null) => {
    pending.current = id;
  }, []);

  /** Play the armed flash, if there is one. Safe to call on every render pass. */
  const commit = useCallback(() => {
    if (!pending.current) return;
    setFlashId(pending.current);
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!flashId) return;
    // Outlives the CSS animation on purpose, so the class is never pulled out
    // from under it mid-play.
    const timer = setTimeout(() => setFlashId(null), durationMs);
    return () => clearTimeout(timer);
  }, [flashId, durationMs]);

  return { flashId, arm, commit };
}
