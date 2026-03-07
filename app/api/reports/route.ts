import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const ctx = await getApiContext();

    console.log('[Reports GET] Fetching report areas');

    const { data: reportAreas, error } = await ctx.supabase
      .from('report_areas')
      .select(`id, name, description, status, created_at, report_number,
        area_type:report_area_types(name, display_name),
        area:areas(id, name),
        worker:workers(id, name)`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log('[Reports GET] Fetched report areas:', reportAreas?.length ?? 0);

    const monitoringIds = (reportAreas || [])
      .filter((r: any) => r.area_type?.name === 'monitoring')
      .map((r: any) => r.id);

    const linkMap = new Map<string, Set<string>>();

    if (monitoringIds.length > 0) {
      const { data: links } = await (ctx.supabase.from('monitoring_area_report') as any)
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
      ...(linkMap.has(r.id) ? { linked_action_report_ids: [...linkMap.get(r.id)!] } : {}),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
