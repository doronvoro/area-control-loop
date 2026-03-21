import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { parseDosage } from '@/lib/pesticide-registry';

export interface CropSyncStatus {
  id: string;
  name: string;
  isDuplicate?: boolean;
  canDeleteDuplicate?: boolean;
  duplicateRefs?: { areas: number; reports: number; cropFindings: number; recommendations: number };
  registry: {
    totalRows: number;
    uniqueFindings: string[];
    uniqueMaterials: string[];
  };
  synced: {
    findings: number;
    missingFindings: string[];
    materials: number;
    missingMaterials: string[];
    cropFindings: number;
    missingCropFindings: number;
    recommendations: number;
    missingRecommendations: number;
    duplicateCropFindings: number;
    duplicateRecommendations: number;
  };
  status: 'synced' | 'partial' | 'no_registry_data';
}

export async function GET() {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const supabase = await createClient();

    // Get all crops
    const { data: crops, error: cropsError } = await (supabase.from('crops') as any)
      .select('id, name')
      .order('name');

    if (cropsError) {
      console.error('[sync-status] Error fetching crops:', cropsError.message);
      return NextResponse.json({ error: cropsError.message }, { status: 500 });
    }

    console.log(`[sync-status] Found ${(crops || []).length} crops`);

    // Detect duplicate crop names
    const cropNameCount = new Map<string, number>();
    for (const crop of crops || []) {
      cropNameCount.set(crop.name, (cropNameCount.get(crop.name) || 0) + 1);
    }
    const duplicateCropNames = new Set(
      [...cropNameCount.entries()].filter(([, count]) => count > 1).map(([name]) => name)
    );
    if (duplicateCropNames.size > 0) {
      console.warn(`[sync-status] Duplicate crop names found: ${[...duplicateCropNames].join(', ')}`);
    }

    const results: CropSyncStatus[] = [];

    for (const crop of crops || []) {
      // Get registry rows count for this crop (no row limit issues with count)
      const { count: registryCount, error: countError } = await (supabase.from('pesticide_registry') as any)
        .select('id', { count: 'exact', head: true })
        .eq('crop_name', crop.name);

      if (countError) {
        console.error(`[sync-status] Error counting registry for ${crop.name}:`, countError.message);
      }

      const totalRows = registryCount || 0;

      if (totalRows === 0) {
        results.push({
          id: crop.id,
          name: crop.name,
          registry: { totalRows: 0, uniqueFindings: [], uniqueMaterials: [] },
          synced: {
            findings: 0, missingFindings: [],
            materials: 0, missingMaterials: [],
            cropFindings: 0, missingCropFindings: 0,
            recommendations: 0, missingRecommendations: 0,
            duplicateCropFindings: 0, duplicateRecommendations: 0,
          },
          status: 'no_registry_data',
        });
        continue;
      }

      // Get unique pest_name and material_name from registry using distinct values
      // Fetch all rows (override default 1000 limit)
      const { data: registryRows, error: regError } = await (supabase.from('pesticide_registry') as any)
        .select('pest_name, material_name, dosage_text')
        .eq('crop_name', crop.name)
        .limit(50000);

      if (regError) {
        console.error(`[sync-status] Error fetching registry rows for ${crop.name}:`, regError.message);
      }

      const rows = registryRows || [];
      const uniqueFindings: string[] = [...new Set(rows.map((r: any) => r.pest_name).filter(Boolean) as string[])];
      const uniqueMaterials: string[] = [...new Set(rows.map((r: any) => r.material_name).filter(Boolean) as string[])];

      console.log(`[sync-status] Crop "${crop.name}": ${totalRows} registry rows, ${uniqueFindings.length} unique findings, ${uniqueMaterials.length} unique materials`);

      // Check findings table - query in batches if needed
      const existingFindingNames = new Set<string>();
      if (uniqueFindings.length > 0) {
        for (let i = 0; i < uniqueFindings.length; i += 50) {
          const batch = uniqueFindings.slice(i, i + 50);
          const { data: existingFindings, error: fErr } = await (supabase.from('findings') as any)
            .select('name')
            .in('name', batch);
          if (fErr) {
            console.error(`[sync-status] Error querying findings for ${crop.name}:`, fErr.message);
          }
          (existingFindings || []).forEach((f: any) => existingFindingNames.add(f.name));
        }
      }
      const missingFindings = uniqueFindings.filter((f) => !existingFindingNames.has(f));

      // Check materials table - query in batches if needed
      const existingMaterialNames = new Set<string>();
      if (uniqueMaterials.length > 0) {
        for (let i = 0; i < uniqueMaterials.length; i += 50) {
          const batch = uniqueMaterials.slice(i, i + 50);
          const { data: existingMaterials, error: mErr } = await (supabase.from('materials') as any)
            .select('name')
            .in('name', batch);
          if (mErr) {
            console.error(`[sync-status] Error querying materials for ${crop.name}:`, mErr.message);
          }
          (existingMaterials || []).forEach((m: any) => existingMaterialNames.add(m.name));
        }
      }
      const missingMaterials = uniqueMaterials.filter((m) => !existingMaterialNames.has(m));

      console.log(`[sync-status] Crop "${crop.name}": missingFindings=${missingFindings.length}, missingMaterials=${missingMaterials.length}`);
      if (missingFindings.length > 0) {
        console.log(`[sync-status]   Missing findings: ${missingFindings.slice(0, 5).join(', ')}${missingFindings.length > 5 ? '...' : ''}`);
      }
      if (missingMaterials.length > 0) {
        console.log(`[sync-status]   Missing materials: ${missingMaterials.slice(0, 5).join(', ')}${missingMaterials.length > 5 ? '...' : ''}`);
      }

      // Check crop_findings
      const { data: cropFindings, error: cfErr } = await (supabase.from('crop_findings') as any)
        .select('finding_id')
        .eq('crop_id', crop.id)
        .limit(50000);

      if (cfErr) {
        console.error(`[sync-status] Error querying crop_findings for ${crop.name}:`, cfErr.message);
      }

      // Get finding IDs for comparison
      const syncedFindingIds = new Set((cropFindings || []).map((cf: any) => cf.finding_id));

      // Get IDs for the unique findings that exist
      let missingCropFindingsCount = 0;
      if (uniqueFindings.length > 0 && existingFindingNames.size > 0) {
        // Get IDs of findings that exist but aren't in crop_findings
        for (let i = 0; i < uniqueFindings.length; i += 50) {
          const batch = uniqueFindings.slice(i, i + 50).filter((f) => existingFindingNames.has(f));
          if (batch.length === 0) continue;
          const { data: findingIds } = await (supabase.from('findings') as any)
            .select('id, name')
            .in('name', batch);
          for (const f of findingIds || []) {
            if (!syncedFindingIds.has(f.id)) {
              missingCropFindingsCount++;
            }
          }
        }
      }

      console.log(`[sync-status] Crop "${crop.name}": cropFindings=${(cropFindings || []).length}, missingCropFindings=${missingCropFindingsCount}`);

      // Check recommend_material — build expected keys the same way the sync route does:
      // key = finding_name|material_name|unit_name (deduped via parseDosage)
      const expectedKeys = new Set<string>();
      for (const r of rows) {
        if (!r.material_name) continue;
        const parsed = parseDosage(r.dosage_text || '');
        const key = `${r.pest_name || ''}|||${r.material_name}|||${parsed.unit_name || ''}`;
        expectedKeys.add(key);
      }

      const { count: recommendationCount, error: rmCountErr } = await (supabase.from('recommend_material') as any)
        .select('id', { count: 'exact', head: true })
        .eq('crop_id', crop.id);

      if (rmCountErr) {
        console.error(`[sync-status] Error counting recommendations for ${crop.name}:`, rmCountErr.message);
      }

      const rmCount = recommendationCount || 0;
      const missingRecommendations = Math.max(0, expectedKeys.size - rmCount);

      console.log(`[sync-status] Crop "${crop.name}": recommendations=${rmCount}, expectedKeys=${expectedKeys.size}, missingRecommendations=${missingRecommendations}`);

      // Count duplicate crop_findings for this crop
      const cfKeys = new Set<string>();
      let duplicateCfCount = 0;
      for (const cf of cropFindings || []) {
        const key = `${crop.id}|${cf.finding_id}`;
        if (cfKeys.has(key)) {
          duplicateCfCount++;
        } else {
          cfKeys.add(key);
        }
      }

      // Count duplicate recommend_material for this crop
      const { data: allRm } = await (supabase.from('recommend_material') as any)
        .select('finding_id, action_type_id, material_id, unit_type_id')
        .eq('crop_id', crop.id)
        .limit(50000);

      const rmKeys = new Set<string>();
      let duplicateRmCount = 0;
      for (const rm of allRm || []) {
        const key = `${rm.finding_id || ''}|${rm.action_type_id || ''}|${rm.material_id}|${rm.unit_type_id || ''}`;
        if (rmKeys.has(key)) {
          duplicateRmCount++;
        } else {
          rmKeys.add(key);
        }
      }

      if (duplicateCfCount > 0 || duplicateRmCount > 0) {
        console.warn(`[sync-status] Crop "${crop.name}": duplicates found — crop_findings=${duplicateCfCount}, recommend_material=${duplicateRmCount}`);
      }

      const hasMissing =
        missingFindings.length > 0 ||
        missingMaterials.length > 0 ||
        missingCropFindingsCount > 0 ||
        missingRecommendations > 0 ||
        duplicateCfCount > 0 ||
        duplicateRmCount > 0;

      // For duplicate crops, check if this one can be safely deleted
      let canDeleteDuplicate = false;
      let duplicateRefs: { areas: number; reports: number; cropFindings: number; recommendations: number } | undefined;
      if (duplicateCropNames.has(crop.name)) {
        const { count: areaRefs } = await (supabase.from('areas') as any)
          .select('id', { count: 'exact', head: true })
          .eq('crop_id', crop.id);
        const { count: subAreaRefs } = await (supabase.from('sub_areas') as any)
          .select('id', { count: 'exact', head: true })
          .eq('crop_id', crop.id);
        const cfCount = (cropFindings || []).length;

        duplicateRefs = {
          areas: (areaRefs || 0) + (subAreaRefs || 0),
          reports: 0, // reports reference areas, not crops directly
          cropFindings: cfCount,
          recommendations: rmCount,
        };
        // Safe to delete if no areas, crop_findings, or recommendations reference this crop
        canDeleteDuplicate = duplicateRefs.areas === 0 && cfCount === 0 && rmCount === 0;
      }

      results.push({
        id: crop.id,
        name: crop.name,
        isDuplicate: duplicateCropNames.has(crop.name),
        canDeleteDuplicate,
        duplicateRefs,
        registry: {
          totalRows: totalRows,
          uniqueFindings,
          uniqueMaterials,
        },
        synced: {
          findings: existingFindingNames.size,
          missingFindings,
          materials: existingMaterialNames.size,
          missingMaterials,
          cropFindings: (cropFindings || []).length,
          missingCropFindings: missingCropFindingsCount,
          recommendations: rmCount,
          missingRecommendations,
          duplicateCropFindings: duplicateCfCount,
          duplicateRecommendations: duplicateRmCount,
        },
        status: hasMissing ? 'partial' : 'synced',
      });
    }

    const partial = results.filter((r) => r.status === 'partial').length;
    const synced = results.filter((r) => r.status === 'synced').length;
    const noData = results.filter((r) => r.status === 'no_registry_data').length;
    console.log(`[sync-status] Summary: ${results.length} crops — synced=${synced}, partial=${partial}, no_data=${noData}`);

    return NextResponse.json({ crops: results });
  } catch (error: any) {
    console.error('[sync-status] Unexpected error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
