import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Regional weather for the harvest decision.
 *
 * Two rows may exist per date: the fetched forecast and a manual override.
 * lib/olive/logic.ts applies the manual one second so it wins. Weather is
 * regional rather than per-plot, which is why nothing here is customer-scoped.
 */

// Kibbutz Gashur, southern Golan Heights. Spec §4.4.
export const WEATHER_LATITUDE = 32.8194;
export const WEATHER_LONGITUDE = 35.7156;

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${WEATHER_LATITUDE}&longitude=${WEATHER_LONGITUDE}` +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
  '&timezone=Asia/Jerusalem&forecast_days=7';

// --- Types ---

export interface ManualWeatherInput {
  entryDate: string;
  rainMm?: number | null;
  windKmh?: number | null;
  tempMin?: number | null;
  tempMax?: number | null;
}

// --- Public API ---

/** Weather rows from `fromDate` onward, oldest first. Both sources included. */
export async function getWeatherDays(supabase: SupabaseClient, fromDate: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('weather_days')
    .select('*')
    .gte('entry_date', fromDate)
    .order('entry_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch the 7-day forecast from Open-Meteo and store it.
 *
 * Called server-side so there is no CORS constraint and no API key. The
 * prototype routed this through the Claude API only because its sandbox blocked
 * third-party hosts; that limitation does not apply here.
 *
 * Manual rows are untouched — the upsert targets (entry_date, is_manual) with
 * is_manual false, so an override entered in the field survives a refresh.
 */
export async function refreshForecast(adminClient: SupabaseClient): Promise<any[]> {
  const response = await fetch(OPEN_METEO_URL, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`שגיאה בקבלת תחזית מזג האוויר (${response.status})`);
  }

  const payload = await response.json();
  const daily = payload?.daily;

  if (!daily?.time?.length) {
    throw new Error('תחזית מזג האוויר חזרה ריקה');
  }

  const rows = daily.time.map((date: string, i: number) => ({
    entry_date: date,
    temp_min: daily.temperature_2m_min?.[i] ?? null,
    temp_max: daily.temperature_2m_max?.[i] ?? null,
    rain_mm: daily.precipitation_sum?.[i] ?? null,
    wind_kmh: daily.wind_speed_10m_max?.[i] ?? null,
    is_manual: false,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await (adminClient.from('weather_days') as any)
    .upsert(rows, { onConflict: 'entry_date,is_manual' })
    .select();

  if (error) throw error;
  return data || [];
}

/** Record or replace a manual override for one date. */
export async function upsertManualWeather(
  adminClient: SupabaseClient,
  input: ManualWeatherInput
): Promise<any> {
  const { data, error } = await (adminClient.from('weather_days') as any)
    .upsert(
      {
        entry_date: input.entryDate,
        temp_min: input.tempMin ?? null,
        temp_max: input.tempMax ?? null,
        rain_mm: input.rainMm ?? null,
        wind_kmh: input.windKmh ?? null,
        is_manual: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_date,is_manual' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteManualWeather(
  adminClient: SupabaseClient,
  entryDate: string
): Promise<void> {
  const { error } = await (adminClient.from('weather_days') as any)
    .delete()
    .eq('entry_date', entryDate)
    .eq('is_manual', true);

  if (error) throw error;
}
