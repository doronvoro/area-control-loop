import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

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
      const { data: existingReportAreas } = await supabase
        .from('report_areas')
        .select('id')
        .eq('area_id', area_id)
        .eq('type', 'action') as { data: { id: string }[] | null };

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
            type: 'action',
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
            status: entry.status || 'planned',
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

            const { error: treatmentError } = await (supabase
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
              });

            if (treatmentError) throw treatmentError;
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
              status: 'reviewed',
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
      treatments,
      // Legacy fields
      material_id,
      material,
      dosage,
      unit_type_id,
      action_type_id,
      action_time,
      status = 'planned',
      notes,
      monitoring_report_id,
      update_monitoring_status,
    } = body;

    // Create action report
    const { data: actionData, error: actionError } = await supabase
      .from('actions_area_report')
      .insert({
        area_report_id,
        sub_area_id,
        finding_id,
        status: status || 'planned',
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

        const { error: treatmentError } = await (supabase
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
          });

        if (treatmentError) throw treatmentError;
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
      const updateData: any = {
        actions_area_report_id: (actionData as any).id,
      };

      if (update_monitoring_status) {
        updateData.status = update_monitoring_status;
      }

      const query = supabase.from('monitoring_area_report') as any;
      const { error: monitoringError } = await query
        .update(updateData)
        .eq('id', monitoring_report_id);

      if (monitoringError) throw monitoringError;
    }

    return NextResponse.json(actionData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
