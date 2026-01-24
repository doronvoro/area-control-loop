/**
 * Script to seed fake data into the database
 * Run with: npx tsx scripts/seed-fake-data.ts
 * 
 * This script creates:
 * - Areas and sub-areas
 * - Report areas
 * - Sample monitoring and action reports (if users exist)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required. Get it from: npx supabase status');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedFakeData() {
  console.log('🌱 Starting to seed fake data...\n');

  try {
    // 1. Ensure worker types exist
    console.log('1. Checking worker types...');
    const { data: workerTypes } = await supabase
      .from('worker_types')
      .select('id, name');

    if (!workerTypes || workerTypes.length === 0) {
      console.log('   Creating worker types...');
      await supabase.from('worker_types').insert([
        { name: 'inspector', display_name: 'פקח', description: 'Inspector worker type' },
        { name: 'action_worker', display_name: 'רסס', description: 'Action worker type' },
      ]);
    }
    console.log('   ✓ Worker types ready\n');

    // 2. Create areas
    console.log('2. Creating areas...');
    const areas = [
      { name: 'אזור צפון', description: 'אזור גידול בצפון הארץ' },
      { name: 'אזור מרכז', description: 'אזור גידול במרכז הארץ' },
      { name: 'אזור דרום', description: 'אזור גידול בדרום הארץ' },
      { name: 'אזור עמק', description: 'אזור גידול בעמק' },
      { name: 'אזור הר', description: 'אזור גידול בהרים' },
    ];

    const { data: existingAreas } = await supabase.from('areas').select('id, name');
    const existingAreaNames = new Set(existingAreas?.map(a => a.name) || []);

    const newAreas = areas.filter(a => !existingAreaNames.has(a.name));
    if (newAreas.length > 0) {
      const { error } = await supabase.from('areas').insert(newAreas);
      if (error) throw error;
      console.log(`   ✓ Created ${newAreas.length} areas`);
    } else {
      console.log('   ✓ Areas already exist');
    }

    // Get all areas for sub-area creation
    const { data: allAreas } = await supabase.from('areas').select('id, name');
    if (!allAreas || allAreas.length === 0) {
      throw new Error('No areas found');
    }
    console.log('');

    // 3. Create sub-areas
    console.log('3. Creating sub-areas...');
    const { data: existingSubAreas } = await supabase.from('sub_areas').select('id, name, area_id');
    
    const subAreasToCreate: any[] = [];
    for (const area of allAreas.slice(0, 3)) {
      // First level sub-areas
      subAreasToCreate.push(
        {
          area_id: area.id,
          parent_sub_area_id: null,
          level: 1,
          name: `תת-אזור ${area.name} 1`,
          variety: 'זן A',
          rows: '1-10',
          display: '1-10 | זן A',
        },
        {
          area_id: area.id,
          parent_sub_area_id: null,
          level: 1,
          name: `תת-אזור ${area.name} 2`,
          variety: 'זן B',
          rows: '11-20',
          display: '11-20 | זן B',
        }
      );
    }

    if (subAreasToCreate.length > 0) {
      const { error } = await supabase.from('sub_areas').insert(subAreasToCreate);
      if (error && !error.message.includes('duplicate')) throw error;
      console.log(`   ✓ Created ${subAreasToCreate.length} sub-areas`);
    } else {
      console.log('   ✓ Sub-areas already exist');
    }
    console.log('');

    // 4. Create report areas
    console.log('4. Creating report areas...');
    const { data: existingReportAreas } = await supabase.from('report_areas').select('id, name, area_id');
    
    const reportAreasToCreate: any[] = [];
    for (const area of allAreas) {
      reportAreasToCreate.push(
        {
          area_id: area.id,
          type: 'monitoring',
          name: `דוח ניטור ${area.name}`,
          description: `דוח ניטור עבור ${area.name}`,
        }
      );
    }

    // Add some action report areas
    for (const area of allAreas.slice(0, 3)) {
      reportAreasToCreate.push({
        area_id: area.id,
        type: 'action',
        name: `דוח פעולה ${area.name}`,
        description: `דוח פעולה עבור ${area.name}`,
      });
    }

    if (reportAreasToCreate.length > 0) {
      const { error } = await supabase.from('report_areas').insert(reportAreasToCreate);
      if (error && !error.message.includes('duplicate')) throw error;
      console.log(`   ✓ Created ${reportAreasToCreate.length} report areas`);
    } else {
      console.log('   ✓ Report areas already exist');
    }
    console.log('');

    // 5. Ensure lookup tables have data
    console.log('5. Ensuring lookup tables have data...');
    
    const findings = [
      { name: 'pest_infestation', description: 'הדבקות מזיקים', severity: 'high' },
      { name: 'disease', description: 'מחלה', severity: 'medium' },
      { name: 'nutrient_deficiency', description: 'חוסר חומרים מזינים', severity: 'low' },
      { name: 'weed_growth', description: 'צמיחת עשבים', severity: 'low' },
      { name: 'aphids', description: 'כנימות', severity: 'high' },
      { name: 'mites', description: 'קרדיות', severity: 'medium' },
    ];

    const actionTypes = [
      { name: 'spray', description: 'ריסוס' },
      { name: 'prune', description: 'גיזום' },
      { name: 'treat', description: 'טיפול' },
      { name: 'fertilize', description: 'דישון' },
    ];

    const unitTypes = [
      { name: 'ml', description: 'מיליליטר' },
      { name: 'l', description: 'ליטר' },
      { name: 'kg', description: 'קילוגרם' },
      { name: 'g', description: 'גרם' },
    ];

    await supabase.from('findings').upsert(findings, { onConflict: 'name' });
    await supabase.from('action_types').upsert(actionTypes, { onConflict: 'name' });
    await supabase.from('unit_types').upsert(unitTypes, { onConflict: 'name' });
    
    console.log('   ✓ Lookup tables populated\n');

    console.log('✅ Fake data seeding completed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Register users via the app (or create them in Supabase dashboard)');
    console.log('   2. Create customers linked to those users');
    console.log('   3. Create workers linked to customers');
    console.log('   4. Link customers to areas via customer_areas table');
    console.log('   5. Create monitoring and action reports');

  } catch (error: any) {
    console.error('❌ Error seeding fake data:', error.message);
    process.exit(1);
  }
}

seedFakeData();
