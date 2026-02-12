/**
 * Script to seed findings for שזיף (plum) crop
 * and link them to existing materials via recommend_material
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

// Findings data grouped by material
const materialFindings = [
  {
    material: 'MPK',
    actionType: 'הזנה',
    dosage: 0.8,
    unit: 'ליטר',
    findings: [
      { name: 'פריחה חלשה', description: 'פריחה חלשה בעץ', severity: 'medium' },
      { name: 'חנטה נמוכה', description: 'אחוז חנטה נמוך', severity: 'medium' },
      { name: 'פרי קטן', description: 'גודל פרי קטן מהרגיל', severity: 'medium' },
    ],
  },
  {
    material: 'חומצות אמינו',
    actionType: 'הזנה',
    dosage: 0.15,
    unit: 'ליטר',
    findings: [
      { name: 'סטרס חום/קרה', description: 'נזקי סטרס מטמפרטורות קיצוניות', severity: 'medium' },
      { name: 'נשירת פרחים', description: 'נשירת פרחים מוגברת', severity: 'high' },
      { name: 'התאוששות אחרי ריסוס', description: 'נזק לעלווה לאחר ריסוס חזק', severity: 'low' },
    ],
  },
  {
    material: 'סופר סט',
    actionType: 'הזנה',
    dosage: 0.25,
    unit: 'ליטר',
    findings: [
      { name: 'חנטה חלשה', description: 'חנטה חלשה, אחוז חנטה נמוך', severity: 'medium' },
      // נשירת פרחים already created above
    ],
  },
  {
    material: 'אבצאון',
    actionType: 'הדברה',
    dosage: 25,
    unit: 'ליטר',
    findings: [
      { name: 'כנימות', description: 'כנימות על עלים וענפים', severity: 'high' },
      { name: 'זחלים', description: 'זחלים על עלים או פירות', severity: 'high' },
      { name: 'חרקים מוצצי מוהל', description: 'חרקים מוצצים הגורמים נזק לעלווה', severity: 'high' },
    ],
  },
  {
    material: 'מנגן',
    actionType: 'הזנה',
    dosage: 30,
    unit: 'ליטר',
    findings: [
      {
        name: 'הצהבה בין עורקים',
        description: 'הצהבה בין עורקים בעלים צעירים - חוסר מנגן',
        severity: 'medium',
      },
    ],
  },
  {
    material: 'טריטון X100',
    actionType: 'דישון',
    dosage: 0.03,
    unit: 'percentage',
    findings: [
      {
        name: 'חומר לא נתפס על העלים',
        description: 'חומר הדברה לא נתפס טוב על העלים - צורך בחומר הרטבה',
        severity: 'low',
      },
    ],
  },
  {
    material: 'נחושת',
    actionType: 'הדברה',
    dosage: 0.3,
    unit: 'percentage',
    findings: [
      { name: 'כתמים חומים בעלים', description: 'כתמים חומים על העלים', severity: 'medium' },
      { name: 'מחלות חיידקיות', description: 'מחלות חיידקיות בעץ', severity: 'high' },
    ],
  },
  {
    material: 'מרפאן 50',
    actionType: 'הדברה',
    dosage: 0.25,
    unit: 'percentage',
    findings: [
      { name: 'מוניליה', description: 'מחלת מוניליה - ריקבון פרחים ופירות', severity: 'high' },
      { name: 'ריקבון פרי', description: 'ריקבון בפירות', severity: 'high' },
      { name: 'כתמי עלים', description: 'כתמים על העלים', severity: 'medium' },
    ],
  },
];

async function seedShazifFindings() {
  console.log('🌱 Seeding findings for שזיף and linking to materials...\n');

  try {
    // 1. Get שזיף crop
    const { data: shazifCrop } = await supabase
      .from('crops')
      .select('id')
      .eq('name', 'שזיף')
      .single();

    if (!shazifCrop) {
      console.error('❌ Crop שזיף not found! Run seed-recommend-materials first.');
      process.exit(1);
    }
    console.log('✅ Found crop: שזיף\n');

    // 2. Get existing lookups
    const { data: actionTypes } = await supabase.from('action_types').select('id, name');
    const { data: materials } = await supabase.from('materials').select('id, name');
    const { data: unitTypes } = await supabase.from('unit_types').select('id, name');

    const actionTypeMap = Object.fromEntries((actionTypes || []).map((at) => [at.name, at.id]));
    const materialMap = Object.fromEntries((materials || []).map((m) => [m.name, m.id]));
    const unitTypeMap = Object.fromEntries((unitTypes || []).map((ut) => [ut.name, ut.id]));

    // 3. Create findings and recommend_material entries
    let findingsCreated = 0;
    let recommendationsCreated = 0;

    for (const group of materialFindings) {
      const materialId = materialMap[group.material];
      const actionTypeId = actionTypeMap[group.actionType];
      const unitTypeId = unitTypeMap[group.unit];

      if (!materialId) {
        console.log(`⚠️  Material not found: ${group.material}`);
        continue;
      }
      if (!actionTypeId) {
        console.log(`⚠️  Action type not found: ${group.actionType}`);
        continue;
      }
      if (!unitTypeId) {
        console.log(`⚠️  Unit type not found: ${group.unit}`);
        continue;
      }

      console.log(`📦 ${group.material} (${group.actionType}):`);

      for (const finding of group.findings) {
        // Create or get finding
        const findingId = await getOrCreate('findings', 'name', finding.name, finding);

        // Check if this is a new finding
        const { data: existingFinding } = await supabase
          .from('findings')
          .select('name')
          .eq('id', findingId)
          .single();

        if (existingFinding) {
          findingsCreated++;
        }

        // Create recommend_material entry linking שזיף + finding + material
        const { error } = await supabase.from('recommend_material').upsert(
          {
            crop_id: shazifCrop.id,
            finding_id: findingId,
            action_type_id: actionTypeId,
            material_id: materialId,
            unit_type_id: unitTypeId,
            dosage: group.dosage,
          },
          { onConflict: 'crop_id,finding_id,action_type_id,material_id,unit_type_id' }
        );

        if (error) {
          console.log(`   ⚠️  ${finding.name}: ${error.message}`);
        } else {
          recommendationsCreated++;
          const dosageDisplay =
            group.unit === 'percentage' ? `${group.dosage}%` : `${group.dosage}`;
          console.log(`   ✅ ${finding.name} → ${group.material} ${dosageDisplay}`);
        }
      }
    }

    // Also link נשירת פרחים to סופר סט (shared finding)
    console.log('\n🔗 Linking shared findings...');
    const { data: neshiratFinding } = await supabase
      .from('findings')
      .select('id')
      .eq('name', 'נשירת פרחים')
      .single();

    if (neshiratFinding) {
      const { error } = await supabase.from('recommend_material').upsert(
        {
          crop_id: shazifCrop.id,
          finding_id: neshiratFinding.id,
          action_type_id: actionTypeMap['הזנה'],
          material_id: materialMap['סופר סט'],
          unit_type_id: unitTypeMap['ליטר'],
          dosage: 0.25,
        },
        { onConflict: 'crop_id,finding_id,action_type_id,material_id,unit_type_id' }
      );

      if (!error) {
        recommendationsCreated++;
        console.log('   ✅ נשירת פרחים → סופר סט 0.25');
      }
    }

    // Summary
    console.log(`\n✅ Done!`);

    const { count: findingsCount } = await supabase
      .from('findings')
      .select('*', { count: 'exact', head: true });
    const { count: recCount } = await supabase
      .from('recommend_material')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Summary:`);
    console.log(`   Findings in DB: ${findingsCount}`);
    console.log(`   Recommendations added: ${recommendationsCreated}`);
    console.log(`   Total recommendations in DB: ${recCount}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedShazifFindings();
