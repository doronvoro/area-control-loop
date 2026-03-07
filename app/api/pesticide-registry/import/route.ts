import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, checkRole } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import {
  parseCsvContent,
  filterRowsByCrops,
  parseDosage,
  buildRegistryRow,
} from '@/lib/pesticide-registry';

const CHUNK_SIZE = 500;

// Cache for getOrCreate
const idCache: Record<string, Record<string, string>> = {};

async function getOrCreate(
  supabase: any,
  table: string,
  matchField: string,
  matchValue: string,
  insertData: Record<string, unknown>
): Promise<string> {
  if (!idCache[table]) idCache[table] = {};
  if (idCache[table][matchValue]) return idCache[table][matchValue];

  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq(matchField, matchValue)
    .single();

  if (existing) {
    idCache[table][matchValue] = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from(table)
    .insert(insertData)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create ${table} "${matchValue}": ${error.message}`);
  idCache[table][matchValue] = created!.id;
  return created!.id;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    const isCustomerOwner = await checkRole(ctx, 'customer_owner');
    if (!ctx.isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cropsParam = formData.get('crops') as string | null;
    const replaceParam = formData.get('replace') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'נדרש קובץ CSV' }, { status: 400 });
    }
    if (!cropsParam) {
      return NextResponse.json({ error: 'נדרש לבחור גידולים' }, { status: 400 });
    }

    const selectedCrops = cropsParam.split(',').map((c) => c.trim()).filter(Boolean);
    const replace = replaceParam === 'true';

    const content = await file.text();
    const allRows = parseCsvContent(content);
    const filteredRows = filterRowsByCrops(allRows, selectedCrops);

    if (filteredRows.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו שורות' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = ctx.adminClient;

    // Clear idCache for fresh import
    for (const key in idCache) delete idCache[key];

    // Replace: clean up old data
    if (replace) {
      const { data: existingCrops } = await supabase
        .from('crops')
        .select('id, name')
        .in('name', selectedCrops);

      if (existingCrops && existingCrops.length > 0) {
        const cropIds = existingCrops.map((c: any) => c.id);
        await supabase
          .from('recommend_material')
          .delete()
          .eq('source', 'registry')
          .in('crop_id', cropIds);
        await supabase
          .from('pesticide_registry')
          .delete()
          .in('crop_name', selectedCrops);
      }
    }

    const errors: Array<{ row: number; error: string }> = [];

    // Phase 1: Create import batch
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        filename: file.name,
        row_count: filteredRows.length,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: `שגיאה ביצירת batch: ${batchError?.message}` },
        { status: 500 }
      );
    }
    const batchId = batch.id;

    // Phase 2: Insert registry rows
    let insertedCount = 0;
    for (let i = 0; i < filteredRows.length; i += CHUNK_SIZE) {
      const chunk = filteredRows.slice(i, i + CHUNK_SIZE);
      const registryRows = chunk.map((row, idx) =>
        buildRegistryRow(row, batchId, i + idx + 2)
      );
      const { error } = await supabase.from('pesticide_registry').insert(registryRows);
      if (error) {
        errors.push({ row: i, error: error.message });
      } else {
        insertedCount += chunk.length;
      }
    }

    // Phase 3: Sync lookup tables
    const uniqueCrops = [...new Set(filteredRows.map((r) => r.crop_name).filter(Boolean))];
    const cropMap: Record<string, string> = {};
    for (const name of uniqueCrops) {
      cropMap[name] = await getOrCreate(supabase, 'crops', 'name', name, {
        name,
        description: name,
        source: 'registry',
      });
    }

    const uniquePests = [...new Set(filteredRows.map((r) => r.pest_name).filter(Boolean))];
    const findingMap: Record<string, string> = {};
    for (const name of uniquePests) {
      findingMap[name] = await getOrCreate(supabase, 'findings', 'name', name, {
        name,
        description: name,
        source: 'registry',
      });
    }

    const uniqueMaterials = [...new Set(filteredRows.map((r) => r.material_name).filter(Boolean))];
    const materialMap: Record<string, string> = {};
    for (const name of uniqueMaterials) {
      const row = filteredRows.find((r) => r.material_name === name);
      materialMap[name] = await getOrCreate(supabase, 'materials', 'name', name, {
        name,
        description: name,
        active_ingredient: row?.active_ingredient || null,
        source: 'registry',
      });
    }

    const unitNames = new Set<string>();
    for (const row of filteredRows) {
      const parsed = parseDosage(row.dosage_text || '');
      if (parsed.unit_name) unitNames.add(parsed.unit_name);
    }
    const unitTypeMap: Record<string, string> = {};
    for (const name of unitNames) {
      unitTypeMap[name] = await getOrCreate(supabase, 'unit_types', 'name', name, {
        name,
        description: name,
      });
    }

    // Update registry FK links
    for (const cropName of uniqueCrops) {
      await supabase
        .from('pesticide_registry')
        .update({ crop_id: cropMap[cropName] })
        .eq('crop_name', cropName)
        .eq('import_batch_id', batchId);
    }
    for (const pestName of uniquePests) {
      await supabase
        .from('pesticide_registry')
        .update({ finding_id: findingMap[pestName] })
        .eq('pest_name', pestName)
        .eq('import_batch_id', batchId);
    }
    for (const matName of uniqueMaterials) {
      await supabase
        .from('pesticide_registry')
        .update({ material_id: materialMap[matName] })
        .eq('material_name', matName)
        .eq('import_batch_id', batchId);
    }

    // Phase 4: Sync crop_findings
    const cropFindingPairs = new Set<string>();
    for (const row of filteredRows) {
      if (row.crop_name && row.pest_name) {
        cropFindingPairs.add(`${row.crop_name}|||${row.pest_name}`);
      }
    }

    let cfAdded = 0;
    for (const pair of cropFindingPairs) {
      const [cropName, pestName] = pair.split('|||');
      const cropId = cropMap[cropName];
      const findingId = findingMap[pestName];
      if (!cropId || !findingId) continue;

      const { data: existing } = await supabase
        .from('crop_findings')
        .select('id')
        .eq('crop_id', cropId)
        .eq('finding_id', findingId)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('crop_findings')
          .insert({ crop_id: cropId, finding_id: findingId });
        if (!error) cfAdded++;
      }
    }

    // Phase 5: Sync recommend_material
    const { data: registryRows } = await supabase
      .from('pesticide_registry')
      .select('id, crop_name, pest_name, material_name, dosage_text')
      .eq('import_batch_id', batchId);

    let rmAdded = 0;
    let rmSkipped = 0;
    const seenKeys = new Set<string>();

    for (const regRow of registryRows || []) {
      const parsed = parseDosage(regRow.dosage_text || '');

      const cropId = cropMap[regRow.crop_name];
      const findingId = regRow.pest_name ? findingMap[regRow.pest_name] : null;
      const materialId = materialMap[regRow.material_name];
      const unitTypeId = parsed.unit_name ? unitTypeMap[parsed.unit_name] : null;

      if (!cropId || !materialId) {
        rmSkipped++;
        continue;
      }

      const key = `${cropId}|${findingId || ''}|${materialId}|${unitTypeId || ''}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const { error } = await supabase.from('recommend_material').upsert(
        {
          crop_id: cropId,
          finding_id: findingId,
          action_type_id: null,
          material_id: materialId,
          unit_type_id: unitTypeId,
          dosage: parsed.value,
          source: 'registry',
          registry_id: regRow.id,
        },
        { onConflict: 'crop_id,finding_id,action_type_id,material_id,unit_type_id' }
      );

      if (error) {
        errors.push({ row: 0, error: `recommend_material: ${error.message}` });
        rmSkipped++;
      } else {
        rmAdded++;
      }
    }

    // Update batch status
    await supabase
      .from('import_batches')
      .update({
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        error_log: errors.length > 0 ? errors : null,
      })
      .eq('id', batchId);

    return NextResponse.json({
      success: true,
      batchId,
      summary: {
        crops: uniqueCrops.length,
        findings: uniquePests.length,
        materials: uniqueMaterials.length,
        unitTypes: unitNames.size,
        cropFindings: cfAdded,
        recommendations: rmAdded,
        skipped: rmSkipped,
        registryRows: insertedCount,
        errors,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
