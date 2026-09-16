import { NextResponse } from 'next/server';
import { getApiContext, requireAdminOrCustomerOwner } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { isMissingTableError } from '@/lib/supabase/errors';
import { upsertCategoryThresholds } from '@/lib/services/olive-config.service';
import { parseCategoryThresholds } from '@/lib/olive/thresholds';

/**
 * The bands behind the four status cards on /olive.
 *
 * WRITE ONLY. There is no GET because /api/olive/dashboard already carries
 * `categoryThresholds` in the payload every consumer of this data has loaded
 * anyway — a second endpoint would be a second round-trip for a row the browser
 * is already holding.
 *
 * GLOBAL CONFIG. plot_category_thresholds has no customer_id: one row, read by
 * every tenant, the same reach variety_windows and weather_days already have.
 * A customer_owner of one tenant therefore retunes every tenant's dashboard.
 * That is the shape the table was given deliberately, not an oversight — but it
 * is why the write is gated to admin/customer_owner and why the dialog says so
 * in as many words before you press save.
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

    // Every column carries a CHECK. Validating here, with the same function the
    // dialog validates with, is what keeps a constraint violation from reaching
    // the operator as a raw English 500 out of handleApiError.
    const parsed = parseCategoryThresholds(body);
    if (!parsed.ok) {
      const [first] = parsed.errors;
      return NextResponse.json({ error: first.message, field: first.field }, { status: 400 });
    }

    const saved = await upsertCategoryThresholds(ctx.adminClient, parsed.value);

    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // The code is deployed but the schema is not — PGRST205, since PostgREST
    // answers an unknown table out of its schema cache and never reaches
    // Postgres to raise 42P01.
    // getCategoryThresholds() already swallows it on the read path so the
    // dashboard keeps working on defaults; here it is actionable, so say what
    // to run rather than returning a 500 nobody can act on.
    if (isMissingTableError(error)) {
      return NextResponse.json(
        {
          error:
            'טבלת ספי הסטטוס טרם נוצרה במסד הנתונים. יש להריץ את docs/rollout/09-category-thresholds.sql',
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
