import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireAdminOrCustomerOwner,
  requireWorkerAdminOrCustomer,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import {
  getParameters,
  getParameterRules,
  updateParameterRuleBounds,
} from '@/lib/services/olive-config.service';
import { parseAlertBounds, toAlertUpdates } from '@/lib/olive/thresholds';

/**
 * The parameter bands on their own.
 *
 * Any screen that scores a measurement needs parameter_rules, and until now the
 * only way to get them was /api/olive/dashboard — seven-plus parallel queries,
 * including an unbounded scan of every NIR report, to read one small lookup
 * table. The NIR form was paying exactly that.
 *
 * No customer scoping: parameters and their rules are global (RLS on both is
 * "Anyone can read"), which is also why this can be browser-cached.
 */
export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const [parameters, parameterRules] = await Promise.all([
      getParameters(ctx.supabase),
      getParameterRules(ctx.supabase),
    ]);

    return NextResponse.json(
      { parameters, parameterRules },
      // Private: the response is identical for every user, but the request is
      // cookie-authenticated, so it must not land in a shared cache.
      //
      // The 5 minutes cut both ways now that PUT exists. The editor's own
      // browser is fine — the settings dialog refetches with `cache: 'reload'`
      // straight after a successful save, which bypasses this entry and
      // replaces it. OTHER users keep the old bands for up to 5 minutes, which
      // for a config two people can touch and one log screen consumes is worth
      // the queries it saves. Drop to max-age=60 if that stops being true;
      // no-store would undo the reason this route exists.
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Retune the alert cascade.
 *
 * ONLY `upper_bound`, and only on the seven rows that have one. The body is
 * keyed by band NAME — `{ bounds: { oilLow: 17, ... } }` — and sort_order,
 * parameter_code, status, severity and message never appear on the wire at all.
 * The server resolves name → row from its own metadata, so a client cannot name
 * a rule row, reorder the cascade, create one, or reach any other column. That
 * is a property of the protocol here, not of the client behaving itself.
 *
 * GLOBAL CONFIG, like the GET above: these rules belong to no customer, so a
 * save here retunes urgency and the NIR pills for every tenant.
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    // THIS is the authorization. updateParameterRuleBounds writes on
    // adminClient, which is service-role and bypasses the table's "admin or
    // owner manage" RLS policy — the policy is not covering this route.
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();

    // Same validator the settings dialog runs, so the two cannot disagree about
    // which tunings are legal. Nothing in the database enforces cascade order:
    // an out-of-order bound would be accepted and would silently retire a band.
    const parsed = parseAlertBounds(body?.bounds ?? {});
    if (!parsed.ok) {
      const [first] = parsed.errors;
      return NextResponse.json({ error: first.message, field: first.field }, { status: 400 });
    }

    const updated = await updateParameterRuleBounds(ctx.adminClient, toAlertUpdates(parsed.value));

    return NextResponse.json({ updated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}
