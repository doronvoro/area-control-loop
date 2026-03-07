import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const ctx = await getApiContext();

    const [monitoringCount, actionsCount, pendingMonitoring] = await Promise.all([
      ctx.supabase.from('monitoring_area_report').select('id', { count: 'exact', head: true }),
      ctx.supabase.from('actions_area_report').select('id', { count: 'exact', head: true }),
      ctx.supabase.from('monitoring_area_report').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    return NextResponse.json({
      monitoringCount: monitoringCount.count || 0,
      actionsCount: actionsCount.count || 0,
      pendingMonitoring: pendingMonitoring.count || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
