'use client';

import { useCallback, useState } from 'react';
import { allNavGroups } from '@/lib/navigation';

/**
 * Which nav groups are folded away.
 *
 * Deliberately NOT persisted. Every page load starts from the group defaults,
 * so the menu always opens on the same view — olive expanded, everything else
 * folded — rather than on whatever happened to be left open earlier. Unfolding
 * a group is a one-off "show me that section now", not a preference.
 *
 * Distinct from 'sidebar-collapsed' in AppShell, which is the whole-sidebar
 * icon rail and does persist.
 */
const DEFAULT_COLLAPSED_IDS = allNavGroups.filter((g) => g.defaultCollapsed).map((g) => g.id);

export function useCollapsedNavGroups() {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>(DEFAULT_COLLAPSED_IDS);

  const setGroupOpen = useCallback((id: string, open: boolean) => {
    setCollapsedGroupIds((ids) =>
      open ? ids.filter((x) => x !== id) : ids.includes(id) ? ids : [...ids, id]
    );
  }, []);

  const openGroup = useCallback((id: string) => setGroupOpen(id, true), [setGroupOpen]);

  return { collapsedGroupIds, setGroupOpen, openGroup };
}
