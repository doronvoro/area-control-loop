/**
 * Import Pesticide Registry CSV from Israeli Ministry of Agriculture
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-registry -- path/to/file.csv --crops 'תפוח,עגבנייה'
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-registry -- path/to/file.csv --list-crops
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-registry -- path/to/file.csv --crops 'תפוח' --replace
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseCsvContent,
  extractCropList,
  filterRowsByCrops,
  parseDosage,
  buildRegistryRow,
} from '../lib/pesticide-registry';

// ============================================================
// Configuration
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('   Get it from: npx supabase status --output json | grep SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// Helpers
// ============================================================

// Cache for getOrCreate to avoid repeated DB lookups
const idCache: Record<string, Record<string, string>> = {};

async function getOrCreate(
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

// ============================================================
// CLI argument parsing
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = '';
  let crops: string[] = [];
  let listCrops = false;
  let replace = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--crops' && args[i + 1]) {
      crops = args[i + 1].split(',').map((c) => c.trim()).filter(Boolean);
      i++;
    } else if (args[i] === '--list-crops') {
      listCrops = true;
    } else if (args[i] === '--replace') {
      replace = true;
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }

  return { filePath, crops, listCrops, replace };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const { filePath, crops, listCrops, replace } = parseArgs();

  if (!filePath) {
    console.error('❌ Usage: npm run import-registry -- <csv-file> --crops "crop1,crop2"');
    console.error('         npm run import-registry -- <csv-file> --list-crops');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Read and parse CSV
  console.log(`📄 Reading CSV: ${resolvedPath}`);
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const allRows = parseCsvContent(content);
  console.log(`   Total rows in CSV: ${allRows.length}`);

  // --list-crops: print unique crop names and exit
  if (listCrops) {
    const cropList = extractCropList(allRows);
    console.log(`\n🌾 Found ${cropList.length} unique crop names:\n`);
    for (const crop of cropList) {
      console.log(`   ${crop.name} (${crop.nameEn}) - ${crop.rowCount} rows`);
    }
    process.exit(0);
  }

  // Validate --crops flag
  if (crops.length === 0) {
    console.error('❌ --crops flag is required. Use --list-crops to see available crops.');
    process.exit(1);
  }

  // Filter rows by selected crops
  const filteredRows = filterRowsByCrops(allRows, crops);
  console.log(`\n🔍 Filtering for crops: ${crops.join(', ')}`);
  console.log(`   Matched rows: ${filteredRows.length} / ${allRows.length}`);

  if (filteredRows.length === 0) {
    console.error('❌ No rows matched the specified crops. Use --list-crops to check names.');
    process.exit(1);
  }

  // --replace: clean up old registry data for these crops
  if (replace) {
    console.log('\n🗑️  Replacing old registry data for selected crops...');

    const { data: existingCrops } = await supabase
      .from('crops')
      .select('id, name')
      .in('name', crops);

    if (existingCrops && existingCrops.length > 0) {
      const cropIds = existingCrops.map((c) => c.id);

      const { error: rmError } = await supabase
        .from('recommend_material')
        .delete()
        .eq('source', 'registry')
        .in('crop_id', cropIds);
      if (rmError) console.warn(`   ⚠️  Error deleting recommend_material: ${rmError.message}`);
      else console.log('   ✅ Deleted old recommend_material (registry) for selected crops');

      const { error: prError } = await supabase
        .from('pesticide_registry')
        .delete()
        .in('crop_name', crops);
      if (prError) console.warn(`   ⚠️  Error deleting pesticide_registry: ${prError.message}`);
      else console.log('   ✅ Deleted old pesticide_registry rows for selected crops');
    }
  }

  // ============================================================
  // Phase 1: Create import batch
  // ============================================================
  console.log('\n📦 Phase 1: Creating import batch...');
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      filename: path.basename(resolvedPath),
      row_count: filteredRows.length,
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    console.error(`❌ Failed to create import batch: ${batchError?.message}`);
    process.exit(1);
  }

  const batchId = batch.id;
  console.log(`   Batch ID: ${batchId}`);
  const errors: Array<{ row: number; error: string }> = [];

  // ============================================================
  // Phase 2: Insert rows into pesticide_registry
  // ============================================================
  console.log('\n📥 Phase 2: Inserting into pesticide_registry...');
  const CHUNK_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < filteredRows.length; i += CHUNK_SIZE) {
    const chunk = filteredRows.slice(i, i + CHUNK_SIZE);
    const registryRows = chunk.map((row, idx) =>
      buildRegistryRow(row, batchId, i + idx + 2)
    );

    const { error } = await supabase.from('pesticide_registry').insert(registryRows);
    if (error) {
      console.error(`   ❌ Chunk ${i}-${i + chunk.length}: ${error.message}`);
      errors.push({ row: i, error: error.message });
    } else {
      insertedCount += chunk.length;
    }

    if ((i + CHUNK_SIZE) % 2000 === 0 || i + CHUNK_SIZE >= filteredRows.length) {
      console.log(`   Inserted ${insertedCount} / ${filteredRows.length} rows...`);
    }
  }

  // ============================================================
  // Phase 3: Sync lookup tables
  // ============================================================
  console.log('\n🔄 Phase 3: Syncing lookup tables...');

  // 3a. Crops
  console.log('   Syncing crops...');
  const uniqueCrops = [...new Set(filteredRows.map((r) => r.crop_name).filter(Boolean))];
  const cropMap: Record<string, string> = {};
  for (const name of uniqueCrops) {
    cropMap[name] = await getOrCreate('crops', 'name', name, {
      name,
      description: name,
      source: 'registry',
    });
  }
  console.log(`   ✅ ${uniqueCrops.length} crops`);

  // 3b. Findings (pests)
  console.log('   Syncing findings (pests)...');
  const uniquePests = [...new Set(filteredRows.map((r) => r.pest_name).filter(Boolean))];
  const findingMap: Record<string, string> = {};
  for (const name of uniquePests) {
    findingMap[name] = await getOrCreate('findings', 'name', name, {
      name,
      description: name,
      source: 'registry',
    });
  }
  console.log(`   ✅ ${uniquePests.length} findings`);

  // 3c. Materials
  console.log('   Syncing materials...');
  const uniqueMaterials = [...new Set(filteredRows.map((r) => r.material_name).filter(Boolean))];
  const materialMap: Record<string, string> = {};
  for (const name of uniqueMaterials) {
    const row = filteredRows.find((r) => r.material_name === name);
    materialMap[name] = await getOrCreate('materials', 'name', name, {
      name,
      description: name,
      active_ingredient: row?.active_ingredient || null,
      source: 'registry',
    });
  }
  console.log(`   ✅ ${uniqueMaterials.length} materials`);

  // 3d. Unit types (from parsed dosages)
  console.log('   Syncing unit types...');
  const unitNames = new Set<string>();
  for (const row of filteredRows) {
    const parsed = parseDosage(row.dosage_text || '');
    if (parsed.unit_name) unitNames.add(parsed.unit_name);
  }
  const unitTypeMap: Record<string, string> = {};
  for (const name of unitNames) {
    unitTypeMap[name] = await getOrCreate('unit_types', 'name', name, {
      name,
      description: name,
    });
  }
  console.log(`   ✅ ${unitNames.size} unit types`);

  // 3e. Update pesticide_registry with FK links
  console.log('   Updating registry FK links...');
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
  console.log('   ✅ FK links updated');

  // ============================================================
  // Phase 4: Sync crop_findings junction
  // ============================================================
  console.log('\n🔗 Phase 4: Syncing crop_findings...');
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
  console.log(`   ✅ ${cfAdded} new crop_findings entries (${cropFindingPairs.size} total pairs)`);

  // ============================================================
  // Phase 5: Sync recommend_material
  // ============================================================
  console.log('\n📋 Phase 5: Syncing recommend_material...');

  const { data: registryRows } = await supabase
    .from('pesticide_registry')
    .select('id, crop_name, pest_name, material_name, dosage_text')
    .eq('import_batch_id', batchId);

  let rmAdded = 0;
  let rmSkipped = 0;
  const seenKeys = new Set<string>();

  for (const regRow of registryRows || []) {
    const parsed = parseDosage(regRow.dosage_text || '');
    if (parsed.value === null || parsed.unit_name === null) {
      rmSkipped++;
      continue;
    }

    const cropId = cropMap[regRow.crop_name];
    const findingId = regRow.pest_name ? findingMap[regRow.pest_name] : null;
    const materialId = materialMap[regRow.material_name];
    const unitTypeId = unitTypeMap[parsed.unit_name];

    if (!cropId || !materialId || !unitTypeId) {
      rmSkipped++;
      continue;
    }

    const key = `${cropId}|${findingId || ''}|${materialId}|${unitTypeId}`;
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
      {
        onConflict: 'crop_id,finding_id,action_type_id,material_id,unit_type_id',
      }
    );

    if (error) {
      errors.push({ row: 0, error: `recommend_material: ${error.message}` });
      rmSkipped++;
    } else {
      rmAdded++;
    }
  }
  console.log(`   ✅ ${rmAdded} recommend_material entries created`);
  console.log(`   ⏭️  ${rmSkipped} rows skipped (unparseable dosage or missing data)`);

  // ============================================================
  // Update batch status
  // ============================================================
  await supabase
    .from('import_batches')
    .update({
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      completed_at: new Date().toISOString(),
      error_log: errors.length > 0 ? errors : null,
    })
    .eq('id', batchId);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Import Summary:');
  console.log(`   Crops imported: ${uniqueCrops.length}`);
  console.log(`   Findings (pests): ${uniquePests.length}`);
  console.log(`   Materials: ${uniqueMaterials.length}`);
  console.log(`   Unit types: ${unitNames.size}`);
  console.log(`   Crop-finding pairs: ${cropFindingPairs.size}`);
  console.log(`   Registry rows: ${insertedCount}`);
  console.log(`   Recommend material entries: ${rmAdded}`);
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.length}`);
  }
  console.log('='.repeat(50));
  console.log('✅ Done!');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
