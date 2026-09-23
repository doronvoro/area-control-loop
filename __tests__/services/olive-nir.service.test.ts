import { describe, it, expect } from 'vitest';
import { latestNirByArea, nirCountByAreaInSeason } from '@/lib/services/olive-nir.service';
import type { Season } from '@/types/database';

/**
 * The two reductions the olive dashboard runs over one NIR fetch.
 *
 * Both are pure on purpose: the route fetches the readings once and reads them
 * twice, so what is worth testing is the reduction, not the query. The season
 * bound is the part with teeth — it decides the "N בדיקות" line under each
 * plot's last-check date, and getting the edges wrong silently under- or
 * over-counts a plot's season.
 */

const SEASON = {
  id: 's1',
  name: '2026',
  starts_on: '2026-09-01',
  ends_on: '2026-12-31',
} as Season;

/** getNirReports' shape, cut down to what these two functions touch. */
function report(areaId: string, day: string | null, extra: Record<string, unknown> = {}) {
  return { id: `r-${areaId}-${day}`, area: { id: areaId }, report_date: day, ...extra };
}

describe('latestNirByArea', () => {
  it('keeps the first reading it sees per area', () => {
    // getNirReports orders newest first, so first seen is newest.
    const latest = latestNirByArea([
      report('a', '2026-09-20'),
      report('a', '2026-09-10'),
      report('b', '2026-09-15'),
    ]);

    expect(latest.a.report_date).toBe('2026-09-20');
    expect(latest.b.report_date).toBe('2026-09-15');
  });

  it('skips a row whose area embed did not come back', () => {
    const latest = latestNirByArea([{ id: 'r', area: null, report_date: '2026-09-20' }]);
    expect(latest).toEqual({});
  });

  it('is empty for no reports', () => {
    expect(latestNirByArea([])).toEqual({});
  });
});

describe('nirCountByAreaInSeason', () => {
  it('counts each area separately', () => {
    const counts = nirCountByAreaInSeason(
      [
        report('a', '2026-09-20'),
        report('a', '2026-09-10'),
        report('a', '2026-09-05'),
        report('b', '2026-09-15'),
      ],
      SEASON
    );

    expect(counts).toEqual({ a: 3, b: 1 });
  });

  it('includes both edges of the season', () => {
    const counts = nirCountByAreaInSeason(
      [report('a', '2026-12-31'), report('a', '2026-09-01')],
      SEASON
    );

    expect(counts.a).toBe(2);
  });

  it('drops readings outside the season', () => {
    const counts = nirCountByAreaInSeason(
      [
        report('a', '2026-09-20'),
        // The day before it opened, and the day after it closed.
        report('a', '2026-08-31'),
        report('a', '2027-01-01'),
      ],
      SEASON
    );

    expect(counts.a).toBe(1);
  });

  it('leaves out an area whose every reading predates the season', () => {
    // Absent, not 0 — "no reading this season" and "plot not loaded" stay
    // distinguishable, and the table prints no line for either.
    const counts = nirCountByAreaInSeason([report('a', '2025-10-01')], SEASON);

    expect(counts.a).toBeUndefined();
  });

  it('reads the day out of a timestamptz, not just a bare date', () => {
    const counts = nirCountByAreaInSeason([report('a', '2026-09-08T00:00:00+00:00')], SEASON);

    expect(counts.a).toBe(1);
  });

  it('counts everything when there is no active season', () => {
    const counts = nirCountByAreaInSeason(
      [report('a', '2020-01-01'), report('a', '2026-09-20')],
      null
    );

    expect(counts.a).toBe(2);
  });

  it('skips rows with no date and no area', () => {
    const counts = nirCountByAreaInSeason(
      [report('a', null), { id: 'r', area: null, report_date: '2026-09-20' }],
      SEASON
    );

    expect(counts).toEqual({});
  });
});
