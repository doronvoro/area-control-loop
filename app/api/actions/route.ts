import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerOrAdmin } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { createActionBatch, createActionSingle } from '@/lib/services/action.service';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerOrAdmin(ctx);
    if (unauthorized) return unauthorized;

    const { data, error } = await ctx.supabase
      .from('actions_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:action_treatments(
          *,
          material:materials(*),
          unit_type:unit_types(*),
          action_type:action_types(*)
        )`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerOrAdmin(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();

    // Batch creation (admin form with entries array)
    if (body.entries && Array.isArray(body.entries)) {
      if (!body.area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      const results = await createActionBatch(ctx.supabase, ctx.adminClient, {
        areaId: body.area_id,
        workerId: body.worker_id,
        entries: body.entries,
      });
      return NextResponse.json(results, { status: 201 });
    }

    // Single action creation
    if (!body.area_report_id) {
      return NextResponse.json({ error: 'area_report_id is required' }, { status: 400 });
    }

    const result = await createActionSingle(ctx.supabase, ctx.adminClient, {
      areaReportId: body.area_report_id,
      entry: body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
