/**
 * Script to update all lookup tables with Hebrew descriptions
 * Ensures all findings, action_types, and unit_types have Hebrew text
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateHebrewDescriptions() {
  console.log('🔤 Updating all descriptions to Hebrew...\n');

  try {
    // Update findings with Hebrew descriptions
    console.log('1. Updating findings...');
    const findingsUpdates = [
      { name: 'pest_infestation', description: 'הדבקות מזיקים' },
      { name: 'disease', description: 'מחלה' },
      { name: 'nutrient_deficiency', description: 'חוסר חומרים מזינים' },
      { name: 'weed_growth', description: 'צמיחת עשבים' },
      { name: 'aphids', description: 'כנימות' },
      { name: 'mites', description: 'קרדיות' },
      { name: 'fungal_infection', description: 'זיהום פטרייתי' },
      { name: 'bacterial_disease', description: 'מחלה חיידקית' },
      { name: 'whitefly', description: 'כנימת עש' },
      { name: 'thrips', description: 'פטריות' },
      { name: 'spider_mites', description: 'קרדיות עכביש' },
      { name: 'aphids_green', description: 'כנימות ירוקות' },
      { name: 'leaf_miner', description: 'כורי עלים' },
      { name: 'powdery_mildew', description: 'קמחון' },
      { name: 'downy_mildew', description: 'כשותית' },
      { name: 'botrytis', description: 'בוטריטיס' },
      { name: 'bacterial_spot', description: 'כתם חיידקי' },
      { name: 'virus', description: 'וירוס' },
    ];

    for (const finding of findingsUpdates) {
      await supabase
        .from('findings')
        .update({ description: finding.description })
        .eq('name', finding.name);
    }
    console.log(`   ✅ Updated ${findingsUpdates.length} findings\n`);

    // Update action types with Hebrew descriptions
    console.log('2. Updating action types...');
    const actionTypesUpdates = [
      { name: 'spray', description: 'ריסוס' },
      { name: 'prune', description: 'גיזום' },
      { name: 'treat', description: 'טיפול' },
      { name: 'monitor', description: 'ניטור' },
      { name: 'fertilize', description: 'דישון' },
      { name: 'irrigate', description: 'השקיה' },
      { name: 'biological_control', description: 'הדברה ביולוגית' },
      { name: 'mechanical_removal', description: 'הסרה מכנית' },
      { name: 'soil_treatment', description: 'טיפול בקרקע' },
      { name: 'foliar_spray', description: 'ריסוס עלוותי' },
      { name: 'systemic_treatment', description: 'טיפול מערכתי' },
      { name: 'preventive_spray', description: 'ריסוס מניעתי' },
    ];

    for (const actionType of actionTypesUpdates) {
      await supabase
        .from('action_types')
        .update({ description: actionType.description })
        .eq('name', actionType.name);
    }
    console.log(`   ✅ Updated ${actionTypesUpdates.length} action types\n`);

    // Update unit types with Hebrew descriptions
    console.log('3. Updating unit types...');
    const unitTypesUpdates = [
      { name: 'ml', description: 'מיליליטר' },
      { name: 'l', description: 'ליטר' },
      { name: 'kg', description: 'קילוגרם' },
      { name: 'g', description: 'גרם' },
      { name: 'units', description: 'יחידות' },
      { name: 'liters_per_hectare', description: 'ליטר לדונם' },
      { name: 'mg', description: 'מיליגרם' },
      { name: 'ppm', description: 'חלקים למיליון' },
      { name: 'percentage', description: 'אחוז' },
      { name: 'dose_per_plant', description: 'מינון לצמח' },
    ];

    for (const unitType of unitTypesUpdates) {
      await supabase
        .from('unit_types')
        .update({ description: unitType.description })
        .eq('name', unitType.name);
    }
    console.log(`   ✅ Updated ${unitTypesUpdates.length} unit types\n`);

    console.log('✅ All descriptions updated to Hebrew!\n');
    console.log('📝 Refresh your browser to see Hebrew text in all dropdowns and tables.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateHebrewDescriptions();
