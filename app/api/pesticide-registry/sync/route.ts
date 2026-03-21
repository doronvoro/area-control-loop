import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { parseDosage } from '@/lib/pesticide-registry';

async function countRows(supabase: any, table: string, filters?: Record<string, string>): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
  }
  const { count, error } = await query;
  if (error) {
    console.error(`[sync] countRows error for ${table}:`, error.message);
    return -1;
  }
  return count || 0;
}

async function getOrCreate(
  supabase: any,
  table: string,
  matchField: string,
  matchValue: string,
  insertData: Record<string, unknown>,
  cache: Record<string, Record<string, string>>
): Promise<string> {
  if (!cache[table]) cache[table] = {};
  if (cache[table][matchValue]) return cache[table][matchValue];

  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select('id')
    .eq(matchField, matchValue)
    .maybeSingle();

  if (selectError) {
    console.error(`[sync] getOrCreate select error for ${table} "${matchValue}":`, selectError.message);
  }

  if (existing) {
    cache[table][matchValue] = existing.id;
    return existing.id;
  }

  console.log(`[sync] Creating ${table}: "${matchValue}"`);
  const { data: created, error } = await supabase
    .from(table)
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error(`[sync] Failed to create ${table} "${matchValue}":`, error.message);
    throw new Error(`Failed to create ${table} "${matchValue}": ${error.message}`);
  }
  cache[table][matchValue] = created!.id;
  return created!.id;
}

