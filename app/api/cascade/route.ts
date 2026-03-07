import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get parent_crop_id for a crop (for inheritance fallback).
 */
async function getParentCropId(supabase: SupabaseClient, cropId: string): Promise<string | null> {
  const { data } = await (supabase.from('crops') as any)
    .select('parent_crop_id')
    .eq('id', cropId)
    .single();
  return data?.parent_crop_id || null;
}

/**
 * Query recommend_material with a 2-level fallback per crop:
 * 1. With findingId (if provided)
 * 2. Without findingId (crop-level defaults)
 *
 * Returns the first non-empty result.
 */
async function queryRecommendWithFindingFallback(
  supabase: SupabaseClient,
  cropId: string,
  select: string,
  findingId: string | null,
  actionTypeId: string | null,
  materialId: string | null,
  single: boolean = false
): Promise<{ data: any; error: any }> {
  const buildQuery = (cId: string, fId: string | null) => {
    let query = (supabase.from('recommend_material') as any)
      .select(select)
      .eq('crop_id', cId);

    if (actionTypeId) {
      query = query.or(`action_type_id.eq.${actionTypeId},action_type_id.is.null`);
    }
    if (materialId) {
      query = query.eq('material_id', materialId);
    }
    if (fId) {
      query = query.eq('finding_id', fId);
    } else {
      query = query.is('finding_id', null);
    }

    return single ? query.maybeSingle() : query;
  };

  // Try with finding first
  let result = await buildQuery(cropId, findingId);
  const hasData = single ? !!result.data : result.data?.length > 0;

  // Fallback to crop-level (null finding) if no results with specific finding
  if (findingId && !hasData) {
    result = await buildQuery(cropId, null);
  }

  return result;
}

/**
 * Full cascade: try cropId, then parentCropId, with finding fallback at each level.
 */
async function queryWithCropFallback(
  supabase: SupabaseClient,
  cropId: string,
  select: string,
  findingId: string | null,
  actionTypeId: string | null,
  materialId: string | null,
  single: boolean = false
): Promise<{ data: any; error: any }> {
  // Level 1: direct crop
  let result = await queryRecommendWithFindingFallback(
    supabase, cropId, select, findingId, actionTypeId, materialId, single
  );
  const hasData = single ? !!result.data : result.data?.length > 0;

  if (hasData) return result;

  // Level 2: parent crop
  const parentCropId = await getParentCropId(supabase, cropId);
  if (parentCropId) {
    result = await queryRecommendWithFindingFallback(
      supabase, parentCropId, select, findingId, actionTypeId, materialId, single
    );
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const cropId = searchParams.get('cropId');
    const findingId = searchParams.get('findingId');
    const actionTypeId = searchParams.get('actionTypeId');
    const materialId = searchParams.get('materialId');

    switch (type) {
      case 'findings': {
        if (!cropId) {
          return NextResponse.json({ error: 'cropId is required for findings' }, { status: 400 });
        }

        const { data, error } = await (ctx.supabase.from('crop_findings') as any)
          .select('finding_id, findings(*)')
          .eq('crop_id', cropId);

        if (error) throw error;

        let findings = data?.map((cf: any) => cf.findings).filter(Boolean) || [];

        // Fallback to parent crop
        if (findings.length === 0) {
          const parentCropId = await getParentCropId(ctx.supabase, cropId);
          if (parentCropId) {
            const { data: parentData, error: parentError } = await (ctx.supabase
              .from('crop_findings') as any)
              .select('finding_id, findings(*)')
              .eq('crop_id', parentCropId);
            if (parentError) throw parentError;
            findings = parentData?.map((cf: any) => cf.findings).filter(Boolean) || [];
          }
        }

        return NextResponse.json(findings);
      }

      case 'action_types': {
        const { data, error } = await ctx.supabase
          .from('action_types')
          .select('*')
          .order('name');
        if (error) throw error;
        return NextResponse.json(data || []);
      }

      case 'materials': {
        if (!cropId) {
          return NextResponse.json({ error: 'cropId is required for materials' }, { status: 400 });
        }

        const { data, error } = await queryWithCropFallback(
          ctx.supabase, cropId, 'material_id, materials(*)',
          findingId, actionTypeId, null
        );

        if (error) throw error;

        // Deduplicate materials
        const materialsMap = new Map();
        data?.forEach((rm: any) => {
          if (rm.materials && !materialsMap.has(rm.material_id)) {
            materialsMap.set(rm.material_id, rm.materials);
          }
        });

        // Fall back to all materials if no recommendations found
        if (materialsMap.size === 0) {
          const { data: allMaterials, error: mError } = await ctx.supabase
            .from('materials')
            .select('*')
            .order('name');
          if (mError) throw mError;
          return NextResponse.json(allMaterials || []);
        }

        return NextResponse.json(Array.from(materialsMap.values()));
      }

      case 'dosage': {
        if (!cropId || !materialId) {
          return NextResponse.json(
            { error: 'cropId and materialId are required for dosage' },
            { status: 400 }
          );
        }

        const { data, error } = await queryWithCropFallback(
          ctx.supabase, cropId, 'dosage, unit_type_id, unit_types(*)',
          findingId, actionTypeId, materialId, true
        );

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
  } catch (error) {
    return handleApiError(error);
  }
}
