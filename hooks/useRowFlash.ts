'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * What the highlight is saying.
 *
 * `saved` announces that the row changed. `released` only says "this is the one
 * you had open" — it must look different, because the colour this app uses for
 * a save is the same colour it uses for "ok", and flashing it after a close
 * that changed nothing would assert something untrue.
 */
export type RowFlashKind = 'saved' | 'released';

export interface RowFlash {
  id: string;
  kind: RowFlashKind;
}

/**
 * Briefly highlight the row you were just working on.
 *
 * Arming and showing are deliberately two moments. A save usually happens while
 * something is still covering the table — a drawer, a loading dim — and a
 * highlight played then is a highlight nobody sees. So the caller arms the row
 * when it learns about it and commits it when the row is actually on screen;
 * only the commit renders anything.
 *
 * That split also collapses a burst: several saves before the drawer closes arm
 * the same row repeatedly and produce one highlight, not one per save.
 */
export function useRowFlash(durationMs = 1400) {
  const [flash, setFlash] = useState<RowFlash | null>(null);
  // A ref, not state: arming must not re-render, or a save would repaint the
  // table underneath the very thing that is hiding it.
  const pending = useRef<RowFlash | null>(null);

  /** Remember a row to highlight later. Renders nothing on its own. */
  const arm = useCallback((id: string | null, kind: RowFlashKind) => {
    if (!id) return;
    // A save outranks the close that follows it. Both fire on the way out of a
    // save-then-close, and the save is the one worth reporting.
    if (kind === 'released' && pending.current?.kind === 'saved') return;
    pending.current = { id, kind };
  }, []);

  /** Play the armed highlight, if there is one. Safe to call on every render. */
  const commit = useCallback(() => {
    if (!pending.current) return;
    setFlash(pending.current);
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!flash) return;
    // Outlives the CSS animation on purpose, so the class is never pulled out
    // from under it mid-play.
    const timer = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(timer);
  }, [flash, durationMs]);

  return { flash, arm, commit };
}
