/**
 * Script to seed המלצות חומרים (material recommendations)
 * Adds action_types, crops, materials, and recommend_material entries
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('   Get it from: npx supabase status --output json | grep SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Data from the table
const recommendations = [
  { type: 'הזנה', fruitType: 'הכל', material: 'MPK', dosage: 0.8, unit: 'ליטר', sprayVolume: 150 },
  { type: 'הזנה', fruitType: 'הכל', material: 'חומצות אמינו', dosage: 0.15, unit: 'ליטר', sprayVolume: 150 },
  { type: 'הזנה', fruitType: 'הכל', material: 'סופר סט', dosage: 0.25, unit: 'ליטר', sprayVolume: 150 },
  { type: 'הזנה', fruitType: 'הכל', material: 'אבצאון', dosage: 25, unit: 'ליטר', sprayVolume: 150 },
  { type: 'הזנה', fruitType: 'הכל', material: 'מנגן', dosage: 30, unit: 'ליטר', sprayVolume: 150 },
  { type: 'דישון', fruitType: 'הכל', material: 'טריטון X100', dosage: 0.03, unit: 'percentage', sprayVolume: 150 },
  { type: 'דישון', fruitType: 'הדרים', material: 'נחושת', dosage: 0.40, unit: 'percentage', sprayVolume: 150 },
  { type: 'הדברה', fruitType: 'נשירים', material: 'נחושת', dosage: 0.30, unit: 'percentage', sprayVolume: 150 },
  { type: 'הדברה', fruitType: 'נשירים', material: 'מרפאן 50', dosage: 0.25, unit: 'percentage', sprayVolume: 250 },
];

// Helper: get or create a record
async function getOrCreate(
  table: string,
  matchField: string,
  matchValue: string,
  insertData: Record<string, unknown>
): Promise<string> {
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq(matchField, matchValue)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from(table)
    .insert(insertData)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create ${table} "${matchValue}": ${error.message}`);
  return created!.id;
}

async function seedRecommendMaterials() {
  console.log('🌱 Seeding המלצות חומרים (material recommendations)...\n');

  try {
    // 1. Ensure action_types exist
    console.log('1. Ensuring action types exist...');
    const actionTypeMap: Record<string, string> = {};
    const actionTypes = [
      { name: 'הזנה', description: 'הזנה' },
      { name: 'דישון', description: 'דישון' },
      { name: 'הדברה', description: 'הדברה' },
    ];

    for (const at of actionTypes) {
      actionTypeMap[at.name] = await getOrCreate('action_types', 'name', at.name, at);
      console.log(`   ✅ ${at.name}`);
    }

    // 2. Ensure crops/fruit types exist
    console.log('\n2. Ensuring crop/fruit types exist...');
    const cropMap: Record<string, string> = {};
    const crops = [
      { name: 'הכל', description: 'כל סוגי הפרי' },
      { name: 'הדרים', description: 'הדרים' },
      { name: 'נשירים', description: 'נשירים' },
    ];

    for (const crop of crops) {
      cropMap[crop.name] = await getOrCreate('crops', 'name', crop.name, crop);
      console.log(`   ✅ ${crop.name}`);
    }

    // 3. Ensure materials exist
    console.log('\n3. Ensuring materials exist...');
    const materialMap: Record<string, string> = {};
    const materialNames = [...new Set(recommendations.map((r) => r.material))];

    for (const name of materialNames) {
      materialMap[name] = await getOrCreate('materials', 'name', name, {
        name,
        description: name,
      });
      console.log(`   ✅ ${name}`);
    }

    // 4. Ensure unit types exist
    console.log('\n4. Ensuring unit types exist...');
    const unitTypeMap: Record<string, string> = {};
    const unitTypes = [
      { name: 'ליטר', description: 'ליטר' },
      { name: 'percentage', description: 'אחוז' },
    ];

    for (const ut of unitTypes) {
      unitTypeMap[ut.name] = await getOrCreate('unit_types', 'name', ut.name, ut);
      console.log(`   ✅ ${ut.name} (${ut.description})`);
    }

    // 5. Insert recommend_material entries
    console.log('\n5. Inserting material recommendations...');
    let added = 0;

    for (const rec of recommendations) {
      const entry = {
        crop_id: cropMap[rec.fruitType],
        action_type_id: actionTypeMap[rec.type],
        material_id: materialMap[rec.material],
        unit_type_id: unitTypeMap[rec.unit],
        dosage: rec.dosage,
      };

      const { error } = await supabase.from('recommend_material').upsert(entry, {
        onConflict: 'crop_id,finding_id,action_type_id,material_id,unit_type_id',
      });

      if (error) {
        console.log(`   ⚠️  ${rec.material} (${rec.type}/${rec.fruitType}): ${error.message}`);
      } else {
        added++;
        const dosageDisplay = rec.unit === 'percentage' ? `${rec.dosage}%` : `${rec.dosage}`;
        console.log(
          `   ✅ ${rec.type} | ${rec.fruitType} | ${rec.material} | ${dosageDisplay} | נפח ${rec.sprayVolume}`
        );
      }
    }

    // Summary
    console.log(`\n✅ Done! Added ${added} material recommendations.`);

    const { count } = await supabase
      .from('recommend_material')
      .select('*', { count: 'exact', head: true });
    console.log(`📊 Total recommendations in DB: ${count || 0}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedRecommendMaterials();
