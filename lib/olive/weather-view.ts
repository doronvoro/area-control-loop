/**
 * Display helpers for the forecast strip.
 *
 * Pure, like lib/olive/thresholds.ts, and deliberately NOT in logic.ts: how a
 * date is spelled and how old a fetch is are presentation concerns, and logic.ts
 * is tuned decision logic under Spec §7.2 that should not grow either.
 */

/**
 * How old a forecast has to be before the dashboard says so.
 *
 * Two days, because nothing refreshes on a schedule — there is no cron anywhere
 * in the repo, only the "רענן תחזית" button on /olive/weather. A forecast that
 * nobody has pulled since the day before yesterday is describing a week that has
 * already partly happened.
 */
export const FORECAST_STALE_DAYS = 2;

export interface ForecastFreshness {
  /** ISO timestamp of the newest fetched row. */
  updatedAt: string;
  /** Whole days between that fetch and `now`, never negative. */
  daysOld: number;
  stale: boolean;
}

/**
 * When the forecast was last pulled, from the raw weather_days payload.
 *
 * Manual rows are ignored on purpose: someone typing tomorrow's rain by hand
 * says nothing about whether the *forecast* is current, and counting it would
 * make a stale week look fresh the moment anyone entered an override.
 *
 * Returns null when there is nothing fetched to date — the caller then says the
 * update time is unknown rather than implying the data is new.
 */
export function forecastFreshness(
  rows: Record<string, unknown>[],
  now: Date
): ForecastFreshness | null {
  let newest: string | null = null;

  for (const row of rows) {
    if (row.is_manual) continue;

    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
    if (!updatedAt) continue;

    if (newest === null || updatedAt > newest) newest = updatedAt;
  }

  if (newest === null) return null;

  const then = new Date(newest);
  if (Number.isNaN(then.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const elapsed = (startOfToday.getTime() - startOfThen.getTime()) / (1000 * 60 * 60 * 24);

  // A clock skew that puts the fetch in the future reads as "today", not as a
  // negative age that would render "לפני -1 ימים".
  const daysOld = Math.max(0, Math.floor(elapsed));

  return { updatedAt: newest, daysOld, stale: daysOld >= FORECAST_STALE_DAYS };
}

/** 'א׳'..'ו׳' by getDay(); Saturday is named outright below. */
const WEEKDAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];

/**
 * A forecast date as a chip reads it: a day name and a short date.
 *
 * Hardcoded weekday letters rather than toLocaleDateString('he-IL', { weekday }),
 * whose output varies with the ICU data a given Node build ships — the strip
 * would read differently in dev, on Vercel and in the test runner.
 *
 * daysSinceLabel() in logic.ts is the equivalent for the past; it returns null
 * for any future date, which is every date this function is called with.
 */
export function formatForecastDay(entryDate: string, now: Date): { label: string; date: string } {
  // Local midnight, the idiom daysSinceLabel documents. Parsing the bare
  // 'YYYY-MM-DD' would be treated as UTC and shift the day in Asia/Jerusalem.
  const day = new Date(`${entryDate.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(day.getTime())) return { label: '—', date: entryDate };

  const date = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((day.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'היום', date };
  if (diffDays === 1) return { label: 'מחר', date };

  const weekday = day.getDay();
  const label = weekday === 6 ? 'שבת' : `יום ${WEEKDAY_LETTERS[weekday]}`;

  return { label, date };
}