export interface SyncResult {
  success: boolean;
  summary: {
    findingsCreated: number;
    materialsCreated: number;
    cropFindingsCreated: number;
    recommendationsCreated: number;
    errors: Array<{ crop: string; error: string }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { cropIds } = await request.json();
    if (!cropIds || !Array.isArray(cropIds) || cropIds.length === 0) {
      return NextResponse.json({ error: 'cropIds is required' }, { status: 400 });
    }

    console.log(`[sync] Starting sync for ${cropIds.length} crops:`, cropIds);

    const supabase = await createClient();
    const idCache: Record<string, Record<string, string>> = {};
    const summary = {
      findingsCreated: 0,
      materialsCreated: 0,
      cropFindingsCreated: 0,
      recommendationsCreated: 0,
      errors: [] as Array<{ crop: string; error: string }>,
    };

    // Get crop names for selected IDs
    const { data: crops, error: cropsError } = await (supabase.from('crops') as any)
      .select('id, name')
      .in('id', cropIds);

    if (cropsError) {
      console.error('[sync] Error fetching crops:', cropsError.message);
    }

    if (!crops || crops.length === 0) {
      console.error('[sync] No crops found for IDs:', cropIds);
      return NextResponse.json({ error: 'No crops found' }, { status: 404 });
    }

    console.log(`[sync] Found ${crops.length} crops:`, crops.map((c: any) => c.name));

    for (const crop of crops) {
      try {
        console.log(`[sync] Processing crop: "${crop.name}" (${crop.id})`);

        // Get registry rows for this crop
        const { data: registryRows, error: regError } = await (supabase.from('pesticide_registry') as any)
          .select('id, pest_name, material_name, active_ingredient, dosage_text')
          .eq('crop_name', crop.name)
          .limit(50000);

        if (regError) {
          console.error(`[sync] Error fetching registry for ${crop.name}:`, regError.message);
        }

        if (!registryRows || registryRows.length === 0) {
          console.log(`[sync] No registry rows for "${crop.name}", skipping`);
          continue;
        }

        console.log(`[sync] Found ${registryRows.length} registry rows for "${crop.name}"`);

        // Sync findings
        const uniquePests: string[] = [...new Set(registryRows.map((r: any) => r.pest_name).filter(Boolean) as string[])];
        const findingsBefore = await countRows(supabase, 'findings');
        console.log(`[sync] "${crop.name}": ${uniquePests.length} unique pests to sync (findings table before: ${findingsBefore})`);
        const findingMap: Record<string, string> = {};
        for (const name of uniquePests) {
          const before = Object.keys(idCache['findings'] || {}).length;
          findingMap[name] = await getOrCreate(supabase, 'findings', 'name', name, {
            name,
            description: name,
            source: 'registry',
          }, idCache);
          if (Object.keys(idCache['findings']!).length > before) {
            summary.findingsCreated++;
          }
        }
        const findingsAfter = await countRows(supabase, 'findings');
        console.log(`[sync] "${crop.name}": findings table after: ${findingsAfter} (diff: +${findingsAfter - findingsBefore})`);

        // Sync materials
        const uniqueMaterials: string[] = [...new Set(registryRows.map((r: any) => r.material_name).filter(Boolean) as string[])];
        const materialsBefore = await countRows(supabase, 'materials');
        console.log(`[sync] "${crop.name}": ${uniqueMaterials.length} unique materials to sync (materials table before: ${materialsBefore})`);
        const materialMap: Record<string, string> = {};
        for (const name of uniqueMaterials) {
          const before = Object.keys(idCache['materials'] || {}).length;
          const row = registryRows.find((r: any) => r.material_name === name);
          materialMap[name] = await getOrCreate(supabase, 'materials', 'name', name, {
            name,
            description: name,
            active_ingredient: row?.active_ingredient || null,
            source: 'registry',
          }, idCache);
          if (Object.keys(idCache['materials']!).length > before) {
            summary.materialsCreated++;
          }
        }
        const materialsAfter = await countRows(supabase, 'materials');
        console.log(`[sync] "${crop.name}": materials table after: ${materialsAfter} (diff: +${materialsAfter - materialsBefore})`);

        // Sync unit_types
        const unitNames = new Set<string>();
        for (const row of registryRows) {
          const parsed = parseDosage(row.dosage_text || '');
          if (parsed.unit_name) unitNames.add(parsed.unit_name);
        }
        const unitTypeMap: Record<string, string> = {};
        for (const name of unitNames) {
          unitTypeMap[name] = await getOrCreate(supabase, 'unit_types', 'name', name, {
            name,
            description: name,
          }, idCache);
        }
        console.log(`[sync] "${crop.name}": ${unitNames.size} unit types synced`);

        // Sync crop_findings
        const cfBefore = await countRows(supabase, 'crop_findings', { crop_id: crop.id });
        console.log(`[sync] "${crop.name}": crop_findings before: ${cfBefore}`);
        let cfCreated = 0;
        let cfExisted = 0;
        for (const pestName of uniquePests) {
          const findingId = findingMap[pestName];
          if (!findingId) {
            console.warn(`[sync] No finding ID for pest "${pestName}", skipping crop_finding`);
            continue;
          }

          const { data: existing, error: cfCheckErr } = await (supabase.from('crop_findings') as any)
            .select('id')
            .eq('crop_id', crop.id)
            .eq('finding_id', findingId)
            .maybeSingle();

          if (cfCheckErr) {
            console.error(`[sync] Error checking crop_finding for ${crop.name}/${pestName}:`, cfCheckErr.message);
          }

          if (!existing) {
            const { error } = await (supabase.from('crop_findings') as any)
              .insert({ crop_id: crop.id, finding_id: findingId });
            if (error) {
              console.error(`[sync] Error creating crop_finding ${crop.name}/${pestName}:`, error.message);
            } else {
              cfCreated++;
              summary.cropFindingsCreated++;
            }
          } else {
            cfExisted++;
          }
        }
        const cfAfter = await countRows(supabase, 'crop_findings', { crop_id: crop.id });
        console.log(`[sync] "${crop.name}": crop_findings after: ${cfAfter} (diff: +${cfAfter - cfBefore}, created=${cfCreated}, existed=${cfExisted})`);

        // Sync recommend_material
        const rmBefore = await countRows(supabase, 'recommend_material', { crop_id: crop.id });
        console.log(`[sync] "${crop.name}": recommend_material before: ${rmBefore}`);
        const seenKeys = new Set<string>();
        let rmCreated = 0;
        let rmSkipped = 0;
        let rmErrors = 0;
        for (const regRow of registryRows) {
          const parsed = parseDosage(regRow.dosage_text || '');
          const findingId = regRow.pest_name ? findingMap[regRow.pest_name] : null;
          const materialId = materialMap[regRow.material_name];
          const unitTypeId = parsed.unit_name ? unitTypeMap[parsed.unit_name] : null;

          if (!materialId) {
            rmSkipped++;
            continue;
          }

          const key = `${crop.id}|${findingId || ''}|${materialId}|${unitTypeId || ''}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          // Check if exists first (upsert doesn't work with expression-based unique indexes)
          let existsQuery = (supabase.from('recommend_material') as any)
            .select('id')
            .eq('crop_id', crop.id)
            .eq('material_id', materialId);

          // Handle nullable columns — use .is() for null, .eq() for values
          if (findingId) {
            existsQuery = existsQuery.eq('finding_id', findingId);
          } else {
            existsQuery = existsQuery.is('finding_id', null);
          }
          existsQuery = existsQuery.is('action_type_id', null);
          if (unitTypeId) {
            existsQuery = existsQuery.eq('unit_type_id', unitTypeId);
          } else {
            existsQuery = existsQuery.is('unit_type_id', null);
          }

          const { data: existingRm } = await existsQuery.maybeSingle();

          let error;
          if (existingRm) {
            // Update existing
            ({ error } = await (supabase.from('recommend_material') as any)
              .update({
                dosage: parsed.value,
                source: 'registry',
                registry_id: regRow.id,
              })
              .eq('id', existingRm.id));
          } else {
            // Insert new
            ({ error } = await (supabase.from('recommend_material') as any)
              .insert({
                crop_id: crop.id,
                finding_id: findingId,
                action_type_id: null,
                material_id: materialId,
                unit_type_id: unitTypeId,
                dosage: parsed.value,
                source: 'registry',
                registry_id: regRow.id,
              }));
          }

          if (error) {
            console.error(`[sync] Error ${existingRm ? 'updating' : 'inserting'} recommend_material for ${crop.name}:`, error.message, { findingId, materialId, unitTypeId });
            rmErrors++;
          } else {
            rmCreated++;
            summary.recommendationsCreated++;
          }
        }
        const rmAfter = await countRows(supabase, 'recommend_material', { crop_id: crop.id });
        console.log(`[sync] "${crop.name}": recommend_material after: ${rmAfter} (diff: +${rmAfter - rmBefore}, upserted=${rmCreated}, skipped=${rmSkipped}, errors=${rmErrors})`);
      } catch (err: any) {
        console.error(`[sync] Error processing crop ${crop.name}:`, err.message);
        summary.errors.push({ crop: crop.name, error: err.message });
      }
    }

    console.log(`[sync] Completed. findings=${summary.findingsCreated}, materials=${summary.materialsCreated}, cropFindings=${summary.cropFindingsCreated}, recommendations=${summary.recommendationsCreated}, errors=${summary.errors.length}`);

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('[sync] Unexpected error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
