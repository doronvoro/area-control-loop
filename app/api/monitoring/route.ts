import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { createMonitoringBatch, createMonitoringSingle } from '@/lib/services/monitoring.service';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { data, error } = await ctx.supabase
      .from('monitoring_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:monitoring_treatments(
          *,
          material:materials(*),
          unit_type:unit_types(*),
        )`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

function isBatchRequest(body: any): boolean {
  return 'entries' in body && Array.isArray(body.entries);
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();

    if (isBatchRequest(body)) {
      if (!body.area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }
      if (body.entries.length === 0) {
        return NextResponse.json({ error: 'At least one entry is required' }, { status: 400 });
      }

      const results = await createMonitoringBatch(ctx.supabase, ctx.adminClient, {
        areaId: body.area_id,
        workerId: body.worker_id || body.inspector_id,
        reportDate: body.report_date,
        entries: body.entries,
      });
      return NextResponse.json(results, { status: 201 });
    }

    // Single entry
    const { area_id, area_report_id, worker_id, report_date, ...entryData } = body;
    if (!area_report_id && !area_id) {
      return NextResponse.json({ error: 'area_id or area_report_id is required' }, { status: 400 });
    }

    const result = await createMonitoringSingle(ctx.supabase, ctx.adminClient, {
      areaReportId: area_report_id,
      areaId: area_id,
      workerId: worker_id,
      reportDate: report_date,
      entry: entryData,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
