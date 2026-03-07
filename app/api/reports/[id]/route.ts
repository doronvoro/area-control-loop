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
