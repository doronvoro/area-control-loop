import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

/**
 * Report types returned when the caller does not ask for anything specific.
 *
 * The query is capped at 50 rows ordered by date, and NIR is high-frequency —
 * 45 plots sampled weekly would fill that window and push pest-management
 * reports off the list entirely. Defaulting to the two original types is
 * exactly the behaviour that existed before the olive types were added;
 * callers opt in with ?types=nir or ?types=all.
 */
const DEFAULT_REPORT_TYPES = ['monitoring', 'action'];

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    const { searchParams } = new URL(request.url);
    const typesParam = searchParams.get('types');
    const types =
      typesParam === 'all'
        ? null
        : typesParam
          ? typesParam.split(',').filter(Boolean)
          : DEFAULT_REPORT_TYPES;

    let query = ctx.supabase
      .from('report_areas')
      .select(`id, name, description, status, created_at, report_date, report_number, area_type_id,
        area_type:report_area_types(name, display_name),
        area:areas(id, name),
        worker:workers(id, name)`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (types) query = query.in('area_type_id', types);

    const { data: reportAreas, error } = await query;

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
