import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { getOlivePlots, upsertOlivePlotDetails } from '@/lib/services/olive-plot.service';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);

    const plots = await getOlivePlots(ctx.supabase, areaIds);
    return NextResponse.json(plots);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Update the olive-specific fields of a plot.
 *
 * The plot's own columns (name, variety, planting_time, size) live on `areas`
 * and are edited through /api/areas — this endpoint owns olive_plot_details only.
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { area_id, ...details } = body;

    if (!area_id) {
      return NextResponse.json({ error: 'נדרש מזהה חלקה' }, { status: 400 });
    }

    const customerId = resolveCustomerId(ctx, null);
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);
    if (!areaIds.includes(area_id)) {
      return NextResponse.json({ error: 'אין הרשאה לחלקה זו' }, { status: 403 });
    }

    const saved = await upsertOlivePlotDetails(ctx.adminClient, area_id, details);
    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
