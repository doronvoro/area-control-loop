import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import {
  getWeatherDays,
  upsertManualWeather,
  deleteManualWeather,
} from '@/lib/services/olive-weather.service';
import { getWeatherThresholds } from '@/lib/services/olive-config.service';

function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || todayString();

    // The levels ride along because this screen prints them in its caption and
    // bolds cells against them. Fetching them separately would let the page
    // state one number while the flags fire on another.
    const [days, thresholds] = await Promise.all([
      getWeatherDays(ctx.supabase, from),
      getWeatherThresholds(ctx.supabase),
    ]);

    return NextResponse.json({ days, thresholds });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Record a manual override, which wins over the fetched forecast for that date. */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { entry_date, rain_mm, wind_kmh, temp_min, temp_max } = body;

    if (!entry_date) {
      return NextResponse.json({ error: 'נדרש תאריך' }, { status: 400 });
    }

    const saved = await upsertManualWeather(ctx.adminClient, {
      entryDate: entry_date,
      rainMm: rain_mm === '' || rain_mm == null ? null : Number(rain_mm),
      windKmh: wind_kmh === '' || wind_kmh == null ? null : Number(wind_kmh),
      tempMin: temp_min === '' || temp_min == null ? null : Number(temp_min),
      tempMax: temp_max === '' || temp_max == null ? null : Number(temp_max),
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const entryDate = searchParams.get('date');

    if (!entryDate) {
      return NextResponse.json({ error: 'נדרש תאריך' }, { status: 400 });
    }

    await deleteManualWeather(ctx.adminClient, entryDate);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
