import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * Cascade API for monitoring form
 *
 * Query params:
 * - type: 'findings' | 'action_types' | 'materials' | 'dosage'
 * - cropId: UUID of the crop
 * - findingId: UUID of the finding (optional - for finding-specific recommendations)
 * - actionTypeId: UUID of the action type (for materials, dosage)
 * - materialId: UUID of the material (for dosage)
 *
 * Schema:
 * - crop_findings: crop_id -> finding_id (available findings per crop)
 * - recommend_material: crop_id + finding_id + action_type_id + material_id -> unit_type_id + dosage
 *   (finding_id is optional - NULL means crop-level default)
 */
export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const cropId = searchParams.get('cropId');
    const findingId = searchParams.get('findingId');
    const actionTypeId = searchParams.get('actionTypeId');
    const materialId = searchParams.get('materialId');

    const supabase = await createClient();

    switch (type) {
      case 'findings': {
        // Get findings for a specific crop via crop_findings junction
        if (!cropId) {
          return NextResponse.json(
            { error: 'cropId is required for findings' },
            { status: 400 }
          );
        }

        const { data, error } = await (supabase
          .from('crop_findings') as any)
          .select('finding_id, findings(*)')
          .eq('crop_id', cropId);

        if (error) throw error;

        const findings = data?.map((cf: any) => cf.findings).filter(Boolean) || [];
        return NextResponse.json(findings);
      }

      case 'action_types': {
        // Get distinct action types available for a specific crop (and optionally finding) via recommend_material
        if (!cropId) {
          return NextResponse.json(
            { error: 'cropId is required for action_types' },
            { status: 400 }
          );
        }

        // First try finding-specific recommendations
        let query = (supabase
          .from('recommend_material') as any)
          .select('action_type_id, action_types(*)')
          .eq('crop_id', cropId);

        if (findingId) {
          query = query.eq('finding_id', findingId);
        } else {
          query = query.is('finding_id', null);
        }

        let { data, error } = await query;

        // If no finding-specific results and findingId was provided, fall back to crop-level
        if (findingId && (!data || data.length === 0)) {
          const fallbackResult = await (supabase
            .from('recommend_material') as any)
            .select('action_type_id, action_types(*)')
            .eq('crop_id', cropId)
            .is('finding_id', null);

          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) throw error;

        // Get unique action types
        const actionTypesMap = new Map();
        data?.forEach((rm: any) => {
          if (rm.action_types && !actionTypesMap.has(rm.action_type_id)) {
            actionTypesMap.set(rm.action_type_id, rm.action_types);
          }
        });

        // If no recommendations found, fall back to all action types
        if (actionTypesMap.size === 0) {
          const { data: allActionTypes, error: atError } = await supabase
            .from('action_types')
            .select('*')
            .order('name');
          if (atError) throw atError;
          return NextResponse.json(allActionTypes || []);
        }

        return NextResponse.json(Array.from(actionTypesMap.values()));
      }

      case 'materials': {
        // Get materials available for a specific crop (and optionally action_type/finding) via recommend_material
        if (!cropId) {
          return NextResponse.json(
            { error: 'cropId is required for materials' },
            { status: 400 }
          );
        }

        // Build query: match specific action_type OR null action_type (applies to all)
        let query = (supabase
          .from('recommend_material') as any)
          .select('material_id, materials(*)')
          .eq('crop_id', cropId);

        if (actionTypeId) {
          query = query.or(`action_type_id.eq.${actionTypeId},action_type_id.is.null`);
        }

        if (findingId) {
          query = query.eq('finding_id', findingId);
        } else {
          query = query.is('finding_id', null);
        }

        let { data, error } = await query;

        // Fallback to crop-level if no finding-specific results
        if (findingId && (!data || data.length === 0)) {
          let fallbackQuery = (supabase
            .from('recommend_material') as any)
            .select('material_id, materials(*)')
            .eq('crop_id', cropId)
            .is('finding_id', null);

          if (actionTypeId) {
            fallbackQuery = fallbackQuery.or(`action_type_id.eq.${actionTypeId},action_type_id.is.null`);
          }

          const fallbackResult = await fallbackQuery;
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) throw error;

        // Get unique materials
        const materialsMap = new Map();
        data?.forEach((rm: any) => {
          if (rm.materials && !materialsMap.has(rm.material_id)) {
            materialsMap.set(rm.material_id, rm.materials);
          }
        });

        // If no recommendations found, fall back to all materials
        if (materialsMap.size === 0) {
          const { data: allMaterials, error: mError } = await supabase
            .from('materials')
            .select('*')
            .order('name');
          if (mError) throw mError;
          return NextResponse.json(allMaterials || []);
        }

        return NextResponse.json(Array.from(materialsMap.values()));
      }

      case 'dosage': {
        // Get dosage and unit_type for a specific combination
        if (!cropId || !materialId) {
          return NextResponse.json(
            { error: 'cropId and materialId are required for dosage' },
            { status: 400 }
          );
        }

        let query = (supabase
          .from('recommend_material') as any)
          .select('dosage, unit_type_id, unit_types(*)');

        if (actionTypeId) {
          query = query.eq('crop_id', cropId).or(`action_type_id.eq.${actionTypeId},action_type_id.is.null`).eq('material_id', materialId);
        } else {
          query = query.eq('crop_id', cropId).eq('material_id', materialId);
        }

        if (findingId) {
          query = query.eq('finding_id', findingId);
        } else {
          query = query.is('finding_id', null);
        }

        let { data, error } = await query.maybeSingle();

        // Fallback to crop-level if no finding-specific result
        if (findingId && !data) {
          let fallbackQuery = (supabase
            .from('recommend_material') as any)
            .select('dosage, unit_type_id, unit_types(*)');

          if (actionTypeId) {
            fallbackQuery = fallbackQuery.eq('crop_id', cropId).or(`action_type_id.eq.${actionTypeId},action_type_id.is.null`).eq('material_id', materialId);
          } else {
            fallbackQuery = fallbackQuery.eq('crop_id', cropId).eq('material_id', materialId);
          }

          const fallbackResult = await fallbackQuery
            .is('finding_id', null)
            .maybeSingle();

          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) throw error;

        if (data) {
          return NextResponse.json({
            dosage: data.dosage,
            unit_type_id: data.unit_type_id,
            unit_type: data.unit_types,
          });
        }

        return NextResponse.json(null);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: findings, action_types, materials, or dosage' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
