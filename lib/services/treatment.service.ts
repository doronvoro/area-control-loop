import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDosage } from '@/lib/api/utils';

// --- Types ---

export interface TreatmentInput {
  material_id?: string | null;
  dosage?: string | number | null;
  unit_type_id?: string | null;
  action_type_id?: string | null;
  status?: string;
  notes?: string | null;
}

export interface ActionTreatmentInput extends TreatmentInput {
  action_time?: string | null;
  monitoring_treatment_id?: string | null;
}

export interface EntryWithTreatments {
  treatments?: TreatmentInput[];
  material_id?: string | null;
  recommend_material_id?: string | null;
  dosage?: string | number | null;
  recommend_dosage?: string | number | null;
  unit_type_id?: string | null;
  recommend_unit_type_id?: string | null;
  action_type_id?: string | null;
  recommend_action_type_id?: string | null;
}

// --- Monitoring treatments ---

async function insertMonitoringTreatment(
  adminClient: SupabaseClient,
  monitoringReportId: string,
  treatment: TreatmentInput
): Promise<void> {
  const { error } = await adminClient.from('monitoring_treatments').insert({
    monitoring_report_id: monitoringReportId,
    material_id: treatment.material_id || null,
    dosage: parseDosage(treatment.dosage),
    unit_type_id: treatment.unit_type_id || null,
    action_type_id: treatment.action_type_id || null,
    status: treatment.status || 'pending',
    notes: treatment.notes || null,
  });
  if (error) throw error;
}

export async function createMonitoringTreatments(
  adminClient: SupabaseClient,
  monitoringReportId: string,
  entry: EntryWithTreatments
): Promise<void> {
  if (entry.treatments && Array.isArray(entry.treatments)) {
    for (const treatment of entry.treatments) {
      await insertMonitoringTreatment(adminClient, monitoringReportId, treatment);
    }
    return;
  }

  // Legacy format — build single treatment from flat fields
  const materialId = entry.material_id || entry.recommend_material_id;
  const actionTypeId = entry.action_type_id || entry.recommend_action_type_id;

  if (materialId || actionTypeId) {
    await insertMonitoringTreatment(adminClient, monitoringReportId, {
      material_id: materialId,
      dosage: entry.dosage || entry.recommend_dosage,
      unit_type_id: entry.unit_type_id || entry.recommend_unit_type_id,
      action_type_id: actionTypeId,
      status: 'pending',
    });
  }
}

// --- Action treatments ---

async function insertActionTreatment(
  supabase: SupabaseClient,
  actionReportId: string,
  treatment: ActionTreatmentInput
): Promise<any> {
  const { data, error } = await (supabase.from('action_treatments') as any)
    .insert({
      action_report_id: actionReportId,
      material_id: treatment.material_id || null,
      dosage: parseDosage(treatment.dosage),
      unit_type_id: treatment.unit_type_id || null,
      action_type_id: treatment.action_type_id || null,
      status: treatment.status || 'pending',
      notes: treatment.notes || null,
      action_time: treatment.action_time || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Link monitoring treatment → action treatment
  if (treatment.monitoring_treatment_id && data) {
    const { error: linkError } = await (supabase.from('monitoring_treatments') as any)
      .update({ action_treatment_id: data.id })
      .eq('id', treatment.monitoring_treatment_id);
    if (linkError) throw linkError;
  }

  return data;
}

export async function createActionTreatments(
  supabase: SupabaseClient,
  actionReportId: string,
  entry: EntryWithTreatments & { action_time?: string | null; status?: string; notes?: string | null }
): Promise<void> {
  if (entry.treatments && Array.isArray(entry.treatments)) {
    for (const treatment of entry.treatments) {
      await insertActionTreatment(supabase, actionReportId, treatment as ActionTreatmentInput);
    }
    return;
  }

  // Legacy format
  const materialId = entry.material_id || entry.recommend_material_id;
  const actionTypeId = entry.action_type_id || entry.recommend_action_type_id;

  if (actionTypeId || materialId) {
    await insertActionTreatment(supabase, actionReportId, {
      material_id: entry.material_id || null,
      dosage: entry.dosage,
      unit_type_id: entry.unit_type_id || null,
      action_type_id: actionTypeId || null,
      status: entry.status || 'pending',
      notes: entry.notes || null,
      action_time: entry.action_time || null,
    });
  }
}
