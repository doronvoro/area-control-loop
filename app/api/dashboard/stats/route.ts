import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();

    // Get statistics
    const [monitoringCount, actionsCount, pendingMonitoring] = await Promise.all([
      supabase
        .from('monitoring_area_report')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('actions_area_report')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('monitoring_area_report')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    return NextResponse.json({
      monitoringCount: monitoringCount.count || 0,
      actionsCount: actionsCount.count || 0,
      pendingMonitoring: pendingMonitoring.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
