import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    console.log('[Reports GET] Fetching report areas');

    const supabase = await createClient();

    const { data: reportAreas, error } = await supabase
      .from('report_areas')
      .select(
        `id, name, description, status, created_at, report_number,
        area_type:report_area_types(name, display_name),
        area:areas(id, name),
        worker:workers(id, name)`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log('[Reports GET] Fetched report areas:', reportAreas?.length ?? 0);

    // Find monitoring → action report linkages
    const monitoringIds = (reportAreas || [])
      .filter((r: any) => r.area_type?.name === 'monitoring')
      .map((r: any) => r.id);

    const linkMap = new Map<string, Set<string>>();

    if (monitoringIds.length > 0) {
      const { data: links } = await (supabase
        .from('monitoring_area_report') as any)
        .select('area_report_id, actions_area_report:actions_area_report!inner(area_report_id)')
        .in('area_report_id', monitoringIds)
        .not('actions_area_report_id', 'is', null);

      for (const link of links || []) {
        const monId = link.area_report_id;
        const actReportId = link.actions_area_report?.area_report_id;
        if (actReportId) {
          if (!linkMap.has(monId)) linkMap.set(monId, new Set());
          linkMap.get(monId)!.add(actReportId);
        }
      }
    }

    const result = (reportAreas || []).map((r: any) => ({
      ...r,
      ...(linkMap.has(r.id)
        ? { linked_action_report_ids: [...linkMap.get(r.id)!] }
        : {}),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Reports GET] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
