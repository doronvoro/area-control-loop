import { createClient, createAdminClient } from '@/lib/supabase/server';
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
      .from('monitoring_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:monitoring_treatments(
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

    // Use admin client for all writes since we've already verified authorization
    const adminClient = createAdminClient();

    // Helper function to get or create report_area
    const getOrCreateReportArea = async (areaId: string): Promise<string> => {
      // Try to find an existing monitoring report_area for this area
      const { data: existingReportArea } = await (supabase
        .from('report_areas') as any)
        .select('id')
        .eq('area_id', areaId)
        .eq('area_type_id', AreaTypeId.MONITORING)
        .maybeSingle();

      if (existingReportArea) {
        return existingReportArea.id;
      }

      const { data: areaData } = await (supabase
        .from('areas') as any)
        .select('name')
        .eq('id', areaId)
        .single();

      const { data: newReportArea, error: createError } = await (adminClient
        .from('report_areas') as any)
        .insert({
          area_id: areaId,
          area_type_id: AreaTypeId.MONITORING,
          name: `דוח ניטור - ${areaData?.name || 'אזור'}`,
          description: `דוח ניטור`,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newReportArea.id;
    };

    // Check if batch request (new format with entries array)
    if (body.entries && Array.isArray(body.entries)) {
      const { area_id, entries } = body;

      if (!area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      if (entries.length === 0) {
        return NextResponse.json({ error: 'At least one entry is required' }, { status: 400 });
      }

      // Get or create report_area for this area
      const reportAreaId = await getOrCreateReportArea(area_id);

      const results = [];
      for (const entry of entries) {
        // Create monitoring_area_report entry
        const { data: monitoringReport, error: monitoringError } = await (adminClient
          .from('monitoring_area_report') as any)
          .insert({
            area_report_id: reportAreaId,
            sub_area_id: entry.sub_area_id,
            finding_id: entry.finding_id,
          })
          .select()
          .single();

        if (monitoringError) throw monitoringError;

        // Create treatment if treatment data is provided
        if (entry.treatments && Array.isArray(entry.treatments)) {
          for (const treatment of entry.treatments) {
            const parsedDosage = treatment.dosage
              ? (typeof treatment.dosage === 'string' ? parseFloat(treatment.dosage) : treatment.dosage)
              : null;

            const { error: treatmentError } = await (adminClient
              .from('monitoring_treatments') as any)
              .insert({
                monitoring_report_id: monitoringReport.id,
                material_id: treatment.material_id || null,
                dosage: parsedDosage,
                unit_type_id: treatment.unit_type_id || null,
                action_type_id: treatment.action_type_id || null,
                status: treatment.status || 'pending',
                notes: treatment.notes || null,
              });

            if (treatmentError) throw treatmentError;
          }
        } else if (entry.material_id || entry.action_type_id) {
          // Legacy format - create single treatment from entry fields
          const parsedDosage = entry.dosage || entry.recommend_dosage
            ? parseFloat(entry.dosage || entry.recommend_dosage)
            : null;

          const { error: treatmentError } = await (adminClient
            .from('monitoring_treatments') as any)
            .insert({
              monitoring_report_id: monitoringReport.id,
              material_id: entry.material_id || entry.recommend_material_id || null,
              dosage: parsedDosage,
              unit_type_id: entry.unit_type_id || entry.recommend_unit_type_id || null,
              action_type_id: entry.action_type_id || entry.recommend_action_type_id || null,
              status: 'pending',
            });

          if (treatmentError) throw treatmentError;
        }

        results.push(monitoringReport);
      }

      return NextResponse.json(results, { status: 201 });
    }

    // Legacy single-entry format
    const {
      area_id,
      area_report_id: providedAreaReportId,
      sub_area_id,
      finding_id,
      treatments,
      // Legacy fields (for backwards compatibility)
      material_id,
      recommend_material_id,
      dosage,
      recommend_dosage,
      unit_type_id,
      recommend_unit_type_id,
      action_type_id,
      recommend_action_type_id,
    } = body;

    // Determine area_report_id - either provided directly or we need to find/create one
    let finalAreaReportId = providedAreaReportId;

    if (!finalAreaReportId && area_id) {
      finalAreaReportId = await getOrCreateReportArea(area_id);
    }

    if (!finalAreaReportId) {
      return NextResponse.json({ error: 'area_id or area_report_id is required' }, { status: 400 });
    }

    // Create monitoring_area_report entry
    const { data: monitoringReport, error: monitoringError } = await (adminClient
      .from('monitoring_area_report') as any)
      .insert({
        area_report_id: finalAreaReportId,
        sub_area_id,
        finding_id,
      })
      .select()
      .single();

    if (monitoringError) throw monitoringError;

    // Create treatments if provided
    if (treatments && Array.isArray(treatments)) {
      for (const treatment of treatments) {
        const parsedDosage = treatment.dosage
          ? (typeof treatment.dosage === 'string' ? parseFloat(treatment.dosage) : treatment.dosage)
          : null;

        const { error: treatmentError } = await (adminClient
          .from('monitoring_treatments') as any)
          .insert({
            monitoring_report_id: monitoringReport.id,
            material_id: treatment.material_id || null,
            dosage: parsedDosage,
            unit_type_id: treatment.unit_type_id || null,
            action_type_id: treatment.action_type_id || null,
            status: treatment.status || 'pending',
            notes: treatment.notes || null,
          });

        if (treatmentError) throw treatmentError;
      }
    } else if (material_id || recommend_material_id || action_type_id || recommend_action_type_id) {
      // Legacy format - create single treatment from legacy fields
      const parsedDosage = dosage || recommend_dosage
        ? parseFloat(dosage || recommend_dosage)
        : null;

      const { error: treatmentError } = await (adminClient
        .from('monitoring_treatments') as any)
        .insert({
          monitoring_report_id: monitoringReport.id,
          material_id: material_id || recommend_material_id || null,
          dosage: parsedDosage,
          unit_type_id: unit_type_id || recommend_unit_type_id || null,
          action_type_id: action_type_id || recommend_action_type_id || null,
          status: 'pending',
        });

      if (treatmentError) throw treatmentError;
    }

    return NextResponse.json(monitoringReport, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
