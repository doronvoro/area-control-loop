import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { AreaTypeId } from '@/types/database';

export async function GET() {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');

    if (!worker && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('actions_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:action_treatments(
          *,
          material:materials(*),
          unit_type:unit_types(*),
          action_type:action_types(*)
        )`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');

    if (!worker && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Handle batch creation (admin form with entries array)
    if (body.entries && Array.isArray(body.entries)) {
      const { area_id, entries } = body;

      if (!area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      // Get or create report_area for actions
      const { data: existingReportAreas } = await (supabase
        .from('report_areas') as any)
        .select('id')
        .eq('area_id', area_id)
        .eq('area_type_id', AreaTypeId.ACTION) as { data: { id: string }[] | null };

      let reportAreaId: string;

      if (existingReportAreas && existingReportAreas.length > 0) {
        reportAreaId = existingReportAreas[0].id;
      } else {
        // Get area name for report area
        const { data: areaData } = await supabase
          .from('areas')
          .select('name')
          .eq('id', area_id)
          .single() as { data: { name: string } | null };

        const query = supabase.from('report_areas') as any;
        const { data: newReportArea, error: createError } = await query
          .insert({
            area_id,
            area_type_id: AreaTypeId.ACTION,
            name: `דוח פעולה - ${areaData?.name || 'שטח'}`,
            description: 'דוח פעולה שנוצר ע"י מנהל',
          })
          .select()
          .single();

        if (createError) throw createError;
        reportAreaId = newReportArea.id;
      }

      const results: any[] = [];

      for (const entry of entries) {
        // Create action report
        const { data: actionData, error: actionError } = await supabase
          .from('actions_area_report')
          .insert({
            area_report_id: reportAreaId,
            sub_area_id: entry.sub_area_id,
            finding_id: entry.finding_id,
            severity: entry.severity || null,
          } as any)
          .select()
          .single();

        if (actionError) throw actionError;

        // Create treatments if provided
        if (entry.treatments && Array.isArray(entry.treatments)) {
          for (const treatment of entry.treatments) {
            const parsedDosage = treatment.dosage
              ? (typeof treatment.dosage === 'string' ? parseFloat(treatment.dosage) : treatment.dosage)
              : null;

            const { data: actionTreatmentData, error: treatmentError } = await (supabase
              .from('action_treatments') as any)
              .insert({
                action_report_id: (actionData as any).id,
                material_id: treatment.material_id || null,
                dosage: parsedDosage,
                unit_type_id: treatment.unit_type_id || null,
                action_type_id: treatment.action_type_id || null,
                status: treatment.status || 'pending',
                notes: treatment.notes || null,
                action_time: treatment.action_time || null,
              })
              .select()
              .single();

            if (treatmentError) throw treatmentError;

            // Link monitoring treatment to action treatment if monitoring_treatment_id provided
            // Also sync the status from action_treatment to monitoring_treatment
            if (treatment.monitoring_treatment_id && actionTreatmentData) {
              const { error: linkError } = await (supabase
                .from('monitoring_treatments') as any)
                .update({
                  action_treatment_id: actionTreatmentData.id,
                  status: actionTreatmentData.status, // Sync status
                })
                .eq('id', treatment.monitoring_treatment_id);

              if (linkError) throw linkError;
            }
          }
        } else if (entry.action_type_id || entry.material_id) {
          // Legacy format - create single treatment from entry fields
          const parsedDosage = entry.dosage
            ? (typeof entry.dosage === 'string' ? parseFloat(entry.dosage) : entry.dosage)
            : null;

          const { error: treatmentError } = await (supabase
            .from('action_treatments') as any)
            .insert({
              action_report_id: (actionData as any).id,
              material_id: entry.material_id || null,
              dosage: parsedDosage,
              unit_type_id: entry.unit_type_id || null,
              action_type_id: entry.action_type_id || null,
              status: entry.status || 'pending',
              notes: entry.notes || null,
              action_time: entry.action_time || null,
            });

          if (treatmentError) throw treatmentError;
        }

        // If linked to monitoring report, update it
        if (entry.monitoring_report_id && actionData) {
          const query = supabase.from('monitoring_area_report') as any;
          const { error: monitoringError } = await query
            .update({
              actions_area_report_id: (actionData as any).id,
            })
            .eq('id', entry.monitoring_report_id);

          if (monitoringError) throw monitoringError;
        }

        results.push(actionData);
      }

      return NextResponse.json(results, { status: 201 });
    }

    // Handle single action creation (legacy format)
    const {
      area_report_id,
      sub_area_id,
      finding_id,
      severity,
      treatments,
      // Legacy fields
      material_id,
      material,
      dosage,
      unit_type_id,
      action_type_id,
      action_time,
      notes,
      monitoring_report_id,
    } = body;

    // Create action report
    const { data: actionData, error: actionError } = await supabase
      .from('actions_area_report')
      .insert({
        area_report_id,
        sub_area_id,
        finding_id,
        severity: severity || null,
      } as any)
      .select()
      .single();

    if (actionError) throw actionError;

    // Create treatments if provided
    if (treatments && Array.isArray(treatments)) {
      for (const treatment of treatments) {
        const parsedDosage = treatment.dosage
          ? (typeof treatment.dosage === 'string' ? parseFloat(treatment.dosage) : treatment.dosage)
          : null;

        const { data: actionTreatmentData, error: treatmentError } = await (supabase
          .from('action_treatments') as any)
          .insert({
            action_report_id: (actionData as any).id,
            material_id: treatment.material_id || null,
            dosage: parsedDosage,
            unit_type_id: treatment.unit_type_id || null,
            action_type_id: treatment.action_type_id || null,
            status: treatment.status || 'pending',
            notes: treatment.notes || null,
            action_time: treatment.action_time || null,
          })
          .select()
          .single();

        if (treatmentError) throw treatmentError;

        // Link monitoring treatment to action treatment if monitoring_treatment_id provided
        // Also sync the status from action_treatment to monitoring_treatment
        if (treatment.monitoring_treatment_id && actionTreatmentData) {
          const { error: linkError } = await (supabase
            .from('monitoring_treatments') as any)
            .update({
              action_treatment_id: actionTreatmentData.id,
              status: actionTreatmentData.status, // Sync status
            })
            .eq('id', treatment.monitoring_treatment_id);

          if (linkError) throw linkError;
        }
      }
    } else if (action_type_id || material_id || material) {
      // Legacy format - create single treatment from legacy fields
      const parsedDosage = dosage
        ? (typeof dosage === 'string' ? parseFloat(dosage) : dosage)
        : null;

      const { error: treatmentError } = await (supabase
        .from('action_treatments') as any)
        .insert({
          action_report_id: (actionData as any).id,
          material_id: material_id || null,
          dosage: parsedDosage,
          unit_type_id: unit_type_id || null,
          action_type_id: action_type_id || null,
          status: 'pending',
          notes: notes || null,
          action_time: action_time || null,
        });

      if (treatmentError) throw treatmentError;
    }

    // If linked to monitoring report, update it
    if (monitoring_report_id && actionData) {
      const query = supabase.from('monitoring_area_report') as any;
      const { error: monitoringError } = await query
        .update({
          actions_area_report_id: (actionData as any).id,
        })
        .eq('id', monitoring_report_id);

      if (monitoringError) throw monitoringError;
    }

    return NextResponse.json(actionData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
