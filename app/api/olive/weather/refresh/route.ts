import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { refreshForecast } from '@/lib/services/olive-weather.service';

/**
 * Pull the 7-day forecast from Open-Meteo and store it.
 *
 * Server-side, so there is no CORS constraint and no API key. Manual overrides
 * are left untouched.
 */
export async function POST() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const days = await refreshForecast(ctx.adminClient);
    return NextResponse.json({ days, fetched_at: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
