/**
 * Ordering and bucketing for the grower season report.
 *
 * The report's job is "what needs picking this week", so the plots are grouped
 * by harvest urgency and the urgent ones come first. The levels, their order and
 * their Hebrew titles are the prototype's own (docs/code.html:6099-6100) — the
 * client already reads these words on the alerts screen, and inventing new ones
 * for the printed version would be a second vocabulary for one idea.
 *
 * A fourth bucket, טרם נדגמה, holds plots with no reading at all. The prototype
 * never needed it: its alerts screen shows only plots you might act on. A report
 * that silently omits a third of the estate is a different thing from a report
 * that says those plots have not been sampled, and the second is the honest one.
 *
 * Pure, like lib/olive/report/chart-scale.ts — computePlotStatus decides the
 * level, this only orders the result.
 */

import type { UrgencyLevel } from '@/lib/olive/logic';

/** Plots with no NIR reading; not an urgency, so it sorts after all of them. */
export const UNSAMPLED = 'unsampled' as const;

export type GroupKey = UrgencyLevel | typeof UNSAMPLED;

export const LEVEL_ORDER: Record<GroupKey, number> = {
  urgent: 0,
  plan: 1,
  ok: 2,
  [UNSAMPLED]: 3,
};

export const LEVEL_TITLES: Record<GroupKey, string> = {
  urgent: 'דחוף/מיידי',
  plan: 'תכנון לקראת מסיק',
  ok: 'ללא דחיפות מיוחדת',
  [UNSAMPLED]: 'טרם נדגמה',
};

export interface UrgencyEntry {
  /** The grouping key; UNSAMPLED when the plot has no reading. */
  level: GroupKey;
  /** Sorted within a group, ascending. Null sorts last. */
  sortKey: string;
}

export interface UrgencyGroup<T extends UrgencyEntry> {
  level: GroupKey;
  title: string;
  entries: T[];
}

/**
 * Buckets by level, drops empty groups, sorts within each by name.
 *
 * Empty groups are dropped rather than rendered with a zero: a printed section
 * headed "דחוף/מיידי · 0" reads like a system that failed to fill it in, where
 * its absence reads as nothing being urgent.
 */
export function groupByUrgency<T extends UrgencyEntry>(entries: T[]): UrgencyGroup<T>[] {
  const byLevel = new Map<GroupKey, T[]>();

  for (const entry of entries) {
    const bucket = byLevel.get(entry.level);
    if (bucket) bucket.push(entry);
    else byLevel.set(entry.level, [entry]);
  }

  return [...byLevel.entries()]
    .sort(([a], [b]) => LEVEL_ORDER[a] - LEVEL_ORDER[b])
    .map(([level, group]) => ({
      level,
      title: LEVEL_TITLES[level],
      // Hebrew collation, so מנחת and שדות order the way the plots screen shows
      // them rather than by code point.
      entries: [...group].sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'he')),
    }));
}

/**
 * The plots worth leading with — everything the grower might act on now.
 *
 * The prototype capped its on-screen "מבט על" at five because the list sat above
 * the fold. On paper there is no fold, and a customer told about three of seven
 * urgent plots has been misled, so this returns all of them.
 */
export function atAGlance<T extends UrgencyEntry>(entries: T[]): T[] {
  return entries
    .filter((e) => e.level === 'urgent' || e.level === 'plan')
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.sortKey.localeCompare(b.sortKey, 'he')
    );
}
