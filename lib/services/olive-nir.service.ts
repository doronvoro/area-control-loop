import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateReportArea } from '@/lib/api/utils';
import { AreaTypeId, type Season } from '@/types/database';

/**
 * NIR ripeness measurements.
 *
 * A measurement is a `report_areas` row of type 'nir' plus a 1:1 `nir_report`
 * detail row, so it inherits report numbering, worker attribution and the
 * reports list for free. `dry` is a generated column and is never written.
 */

// --- Types ---

export interface NirValuesInput {
  sub_area_id?: string | null;
  oil?: number | null;
  water?: number | null;
  green?: number | null;
  acid?: number | null;
  maturity?: number | null;
  irrig_amount?: number | null;
  direction?: string | null;
  /**
   * When the reading went to the client, as an ISO instant. `null` clears it.
   *
   * `sent_to_client_by` is deliberately NOT on this type: it is derived from the
   * acting user inside updateNirReport, so a client cannot claim someone else
   * sent it.
   */
  sent_to_client_at?: string | null;
}

export interface CreateNirParams extends NirValuesInput {
  areaId: string;
  workerId?: string;
  reportDate?: string;
  notes?: string | null;
}

const NIR_SELECT = `
  id, name, description, status, report_number, report_date, created_at, area_type_id,
  area:areas(id, name, variety),
  worker:workers(id, name),
  detail:nir_report(*)
`;

// --- Private helpers ---

/** Strip undefined so a partial update never nulls a field the caller omitted. */
function nirRow(values: NirValuesInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const keys: (keyof NirValuesInput)[] = [
    'sub_area_id',
    'oil',
    'water',
    'green',
    'acid',
    'maturity',
    'irrig_amount',
    'direction',
    'sent_to_client_at',
  ];
  for (const key of keys) {
    if (values[key] !== undefined) row[key] = values[key];
  }
  return row;
}

/** Flatten PostgREST's array-shaped 1:1 embed. */
function flattenDetail(row: any) {
  if (!row) return row;
  return {
    ...row,
    detail: Array.isArray(row.detail) ? (row.detail[0] ?? null) : (row.detail ?? null),
  };
}

// --- Public API ---

/**
 * Record one measurement.
 *
 * The report header is created through findOrCreateReportArea so naming, worker
 * and date handling stay identical to monitoring and actions. namePrefix must be
 * passed explicitly: that helper's default branches on MONITORING vs everything
 * else, so omitting it would label NIR reports "דוח פעולה".
 *
 * Status is patched afterwards rather than passed in, to avoid changing a helper
 * shared with the pest-management flows. A measurement is complete the moment it
 * is taken — there is no treatment progress to accumulate, and
 * updateReportStatuses only touches report ids handed to it, so nothing will
 * later recompute these rows.
 */
export async function createNirReport(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateNirParams
): Promise<any> {
  const { areaId, workerId, reportDate, notes, ...values } = params;

  if (!areaId) throw new Error('areaId is required');

  const reportAreaId = await findOrCreateReportArea(supabase, adminClient, areaId, AreaTypeId.NIR, {
    reuseExisting: false,
    workerId,
    reportDate,
    namePrefix: 'בדיקת NIR',
    description: notes || 'בדיקת NIR',
  });

  const { data, error } = await (adminClient.from('nir_report') as any)
    .insert({ report_area_id: reportAreaId, ...nirRow(values) })
    .select()
    .single();

  if (error) throw error;

  await (adminClient.from('report_areas') as any)
    .update({ status: 'completed', completion_percentage: 100 })
    .eq('id', reportAreaId);

  return { report_area_id: reportAreaId, detail: data };
}

/**
 * `actingUserId` is auth.users.id — ctx.user.id, never a workers.id, and never a
 * value the client supplied. See the 20260923140000 migration header for why the
 * audit column points at auth.users.
 */
export async function updateNirReport(
  adminClient: SupabaseClient,
  reportAreaId: string,
  values: NirValuesInput & { reportDate?: string; notes?: string | null },
  actingUserId?: string | null
): Promise<any> {
  const { reportDate, notes, ...measurement } = values;
  const row = nirRow(measurement);

  // Derived here rather than accepted from the caller. `in` rather than a
  // truthiness test: an explicit null means "un-send", which must clear the
  // attribution too, while an absent key must leave both columns untouched.
  if ('sent_to_client_at' in row) {
    row.sent_to_client_by = row.sent_to_client_at ? (actingUserId ?? null) : null;
  }

  const { data, error } = await (adminClient.from('nir_report') as any)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('report_area_id', reportAreaId)
    .select()
    .single();

  if (error) throw error;

  if (reportDate !== undefined || notes !== undefined) {
    const header: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (reportDate !== undefined) header.report_date = reportDate;
    if (notes !== undefined) header.description = notes;

    await (adminClient.from('report_areas') as any).update(header).eq('id', reportAreaId);
  }

  return data;
}

