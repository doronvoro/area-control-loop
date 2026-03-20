import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { fetchReportDetail } from '@/lib/reports/fetch-report-detail';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getApiContext();
    const { id } = await params;

    const report = await fetchReportDetail(ctx.supabase, id);

    if (!report) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getApiContext();
    const { id } = await params;

    // Check if the report exists and get its type
    const { data: report, error: fetchError } = await ctx.supabase
      .from('report_areas')
      .select('id, area_type_id')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
    }

    // For monitoring reports, check if there are linked action reports
    if (report.area_type_id === 'monitoring') {
      const { data: linkedActions } = await ctx.supabase
        .from('monitoring_area_report')
        .select('id, actions_area_report_id')
        .eq('area_report_id', id)
        .not('actions_area_report_id', 'is', null);

      if (linkedActions && linkedActions.length > 0) {
        return NextResponse.json(
          { error: 'לא ניתן למחוק דוח ניטור שמקושר לדוח פעולה' },
          { status: 400 }
        );
      }
    }

    // Delete the report using admin client (RLS delete policy is admin-only)
    const { error: deleteError } = await ctx.adminClient
      .from('report_areas')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
