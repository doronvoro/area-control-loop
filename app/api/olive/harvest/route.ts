import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { getOliveAreaIds } from '@/lib/services/olive-plot.service';
import { AreaTypeId } from '@/types/database';
import {
  createHarvestReport,
  updateHarvestReport,
  deleteHarvestReport,
  getHarvestReports,
} from '@/lib/services/olive-harvest.service';

/** Accessible AND olive. A pest-management area is not a valid target here. */
async function accessibleAreaIds(ctx: any, override?: string | null): Promise<string[]> {
  const customerId = resolveCustomerId(ctx, override ?? null);
  const accessible = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);
  return getOliveAreaIds(ctx.supabase, accessible);
}

/** Writes use adminClient, which bypasses RLS — prove access with an RLS-scoped read. */
async function denyIfInaccessible(ctx: any, reportAreaId: string) {
  const { data } = await ctx.supabase
    .from('report_areas')
    .select('id')
    .eq('id', reportAreaId)
    .eq('area_type_id', AreaTypeId.HARVEST)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: 'אין הרשאה לדוח זה' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    let areaIds = await accessibleAreaIds(ctx, searchParams.get('customerId'));

    if (areaId) {
      areaIds = areaIds.filter((id) => id === areaId);
    }

    const reports = await getHarvestReports(ctx.supabase, areaIds);
    return NextResponse.json(reports);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { area_id, worker_id, report_date, notes, ...values } = body;

    if (!area_id) {
      return NextResponse.json({ error: 'נדרש לבחור חלקה' }, { status: 400 });
    }

    const areaIds = await accessibleAreaIds(ctx);
    if (!areaIds.includes(area_id)) {
      return NextResponse.json({ error: 'אין הרשאה לחלקה זו' }, { status: 403 });
    }

    const created = await createHarvestReport(ctx.supabase, ctx.adminClient, {
      areaId: area_id,
      workerId: worker_id || ctx.worker?.id,
      reportDate: report_date,
      notes,
      ...values,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { report_area_id, report_date, notes, ...values } = body;

    if (!report_area_id) {
      return NextResponse.json({ error: 'נדרש מזהה דוח' }, { status: 400 });
    }

    const denied = await denyIfInaccessible(ctx, report_area_id);
    if (denied) return denied;

    const updated = await updateHarvestReport(ctx.adminClient, report_area_id, {
      ...values,
      reportDate: report_date,
      notes,
    });

    return NextResponse.json(updated);
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
    const reportAreaId = searchParams.get('id');

    if (!reportAreaId) {
      return NextResponse.json({ error: 'נדרש מזהה דוח' }, { status: 400 });
    }

    const denied = await denyIfInaccessible(ctx, reportAreaId);
    if (denied) return denied;

    await deleteHarvestReport(ctx.adminClient, reportAreaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
