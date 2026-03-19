import { SupabaseClient } from '@supabase/supabase-js';

export interface ReportDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  report_number: number;
  area_type_id: string;
  area_type: { name: string; display_name: string } | null;
  area: { id: string; name: string; description: string | null; crop_id?: string } | null;
  worker: { id: string; name: string } | null;
  monitoringEntries: any[] | null;
  actionEntries: any[] | null;
}

export async function fetchReportDetail(
  supabase: SupabaseClient,
  id: string
): Promise<ReportDetail | null> {
  // Fetch the main report area data
  const { data: reportArea, error: reportError } = await (supabase
    .from('report_areas') as any)
    .select(
      `id, name, description, status, created_at, report_date, report_number, area_type_id,
      area_type:report_area_types(name, display_name),
      area:areas(id, name, description, crop_id),
      worker:workers(id, name)`
    )
    .eq('id', id)
    .single();

  if (reportError) throw reportError;
  if (!reportArea) return null;

  // Fetch monitoring entries if this is a monitoring report
  let monitoringEntries = null;
  if (reportArea.area_type_id === 'monitoring') {
    const { data, error } = await supabase
      .from('monitoring_area_report')
      .select(
        `id, severity, created_at,
        sub_area:sub_areas(id, name, display),
        finding:findings(id, name, description),
        treatments:monitoring_treatments(
          id, dosage, notes, status,
          material:materials(id, name),
          unit_type:unit_types(id, name),
          action_type_id
        )`
      )
      .eq('area_report_id', id);

    if (error) throw error;

    // Fetch recommended treatments from recommend_material for each finding
    const cropId = reportArea.area?.crop_id;
    if (data && cropId) {
      const findingIds = [...new Set(
        data.map((entry: any) => entry.finding?.id).filter(Boolean)
      )];

      if (findingIds.length > 0) {
        const { data: recommendations } = await (supabase
          .from('recommend_material') as any)
          .select(
            `id, dosage, finding_id,
            action_type_id,
            material:materials(id, name),
            unit_type:unit_types(id, name)`
          )
          .eq('crop_id', cropId)
          .in('finding_id', findingIds);

        const { data: defaultRecommendations } = await (supabase
          .from('recommend_material') as any)
          .select(
            `id, dosage, finding_id,
            action_type_id,
            material:materials(id, name),
            unit_type:unit_types(id, name)`
          )
          .eq('crop_id', cropId)
          .is('finding_id', null);

        const recMap = new Map<string, any[]>();
        for (const rec of recommendations || []) {
          const fid = rec.finding_id;
          if (!recMap.has(fid)) recMap.set(fid, []);
          recMap.get(fid)!.push(rec);
        }

        data.forEach((entry: any) => {
          const fid = entry.finding?.id;
          entry.recommendedTreatments = recMap.get(fid) || defaultRecommendations || [];
        });
      }
    }

    monitoringEntries = data;
  }

  // Fetch action entries if this is an action report
  let actionEntries = null;
  if (reportArea.area_type_id === 'action') {
    const { data, error } = await supabase
      .from('actions_area_report')
      .select(
        `id, severity, created_at,
        sub_area:sub_areas(id, name, display),
        finding:findings(id, name, description),
        treatments:action_treatments(
          id, dosage, notes, status, action_time,
          material:materials(id, name),
          unit_type:unit_types(id, name),
          action_type_id
        )`
      )
      .eq('area_report_id', id);

    if (error) throw error;
    actionEntries = data;
  }

  return {
    ...reportArea,
    monitoringEntries,
    actionEntries,
  };
}
