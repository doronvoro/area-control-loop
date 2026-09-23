import { describe, it, expect, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  refreshForecast,
  WEATHER_LATITUDE,
  WEATHER_LONGITUDE,
} from '@/lib/services/olive-weather.service';

/**
 * The forecast pull, which now runs unattended from the nightly cron
 * (vercel.json → /api/cron/weather) as well as from the "רענן תחזית" button.
 *
 * The case worth reading before changing anything here is the upsert conflict
 * target. `weather_days` holds at most two rows per date — the fetched forecast
 * and a manual override entered in the field — separated only by is_manual, and
 * the ON CONFLICT clause is the single line that keeps a nightly refresh from
 * overwriting what someone measured by hand.
 *
 * The error paths all assert Hebrew, because every one of them reaches a person:
 * handleApiError puts error.message straight into the toast behind the button.
 */

/** Captures what was upserted, and with which options. */
interface UpsertCall {
  rows: Record<string, unknown>[];
  options: unknown;
}

function capturingClient(): { client: SupabaseClient; calls: UpsertCall[] } {
  const calls: UpsertCall[] = [];
  const builder = {
    upsert(rows: Record<string, unknown>[], options: unknown) {
      calls.push({ rows, options });
      return {
        select: () => Promise.resolve({ data: rows, error: null }),
      };
    },
  };
  return { client: { from: () => builder } as unknown as SupabaseClient, calls };
}

/** A minimal Open-Meteo payload: two days, every metric present. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    daily: {
      time: ['2026-09-22', '2026-09-23'],
      temperature_2m_min: [18.4, 19.1],
      temperature_2m_max: [31.2, 33.0],
      precipitation_sum: [0, 4.6],
      wind_speed_10m_max: [12.5, 27.8],
      ...overrides,
    },
  };
}

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the request', () => {
  it('asks Open-Meteo for seven days at the grove', () => {
    // Asserted by substring rather than whole-URL equality: the lat/lon and the
    // window are the contract, the parameter order is not.
    const fetchMock = respondWith(payload());
    const { client } = capturingClient();

    return refreshForecast(client).then(() => {
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain(`latitude=${WEATHER_LATITUDE}`);
      expect(url).toContain(`longitude=${WEATHER_LONGITUDE}`);
      expect(url).toContain('forecast_days=7');
      // Dates come back in grove-local time, which is what entry_date means.
      expect(url).toContain('timezone=Asia/Jerusalem');
    });
  });

  it('never serves a cached forecast', async () => {
    const fetchMock = respondWith(payload());
    const { client } = capturingClient();

    await refreshForecast(client);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });

  it('carries an abort signal so a hung connection cannot stall the job', async () => {
    const fetchMock = respondWith(payload());
    const { client } = capturingClient();

    await refreshForecast(client);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('what gets stored', () => {
  it('maps each day onto a fetched row', async () => {
    respondWith(payload());
    const { client, calls } = capturingClient();

    await refreshForecast(client);

    expect(calls).toHaveLength(1);
    expect(calls[0].rows).toHaveLength(2);
    expect(calls[0].rows[0]).toMatchObject({
      entry_date: '2026-09-22',
      temp_min: 18.4,
      temp_max: 31.2,
      rain_mm: 0,
      wind_kmh: 12.5,
      is_manual: false,
    });
    // updated_at is what forecastFreshness reads to decide the dashboard shows
    // "התחזית לא עודכנה", so every row must carry one.
    expect(typeof calls[0].rows[0].updated_at).toBe('string');
  });

  it('upserts on (entry_date, is_manual) so manual overrides survive', async () => {
    // The single most important assertion in this file. Widen the conflict
    // target to entry_date alone and the nightly cron silently deletes every
    // number anyone entered by hand.
    respondWith(payload());
    const { client, calls } = capturingClient();

    await refreshForecast(client);

    expect(calls[0].options).toEqual({ onConflict: 'entry_date,is_manual' });
    expect(calls[0].rows.every((row) => row.is_manual === false)).toBe(true);
  });

  it('writes null, not undefined, for a metric Open-Meteo omitted', async () => {
    // A key left out of the row object would leave the previous value in place
    // on an upsert; an explicit null clears it.
    respondWith(payload({ precipitation_sum: undefined, wind_speed_10m_max: [5.0] }));
    const { client, calls } = capturingClient();

    await refreshForecast(client);

    expect(calls[0].rows[0].rain_mm).toBeNull();
    // Second day is past the end of the shorter array.
    expect(calls[0].rows[1].wind_kmh).toBeNull();
  });
});

describe('failures a person will read', () => {
  it('reports the status when Open-Meteo refuses', async () => {
    respondWith({}, { ok: false, status: 503 });
    const { client } = capturingClient();

    await expect(refreshForecast(client)).rejects.toThrow('שגיאה בקבלת תחזית מזג האוויר (503)');
  });

  it('reports an empty forecast rather than storing nothing silently', async () => {
    const { client, calls } = capturingClient();

    respondWith({ daily: { time: [] } });
    await expect(refreshForecast(client)).rejects.toThrow('תחזית מזג האוויר חזרה ריקה');

    respondWith({});
    await expect(refreshForecast(client)).rejects.toThrow('תחזית מזג האוויר חזרה ריקה');

    expect(calls).toHaveLength(0);
  });

  it('translates a timeout, and keeps the original as cause', async () => {
    // AbortSignal.timeout rejects with a DOMException whose message is English;
    // it would otherwise land in the toast verbatim.
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    const { client } = capturingClient();

    await expect(refreshForecast(client)).rejects.toMatchObject({
      message: 'שירות התחזית לא הגיב בזמן',
      cause: timeout,
    });
  });

  it('translates a network failure too', async () => {
    const offline = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(offline));
    const { client } = capturingClient();

    await expect(refreshForecast(client)).rejects.toMatchObject({
      message: 'שגיאה בקבלת תחזית מזג האוויר',
      cause: offline,
    });
  });
});
