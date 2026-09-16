import { describe, it, expect } from 'vitest';
import {
  forecastFreshness,
  formatForecastDay,
  FORECAST_STALE_DAYS,
} from '@/lib/olive/weather-view';

/**
 * Display helpers for the forecast strip on /olive.
 *
 * Nothing here decides anything — but both functions sit on top of date
 * arithmetic that has already bitten this module once (daysSinceLabel silently
 * returned null for every plot because a timestamptz was parsed as a date), so
 * the traps are pinned rather than trusted.
 */

const NOW = new Date(2026, 9, 15); // 15 Oct 2026, local time — same instant olive-logic.test.ts uses

// ─── formatForecastDay ───────────────────────────────────────────────────────

describe('formatForecastDay', () => {
  it('names today and tomorrow rather than their weekday', () => {
    expect(formatForecastDay('2026-10-15', NOW)).toEqual({ label: 'היום', date: '15/10' });
    expect(formatForecastDay('2026-10-16', NOW)).toEqual({ label: 'מחר', date: '16/10' });
  });

  it('names every other day by its weekday', () => {
    // 18 Oct 2026 is a Sunday.
    expect(formatForecastDay('2026-10-18', NOW)).toEqual({ label: 'יום א׳', date: '18/10' });
    expect(formatForecastDay('2026-10-19', NOW).label).toBe('יום ב׳');
  });

  // Saturday is the one weekday that is not "יום X׳" — rendering it as
  // "יום ש׳" would be wrong Hebrew, not merely unusual.
  it('names Saturday outright', () => {
    expect(formatForecastDay('2026-10-17', NOW)).toEqual({ label: 'שבת', date: '17/10' });
  });

  /**
   * The local-midnight parse. `new Date('2026-11-01')` is UTC midnight, which in
   * Asia/Jerusalem is 2 AM on the 1st — but for a timezone behind UTC it would
   * be the 31st, and the strip would label a day that is not the day.
   */
  it('parses at local midnight, so the date never slips by one', () => {
    expect(formatForecastDay('2026-11-01', NOW).date).toBe('01/11');
  });

  it('accepts a full ISO timestamp, not only a bare date', () => {
    expect(formatForecastDay('2026-10-16T00:00:00+00:00', NOW).label).toBe('מחר');
  });

  it('degrades to the raw value rather than rendering Invalid Date', () => {
    expect(formatForecastDay('not-a-date', NOW)).toEqual({ label: '—', date: 'not-a-date' });
  });
});

// ─── forecastFreshness ───────────────────────────────────────────────────────

/** A weather_days row as the dashboard payload carries it. */
function row(updatedAt: string | null, isManual = false): Record<string, unknown> {
  return { entry_date: '2026-10-16', updated_at: updatedAt, is_manual: isManual };
}

describe('forecastFreshness', () => {
  it('reports the newest fetched row', () => {
    const result = forecastFreshness(
      [row('2026-10-13T06:00:00Z'), row('2026-10-14T06:00:00Z'), row('2026-10-12T06:00:00Z')],
      NOW
    );

    expect(result?.updatedAt).toBe('2026-10-14T06:00:00Z');
    expect(result?.daysOld).toBe(1);
    expect(result?.stale).toBe(false);
  });

  /**
   * Someone typing tomorrow's rain by hand says nothing about when the forecast
   * was last pulled. Counting it would clear the stale warning at the exact
   * moment an operator was compensating for stale data by hand.
   */
  it('ignores manual rows, however recent', () => {
    const result = forecastFreshness(
      [row('2026-10-01T06:00:00Z'), row('2026-10-15T06:00:00Z', true)],
      NOW
    );

    expect(result?.updatedAt).toBe('2026-10-01T06:00:00Z');
    expect(result?.stale).toBe(true);
  });

  it('is stale at exactly the threshold', () => {
    const daysAgo = new Date(2026, 9, 15 - FORECAST_STALE_DAYS, 6).toISOString();
    expect(forecastFreshness([row(daysAgo)], NOW)?.stale).toBe(true);

    const oneFewer = new Date(2026, 9, 16 - FORECAST_STALE_DAYS, 6).toISOString();
    expect(forecastFreshness([row(oneFewer)], NOW)?.stale).toBe(false);
  });

  // Clock skew between the browser and the database would otherwise render
  // "עודכנה לפני -1 ימים".
  it('clamps a future timestamp to today rather than going negative', () => {
    const result = forecastFreshness([row('2026-10-20T06:00:00Z')], NOW);

    expect(result?.daysOld).toBe(0);
    expect(result?.stale).toBe(false);
  });

  it('returns null when there is nothing fetched to date', () => {
    expect(forecastFreshness([], NOW)).toBeNull();
    expect(forecastFreshness([row(null)], NOW)).toBeNull();
    expect(forecastFreshness([row('2026-10-14T06:00:00Z', true)], NOW)).toBeNull();
  });

  it('returns null rather than NaN for an unparseable timestamp', () => {
    expect(forecastFreshness([row('not-a-timestamp')], NOW)).toBeNull();
  });
});
