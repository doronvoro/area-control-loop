import { SupabaseClient } from '@supabase/supabase-js';
import { AreaTypeId } from '@/types/database';

interface UpdateReportStatusesParams {
  // monitoring_area_report IDs whose treatments were affected
  monitoringReportIds?: string[];
  // actions_area_report IDs that were created/updated
  actionReportIds?: string[];
  // report_areas ID (monitoring type) to recalculate aggregate status
  monitoringReportAreaId?: string;
  // report_areas ID (action type) to mark completed
  actionReportAreaId?: string;
}

/**
 * Centralized status management for reports.
 * Call this after creating/linking action treatments.
 *
 * Updates in order:
 * 1. action_treatments → status = 'completed'
 * 2. monitoring_treatments → status = 'completed', treatment_match computed
 * 3. monitoring_area_report → status based on treatment completion
 * 4. actions_area_report → status = 'completed'
 * 5. report_areas (monitoring) → aggregate status + completion_percentage
 * 6. report_areas (action) → status = 'completed'
 */
export async function updateReportStatuses(
  adminClient: SupabaseClient,
  params: UpdateReportStatusesParams
) {
  const {
    monitoringReportIds = [],
    actionReportIds = [],
    monitoringReportAreaId,
    actionReportAreaId,
  } = params;

  // 1. Set action_treatments status to 'completed' for the given action reports
  if (actionReportIds.length > 0) {
    await (adminClient.from('action_treatments') as any)
      .update({ status: 'completed' })
      .in('action_report_id', actionReportIds);
  }

  // 2. Update monitoring_treatments: status + treatment_match
  if (monitoringReportIds.length > 0) {
    // Fetch monitoring treatments that have linked action treatments
    const { data: treatments } = await (adminClient
      .from('monitoring_treatments') as any)
      .select(`
        id, material_id, dosage, unit_type_id, action_type_id, action_treatment_id,
        action_treatment:action_treatments(material_id, dosage, unit_type_id, action_type_id)
      `)
      .in('monitoring_report_id', monitoringReportIds)
      .not('action_treatment_id', 'is', null) as { data: any[] | null };

    if (treatments) {
      for (const mt of treatments) {
        const at = mt.action_treatment;
        if (!at) continue;

        const match =
          mt.material_id === at.material_id &&
          mt.action_type_id === at.action_type_id &&
          mt.unit_type_id === at.unit_type_id &&
          Number(mt.dosage) === Number(at.dosage);

        await (adminClient.from('monitoring_treatments') as any)
          .update({ status: 'completed', treatment_match: match })
          .eq('id', mt.id);
      }
    }
  }

  // 3. Update monitoring_area_report status based on treatment completion
  for (const marId of monitoringReportIds) {
    const { data: treatmentCounts } = await (adminClient
      .from('monitoring_treatments') as any)
      .select('id, action_treatment_id')
      .eq('monitoring_report_id', marId) as { data: any[] | null };

    if (!treatmentCounts || treatmentCounts.length === 0) continue;

    const total = treatmentCounts.length;
    const completed = treatmentCounts.filter(
      (t: any) => t.action_treatment_id != null
    ).length;

    const status = completed >= total ? 'completed' : 'pending';

    await (adminClient.from('monitoring_area_report') as any)
      .update({ status })
      .eq('id', marId);
  }

  // 4. Set actions_area_report status to 'completed'
  if (actionReportIds.length > 0) {
    await (adminClient.from('actions_area_report') as any)
      .update({ status: 'completed' })
      .in('id', actionReportIds);
  }

  // 5. Update report_areas (monitoring) aggregate status + completion_percentage
  if (monitoringReportAreaId) {
    const { data: reports } = await (adminClient
      .from('monitoring_area_report') as any)
      .select('id, status')
      .eq('area_report_id', monitoringReportAreaId) as { data: any[] | null };

    if (reports && reports.length > 0) {
      const total = reports.length;
      const completedCount = reports.filter(
        (r: any) => r.status === 'completed'
      ).length;
      const percentage = Math.round((completedCount / total) * 100);

      let status: string;
      if (completedCount === 0) {
        status = 'pending';
      } else if (completedCount >= total) {
        status = 'completed';
      } else {
        status = 'in_progress';
      }

      await (adminClient.from('report_areas') as any)
        .update({ status, completion_percentage: percentage })
        .eq('id', monitoringReportAreaId);
    }
  }

  // 6. Set report_areas (action) status to 'completed'
  if (actionReportAreaId) {
    await (adminClient.from('report_areas') as any)
      .update({ status: 'completed' })
      .eq('id', actionReportAreaId);
  }
}