/** Deleting the header cascades to the detail row. */
export async function deleteNirReport(
  adminClient: SupabaseClient,
  reportAreaId: string
): Promise<void> {
  const { error } = await (adminClient.from('report_areas') as any)
    .delete()
    .eq('id', reportAreaId)
    .eq('area_type_id', AreaTypeId.NIR);

  if (error) throw error;
}

export interface NirReportFilter {
  /** Inclusive calendar day, YYYY-MM-DD. */
  from?: string | null;
  /** Inclusive calendar day, YYYY-MM-DD. */
  to?: string | null;
  limit?: number;
}

/**
 * A ceiling so an unbounded archive cannot become an unbounded payload. The log
 * screen surfaces it rather than silently showing a truncated count.
 */
export const NIR_ROW_CAP = 2000;

/**
 * Measurements for the given areas, newest first.
 *
 * `filter` is optional so existing unbounded callers — getLatestNirByArea
 * below, and through it the dashboard — keep their current behaviour. That is
 * deliberate: putting a season floor on the dashboard would flip a plot whose
 * last reading was last season from "has NIR" to 'testing' and change what
 * classifyPlotCategory reports.
 */
export async function getNirReports(
  supabase: SupabaseClient,
  areaIds: string[],
  filter: NirReportFilter = {}
): Promise<any[]> {
  if (areaIds.length === 0) return [];

  let query = (supabase.from('report_areas') as any)
    .select(NIR_SELECT)
    .eq('area_type_id', AreaTypeId.NIR)
    .in('area_id', areaIds);

  if (filter.from) {
    query = query.gte('report_date', `${filter.from}T00:00:00+00:00`);
  }
  if (filter.to) {
    // Half-open on purpose. report_date is timestamptz while a season's ends_on
    // is a DATE, and the form posts a bare 'YYYY-MM-DD' that Postgres stores as
    // midnight. A .lte('report_date', ends_on) would therefore drop every
    // reading taken ON the season's last day.
    query = query.lt('report_date', `${dayAfter(filter.to)}T00:00:00+00:00`);
  }

  const { data, error } = await query
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? NIR_ROW_CAP);

  if (error) throw error;
  return (data || []).map(flattenDetail);
}

/**
 * How many readings the season holds, and how many have not gone to the client.
 *
 * Two head-only counts rather than a fetch-and-filter: the dashboard needs the
 * numbers, not the rows, and this stays the same cost however large the archive
 * gets. Deliberately NOT derived from getLatestNirByArea, which the dashboard
 * already calls — that returns one reading per plot, so a plot sitting on four
 * unsent readings would report one.
 *
 * Queries nir_report and joins upward, the shape getNextPassNumber already uses
 * in olive-harvest.service.ts: the sent flag lives on the detail row while the
 * area and the date live on the header.
 */
export async function getNirSeasonCounts(
  supabase: SupabaseClient,
  areaIds: string[],
  season: Season | null
): Promise<{ total: number; unsent: number }> {
  if (areaIds.length === 0) return { total: 0, unsent: 0 };

  const scoped = () => {
    let query = (supabase.from('nir_report') as any)
      .select('report_area_id, report_area:report_areas!inner(area_id, report_date)', {
        count: 'exact',
        head: true,
      })
      .in('report_area.area_id', areaIds);

    if (season?.starts_on) {
      query = query.gte('report_area.report_date', `${season.starts_on}T00:00:00+00:00`);
    }
    if (season?.ends_on) {
      // Half-open, for the reason getNirReports spells out: report_date is a
      // timestamptz holding a bare day at midnight, so .lte would drop every
      // reading taken ON the season's last day.
      query = query.lt('report_area.report_date', `${dayAfter(season.ends_on)}T00:00:00+00:00`);
    }
    return query;
  };

  const [totalResult, unsentResult] = await Promise.all([
    scoped(),
    scoped().is('sent_to_client_at', null),
  ]);

  if (totalResult.error) throw totalResult.error;
  if (unsentResult.error) throw unsentResult.error;

  return { total: totalResult.count ?? 0, unsent: unsentResult.count ?? 0 };
}

/** The calendar day after `day` (YYYY-MM-DD), for a half-open upper bound. */
function dayAfter(day: string): string {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * The most recent measurement per area, keyed by area id.
 *
 * PostgREST has no DISTINCT ON, so this reduces the ordered list in memory.
 * At ~45 plots sampled through one season that is a few hundred rows.
 *
 * Unfiltered, so it reads the newest NIR_ROW_CAP rows. A plot would have to be
 * that far behind the others to lose its latest reading here, which at this
 * plot count cannot happen; if the archive ever gets there, give this its own
 * date floor rather than raising the cap for everyone.
 */
export async function getLatestNirByArea(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<Record<string, any>> {
  const reports = await getNirReports(supabase, areaIds);
  const latest: Record<string, any> = {};

  for (const report of reports) {
    const areaId = report.area?.id;
    if (areaId && !latest[areaId]) latest[areaId] = report;
  }

  return latest;
}
