import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCategoryThresholds, getWeatherThresholds } from '@/lib/services/olive-config.service';
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
