import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { scopedAreaIds } from '@/lib/api/tenancy';
import { handleApiError } from '@/lib/api-utils';

const EMPTY = { monitoringCount: 0, actionsCount: 0, pendingMonitoring: 0 };

export async function GET() {
  try {
    const ctx = await getApiContext();

    // Counts are the most misleading thing to leave unscoped: the dashboard
    // shows a bare number with no rows to inspect, so an admin looking at one
    // tenant would see totals across all of them and have no way to tell.
    const areaIds = await scopedAreaIds(ctx);
    if (areaIds !== null && areaIds.length === 0) {
      return NextResponse.json(EMPTY);
    }

    // Counting rows on the child tables requires reaching area_id through
    // report_areas, which has none of its own — hence the inner join.
    //
    // The filter is applied inline rather than through a helper: wrapping a
    // PostgREST builder in a generic makes its types recurse until tsc gives up
    // with "type instantiation is excessively deep" (TS2589), and typing the
    // wrapper as `any` to escape that would discard the inference these three
    // calls depend on.
    const SELECT = 'id, area_report:report_areas!inner(area_id)';
    const monitoring = ctx.supabase
      .from('monitoring_area_report')
      .select(SELECT, { count: 'exact', head: true });
    const actions = ctx.supabase
      .from('actions_area_report')
      .select(SELECT, { count: 'exact', head: true });
    const pending = ctx.supabase
      .from('monitoring_area_report')
      .select(SELECT, { count: 'exact', head: true })
      .eq('status', 'pending');

    const [monitoringCount, actionsCount, pendingMonitoring] = await Promise.all([
      areaIds === null ? monitoring : monitoring.in('area_report.area_id', areaIds),
      areaIds === null ? actions : actions.in('area_report.area_id', areaIds),
      areaIds === null ? pending : pending.in('area_report.area_id', areaIds),
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
