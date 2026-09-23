import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isAuthorizedCronRequest } from '@/lib/api/cron-auth';
import { handleApiError } from '@/lib/api-utils';
import { refreshForecast } from '@/lib/services/olive-weather.service';

/**
 * The nightly forecast pull. Scheduled in vercel.json; see lib/api/cron-auth.ts.
 *
 * Authenticated by CRON_SECRET, NOT by a session. Vercel sends an anonymous GET
 * with `Authorization: Bearer <CRON_SECRET>` and no cookies, so getApiContext()
 * — which every other route in this repo opens with — would throw AuthError(401)
 * here before any work happened. Do not add it.
 *
 * The request reaches this handler at all only because lib/supabase/middleware.ts
 * short-circuits any `Bearer` request under /api/. That bypass is load-bearing:
 * without it the cron is redirected to /login, and Vercel treats a 3xx as a
 * completed invocation *and does not log it*, so the job would fail invisibly.
 *
 * Nothing here is idempotency-critical because refreshForecast upserts on
 * (entry_date, is_manual) — a duplicate delivery rewrites the same seven rows
 * and never touches a manual override. Vercel never retries a failed run, so the
 * alarm for a broken schedule is the dashboard's stale-forecast pill
 * (FORECAST_STALE_DAYS in lib/olive/weather-view.ts), not anything in here.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    // Only Vercel's own agent is worth a log line: a secret mismatch is an
    // outage you need to see, while drive-by scanners would just bill you for
    // log volume. The header is a hint for logging — never for auth, since
    // anyone can send it.
    if (request.headers.get('user-agent') === 'vercel-cron/1.0') {
      console.error('[cron/weather] rejected a Vercel cron invocation — CRON_SECRET mismatch');
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const days = await refreshForecast(createAdminClient());
    console.log(`[cron/weather] stored ${days.length} forecast days`);
    return NextResponse.json({
      ok: true,
      days: days.length,
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    // The status code is the only thing Vercel surfaces on the cron row, so this
    // must not be swallowed into a 200. The log line says which failure it was.
    console.error('[cron/weather] refresh failed:', error);
    return handleApiError(error);
  }
}
