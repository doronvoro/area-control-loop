/**
 * Script to update areas and sub-areas with new naming scheme
 * Areas: A, B, C, 1, 2, 3 (English letters/numbers)
 * Sub-areas: 10-22, 23-40, 41-50 (ranges)
 * Display: "B | 23-40", "A | 10-22", or hierarchical "A | G1 | 3"
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

// Helper function to build display name from hierarchy
function buildDisplayName(areaName: string, subAreaPath: string[]): string {
  return `${areaName} | ${subAreaPath.join(' | ')}`;
}

async function updateAreasAndSubAreas() {
  console.log('🔄 Updating areas and sub-areas with new naming scheme...\n');

  try {
    // 1. Update areas to simple names (A, B, C, 1, 2, 3)
    console.log('1. Updating areas to simple names...');
    const { data: allAreas } = await supabase.from('areas').select('*').order('name');
    
    if (!allAreas || allAreas.length === 0) {
      console.error('❌ No areas found!');
      return;
    }

    // Create area name mapping: use letters A-Z first, then numbers
    const areaNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', '1', '2', '3', '4', '5'];
    const areaUpdates = allAreas.slice(0, areaNames.length).map((area, index) => ({
      id: area.id,
      name: areaNames[index],
      description: `אזור ${areaNames[index]}`,
    }));

    for (const update of areaUpdates) {
      await supabase
        .from('areas')
        .update({ name: update.name, description: update.description })
        .eq('id', update.id);
    }
    console.log(`   ✅ Updated ${areaUpdates.length} areas\n`);

    // 2. Delete existing sub-areas and create new ones
    console.log('2. Creating new sub-areas with range names...');
    await supabase.from('sub_areas').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    const updatedAreas = await supabase.from('areas').select('*').order('name');
    if (!updatedAreas.data) return;

    let subAreasCreated = 0;

    for (const area of updatedAreas.data.slice(0, 8)) {
      const areaName = area.name;
      
      // Create first level sub-areas with ranges
      const firstLevelRanges = [
        '10-22',
        '23-40',
        '41-50',
        '51-60',
        '61-70',
      ];

      const firstLevelSubAreas = firstLevelRanges.map((range, index) => ({
        area_id: area.id,
        parent_sub_area_id: null,
        level: 1,
        name: range,
        variety: null,
        rows: range,
        display: `${areaName} | ${range}`,
      }));

      const { data: insertedFirst } = await supabase
        .from('sub_areas')
        .insert(firstLevelSubAreas)
        .select();

      if (insertedFirst) {
        subAreasCreated += insertedFirst.length;

        // Create second level sub-areas for some (hierarchical)
        // Example: A | G1 | 3
        if (insertedFirst.length >= 2) {
          const secondLevelSubAreas = [
            {
              area_id: area.id,
              parent_sub_area_id: insertedFirst[0].id,
              level: 2,
              name: 'G1',
              variety: null,
              rows: null,
              display: `${areaName} | ${insertedFirst[0].name} | G1`,
            },
            {
              area_id: area.id,
              parent_sub_area_id: insertedFirst[0].id,
              level: 2,
              name: 'G2',
              variety: null,
              rows: null,
              display: `${areaName} | ${insertedFirst[0].name} | G2`,
            },
            {
              area_id: area.id,
              parent_sub_area_id: insertedFirst[1].id,
              level: 2,
              name: '3',
              variety: null,
              rows: null,
              display: `${areaName} | ${insertedFirst[1].name} | 3`,
            },
          ];

          const { data: insertedSecond } = await supabase
            .from('sub_areas')
            .insert(secondLevelSubAreas)
            .select();

          if (insertedSecond) {
            subAreasCreated += insertedSecond.length;

            // Create third level for some (A | G1 | 3)
            if (insertedSecond.length >= 1) {
              const thirdLevelSubAreas = [
                {
                  area_id: area.id,
                  parent_sub_area_id: insertedSecond[0].id,
                  level: 3,
                  name: '3',
                  variety: null,
                  rows: null,
                  display: `${areaName} | ${insertedFirst[0].name} | ${insertedSecond[0].name} | 3`,
                },
              ];

              await supabase.from('sub_areas').insert(thirdLevelSubAreas);
              subAreasCreated += 1;
            }
          }
        }
      }
    }

    console.log(`   ✅ Created ${subAreasCreated} sub-areas\n`);

    // 3. Update report areas to match new area names
    console.log('3. Updating report areas...');
    const { data: reportAreas } = await supabase.from('report_areas').select('*, areas(name)');
    
    if (reportAreas) {
      for (const reportArea of reportAreas) {
        const areaName = (reportArea.areas as any)?.name;
        if (areaName) {
          await supabase
            .from('report_areas')
            .update({
              name: reportArea.type === 'monitoring' 
                ? `דוח ניטור ${areaName}`
                : `דוח פעולה ${areaName}`,
            })
            .eq('id', reportArea.id);
        }
      }
      console.log(`   ✅ Updated ${reportAreas.length} report areas\n`);
    }

    console.log('✅ Areas and sub-areas updated successfully!\n');
    console.log('📋 New structure:');
    console.log('   - Areas: A, B, C, D, E, F, G, H, 1, 2, 3, 4, 5');
    console.log('   - Sub-areas: 10-22, 23-40, 41-50, etc.');
    console.log('   - Display format: "A | 10-22", "B | 23-40", "A | 10-22 | G1 | 3"');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAreasAndSubAreas();
