import type { SupabaseClient } from '@supabase/supabase-js';

// --- Types ---

export interface CascadeParams {
  cropId: string;
  findingId?: string | null;
  actionTypeId?: string | null;
  materialId?: string | null;
}

// --- Private helpers ---

async function getParentCropId(supabase: SupabaseClient, cropId: string): Promise<string | null> {
  const { data } = await (supabase.from('crops') as any)
    .select('parent_crop_id')
    .eq('id', cropId)
    .single();
  return data?.parent_crop_id || null;
}

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

  let result = await buildQuery(cropId, findingId);
  const hasData = single ? !!result.data : result.data?.length > 0;

  if (findingId && !hasData) {
    result = await buildQuery(cropId, null);
  }

  return result;
}

async function queryWithCropFallback(
  supabase: SupabaseClient,
  cropId: string,
  select: string,
  findingId: string | null,
  actionTypeId: string | null,
  materialId: string | null,
  single: boolean = false
): Promise<{ data: any; error: any }> {
  let result = await queryRecommendWithFindingFallback(
    supabase, cropId, select, findingId, actionTypeId, materialId, single
  );
  const hasData = single ? !!result.data : result.data?.length > 0;

  if (hasData) return result;

  const parentCropId = await getParentCropId(supabase, cropId);
  if (parentCropId) {
    result = await queryRecommendWithFindingFallback(
      supabase, parentCropId, select, findingId, actionTypeId, materialId, single
    );
  }

  return result;
}

// --- Public API ---

export async function getCascadeFindings(
  supabase: SupabaseClient,
  params: CascadeParams
): Promise<any[]> {
  const { cropId } = params;

  const { data, error } = await (supabase.from('crop_findings') as any)
    .select('finding_id, findings(*)')
    .eq('crop_id', cropId);

  if (error) throw error;

  let findings = data?.map((cf: any) => cf.findings).filter(Boolean) || [];

  // Fallback to parent crop
  if (findings.length === 0) {
    const parentCropId = await getParentCropId(supabase, cropId);
    if (parentCropId) {
      const { data: parentData, error: parentError } = await (supabase
        .from('crop_findings') as any)
        .select('finding_id, findings(*)')
        .eq('crop_id', parentCropId);
      if (parentError) throw parentError;
      findings = parentData?.map((cf: any) => cf.findings).filter(Boolean) || [];
    }
  }

  return findings;
}

export async function getCascadeMaterials(
  supabase: SupabaseClient,
  params: CascadeParams
): Promise<any[]> {
  const { cropId, findingId, actionTypeId } = params;

  const { data, error } = await queryWithCropFallback(
    supabase, cropId, 'material_id, materials(*), dosage, unit_type_id, unit_types(*)',
    findingId || null, actionTypeId || null, null
  );

  if (error) throw error;

  // Deduplicate materials, attaching recommended dosage/unit info
  const materialsMap = new Map();
  data?.forEach((rm: any) => {
    if (rm.materials && !materialsMap.has(rm.material_id)) {
      materialsMap.set(rm.material_id, {
        ...rm.materials,
        recommended_dosage: rm.dosage,
        recommended_unit_type: rm.unit_types?.name || null,
      });
    }
  });

  // Fall back to all materials if no recommendations found
  if (materialsMap.size === 0) {
    const { data: allMaterials, error: mError } = await supabase
      .from('materials')
      .select('*')
      .order('name');
    if (mError) throw mError;
    return allMaterials || [];
  }

  return Array.from(materialsMap.values());
}

export async function getCascadeDosage(
  supabase: SupabaseClient,
  params: CascadeParams
): Promise<{ dosage: number | null; unit_type_id: string | null; unit_type: any } | null> {
  const { cropId, findingId, actionTypeId, materialId } = params;

  const { data, error } = await queryWithCropFallback(
    supabase, cropId, 'dosage, unit_type_id, unit_types(*)',
    findingId || null, actionTypeId || null, materialId || null, true
  );

  if (error) throw error;

  if (data) {
    return {
      dosage: data.dosage,
      unit_type_id: data.unit_type_id,
      unit_type: data.unit_types,
    };
  }

  return null;
}
