import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getActiveSeason,
  getCategoryThresholds,
  getWeatherThresholds,
} from '@/lib/services/olive-config.service';
import { isMissingTableError } from '@/lib/supabase/errors';

/**
 * The two config lookups that must survive their own table not existing yet.
 *
 * This repo deploys code to Vercel on merge and applies production schema by
 * hand afterwards (docs/rollout/README.md), so between the two there is a live
 * window where `plot_category_thresholds` and `weather_alert_thresholds` are
 * read and are not there. Both lookups are supposed to fall back to the seeded
 * defaults across that window. They did not: they matched on 42P01, and the
 * error PostgREST actually returns is PGRST205 — so /api/olive/dashboard and
 * /api/olive/weather both 500'd on the deploy that introduced the second table.
 */

/**
 * Recorded verbatim from PostgREST (Supabase local, supabase-js 2.91), by
 * selecting from a table that does not exist:
 *
 *   curl "$URL/rest/v1/does_not_exist?select=*" -H "apikey: $ANON" → HTTP 404
 *
 * If this ever needs updating, re-run that curl rather than guessing the code.
 */
const MISSING_TABLE_ERROR = {
  code: 'PGRST205',
  details: null,
  hint: "Perhaps you meant the table 'public.weather_alert_thresholds'",
  message: "Could not find the table 'public.weather_alert_thresholds_nope' in the schema cache",
};

/** A client whose every read fails the same way. */
interface FailingBuilder {
  select: () => FailingBuilder;
  eq: () => FailingBuilder;
  maybeSingle: () => Promise<{ data: null; error: unknown }>;
}

function failingWith(error: unknown): SupabaseClient {
  const result = Promise.resolve({ data: null, error });
  const builder: FailingBuilder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => result,
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

describe('isMissingTableError', () => {
  it('recognises what PostgREST returns for a table that is not there', () => {
    expect(isMissingTableError(MISSING_TABLE_ERROR)).toBe(true);
  });

  it("recognises Postgres's own undefined_table, which an RPC can still raise", () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
  });

  it('is not a catch-all: a permission error is a real failure', () => {
    expect(isMissingTableError({ code: '42501' })).toBe(false);
    expect(isMissingTableError(new Error('network'))).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});

describe('getWeatherThresholds', () => {
  it('returns null when the table is missing, so the dashboard falls back', async () => {
    expect(await getWeatherThresholds(failingWith(MISSING_TABLE_ERROR))).toBeNull();
  });

  it('still throws on any other error', async () => {
    await expect(getWeatherThresholds(failingWith({ code: '42501' }))).rejects.toBeTruthy();
  });
});

describe('getCategoryThresholds', () => {
  it('returns null when the table is missing, so the cards fall back', async () => {
    expect(await getCategoryThresholds(failingWith(MISSING_TABLE_ERROR))).toBeNull();
  });

  it('still throws on any other error', async () => {
    await expect(getCategoryThresholds(failingWith({ code: '42501' }))).rejects.toBeTruthy();
  });
});

/**
 * A stand-in for the `seasons` table that reproduces PostgREST's single-object
 * semantics: `maybeSingle()` tolerates zero rows but returns PGRST116 for two,
 * and `limit(n)` is applied before that check.
 *
 * Recorded verbatim from PostgREST (Supabase local) by selecting is_active=true
 * with two active rows and Accept: application/vnd.pgrst.object+json → HTTP 406
 * {"code":"PGRST116","details":"The result contains 2 rows",...}.
 */
function seasonsTable(rows: { id: string; starts_on: string }[]): SupabaseClient {
  let working = [...rows];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    order: (_column: string, opts?: { ascending?: boolean }) => {
      working = [...working].sort((a, b) =>
        opts?.ascending === false
          ? b.starts_on.localeCompare(a.starts_on)
          : a.starts_on.localeCompare(b.starts_on)
      );
      return builder;
    },
    limit: (n: number) => {
      working = working.slice(0, n);
      return builder;
    },
    maybeSingle: async () =>
      working.length > 1
        ? {
            data: null,
            error: { code: 'PGRST116', details: `The result contains ${working.length} rows` },
          }
        : { data: working[0] ?? null, error: null },
  });
  return { from: () => builder } as unknown as SupabaseClient;
}

/**
 * is_active is a single-winner flag by convention only — no partial unique
 * index enforces it — and /admin/olive-import used to leave a second season
 * active. A bare maybeSingle() over that returns PGRST116, which this function
 * swallows into null, and "no season" blanks every yield estimate in the app.
 */
describe('getActiveSeason', () => {
  it('returns the active season', async () => {
    const season = await getActiveSeason(seasonsTable([{ id: 'a', starts_on: '2026-09-01' }]));
    expect((season as { id: string } | null)?.id).toBe('a');
  });

  it('returns null when no season is active', async () => {
    expect(await getActiveSeason(seasonsTable([]))).toBeNull();
  });

  it('picks the newest rather than collapsing to null when two are active', async () => {
    const season = await getActiveSeason(
      seasonsTable([
        { id: 'old', starts_on: '2025-09-01' },
        { id: 'new', starts_on: '2026-09-01' },
      ])
    );
    expect((season as { id: string } | null)?.id).toBe('new');
  });
});
