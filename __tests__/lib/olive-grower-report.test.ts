import { describe, it, expect } from 'vitest';

import {
  groupByUrgency,
  atAGlance,
  LEVEL_ORDER,
  LEVEL_TITLES,
  UNSAMPLED,
  type UrgencyEntry,
} from '@/lib/olive/report/urgency-groups';

/**
 * The grower season report's ordering.
 *
 * The report exists to answer "what needs picking this week", so the ordering IS
 * the feature — a correct set of plots in the wrong order is a worse document
 * than a shorter one. These pin the three properties that carry that: urgency
 * first, unsampled plots present rather than dropped, and empty levels absent
 * rather than printed as a zero.
 */

const entry = (level: UrgencyEntry['level'], sortKey: string): UrgencyEntry => ({ level, sortKey });

describe('groupByUrgency', () => {
  it('orders urgent before plan before ok, with unsampled last', () => {
    const groups = groupByUrgency([
      entry('ok', 'ג'),
      entry(UNSAMPLED, 'ד'),
      entry('urgent', 'א'),
      entry('plan', 'ב'),
    ]);

    expect(groups.map((g) => g.level)).toEqual(['urgent', 'plan', 'ok', UNSAMPLED]);
    expect(groups.map((g) => g.title)).toEqual([
      'דחוף/מיידי',
      'תכנון לקראת מסיק',
      'ללא דחיפות מיוחדת',
      'טרם נדגמה',
    ]);
  });

  it('drops levels with no plots rather than printing a zero', () => {
    const groups = groupByUrgency([entry('ok', 'א'), entry('ok', 'ב')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].level).toBe('ok');
    expect(groups[0].entries).toHaveLength(2);
  });

  it('keeps unsampled plots instead of silently omitting them', () => {
    // Two thirds of the estate has one reading or none; a report that quietly
    // left those out would look complete and be wrong.
    const groups = groupByUrgency([entry(UNSAMPLED, 'א'), entry('urgent', 'ב')]);

    expect(groups.flatMap((g) => g.entries)).toHaveLength(2);
    expect(groups.at(-1)!.level).toBe(UNSAMPLED);
  });

  it('sorts within a group by Hebrew collation', () => {
    const groups = groupByUrgency([
      entry('ok', 'שדות — 2023 — פיקואל'),
      entry('ok', 'זית בית — 2014 — סורי'),
      entry('ok', 'מנחת — 2019 — ארבקינה'),
    ]);

    expect(groups[0].entries.map((e) => e.sortKey)).toEqual([
      'זית בית — 2014 — סורי',
      'מנחת — 2019 — ארבקינה',
      'שדות — 2023 — פיקואל',
    ]);
  });

  it('returns nothing for a grower with no plots', () => {
    expect(groupByUrgency([])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = [entry('ok', 'ב'), entry('ok', 'א')];
    const snapshot = input.map((e) => e.sortKey);
    groupByUrgency(input);
    expect(input.map((e) => e.sortKey)).toEqual(snapshot);
  });

  it('keeps UNSAMPLED out of the urgency levels proper', () => {
    // It is not a verdict about the fruit, so it must sort after every level
    // that is.
    expect(LEVEL_ORDER[UNSAMPLED]).toBeGreaterThan(LEVEL_ORDER.ok);
    expect(LEVEL_TITLES[UNSAMPLED]).toBe('טרם נדגמה');
  });
});

describe('atAGlance', () => {
  it('lists only what can be acted on, urgent first', () => {
    const glance = atAGlance([
      entry('ok', 'ג'),
      entry('plan', 'ב'),
      entry(UNSAMPLED, 'ד'),
      entry('urgent', 'א'),
    ]);

    expect(glance.map((e) => e.level)).toEqual(['urgent', 'plan']);
  });

  it('does not cap the list', () => {
    // The prototype sliced to five because the block sat above the fold on a
    // screen. On paper there is no fold, and a customer told about five of seven
    // urgent plots has been misinformed.
    const many = Array.from({ length: 7 }, (_, i) => entry('urgent', `plot-${i}`));
    expect(atAGlance(many)).toHaveLength(7);
  });

  it('is empty when nothing needs attention', () => {
    expect(atAGlance([entry('ok', 'א'), entry(UNSAMPLED, 'ב')])).toEqual([]);
  });
});
