import { NextResponse } from 'next/server';
import { getApiContext, requireAdminOrCustomerOwner } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { upsertWeatherThresholds } from '@/lib/services/olive-config.service';
import { parseWeatherThresholds } from '@/lib/olive/thresholds';

/**
 * The rain and wind levels at which a forecast day starts affecting urgency.
 *
 * WRITE ONLY, for the same reason /api/olive/category-thresholds has no GET:
 * /api/olive/dashboard already carries `weatherThresholds`, and /api/olive/weather
 * carries it for the weather screen. Every browser that needs the row is already
 * holding it.
 *
 * GLOBAL CONFIG. weather_alert_thresholds has no customer_id, and neither does
 * weather_days — the forecast is regional, so there is nothing per-tenant for
 * these levels to vary against. A customer_owner of one tenant therefore
 * retunes every tenant, which is why the write is gated and why the dialog says
 * so before you press save.
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    // THIS is the authorization. The write below runs on adminClient, which is
    // service-role and bypasses the table's "admin or owner manage" RLS policy
    // entirely — the policy is not covering this route.
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();

    // Same validator the settings dialog runs, so the two cannot disagree about
    // which levels are legal. Both columns carry a CHECK, and handleApiError
    // would hand a violation to the operator as a raw English 500.
    const parsed = parseWeatherThresholds(body);
    if (!parsed.ok) {
      const [first] = parsed.errors;
      return NextResponse.json({ error: first.message, field: first.field }, { status: 400 });
    }

    const saved = await upsertWeatherThresholds(ctx.adminClient, parsed.value);

    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // 42P01 is undefined_table: the code is deployed but the schema is not.
    // getWeatherThresholds() already swallows it on the read path so the
    // dashboard keeps flagging at the shipped levels; here it is actionable, so
    // say what to run rather than returning a 500 nobody can act on.
    if ((error as { code?: string }).code === '42P01') {
      return NextResponse.json(
        {
          error:
            'טבלת ספי מזג האוויר טרם נוצרה במסד הנתונים. יש להריץ את docs/rollout/10-weather-thresholds.sql',
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
