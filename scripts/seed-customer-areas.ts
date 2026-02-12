/**
 * Script to seed areas and sub-areas for a specific customer
 * Customer: 364c2ab0-985e-47d7-b486-fce31415ad76
 *
 * Areas:
 *   2 - שזיף (plum)
 *   4 - שזיף (plum)
 *   5 - שזיף (plum)
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

const CUSTOMER_ID = '364c2ab0-985e-47d7-b486-fce31415ad76';

interface SubAreaData {
  variety: string;
  rows: string | null;
  size: number;
}

interface AreaData {
  name: string;
  crop: string;
  size: number;
  subAreas: SubAreaData[];
}

const areasData: AreaData[] = [
  {
    name: '2',
    crop: 'שזיף',
    size: 15,
    subAreas: [
      { variety: 'ליים', rows: null, size: 15 },
    ],
  },
  {
    name: '4',
    crop: 'שזיף',
    size: 19,
    subAreas: [
      { variety: 'מרקו', rows: '1,7,15,23', size: 2.5 },
      { variety: 'רד דיימונד', rows: '2-3,11,19', size: 2.5 },
      { variety: 'גרין רד', rows: '4-6', size: 1.875 },
      { variety: 'מרקו', rows: '30-33', size: 1.875 },
      { variety: 'גרין רד', rows: '8-10', size: 1.875 },
      { variety: 'גרין רד', rows: '12-14', size: 1.875 },
      { variety: 'גרין רד', rows: '16-18', size: 1.875 },
      { variety: 'גרין רד', rows: '20-22,24-26', size: 3.75 },
    ],
  },
  {
    name: '5',
    crop: 'שזיף',
    size: 13.83,
    subAreas: [
      { variety: 'בנדורה', rows: '1-3', size: 2.44 },
      { variety: 'מירל', rows: '4-6', size: 2.44 },
      { variety: 'ביצה שחורה', rows: '42-43', size: 1.63 },
      { variety: 'ביגסן', rows: '39-41', size: 2.44 },
      { variety: 'ביגסן', rows: '33-35', size: 2.44 },
      { variety: 'ויקטורי', rows: '36-38', size: 2.44 },
    ],
  },
];

async function seedCustomerAreas() {
  console.log(`🌱 Seeding areas and sub-areas for customer ${CUSTOMER_ID}...\n`);

  try {
    // 1. Verify the customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', CUSTOMER_ID)
      .single();

    if (customerError || !customer) {
      console.error('❌ Customer not found:', CUSTOMER_ID);
      process.exit(1);
    }
    console.log(`✅ Customer found: ${customer.name}\n`);

    // 2. Look up or create the שזיף crop
    let { data: crop } = await supabase
      .from('crops')
      .select('id')
      .eq('name', 'שזיף')
      .single();

    if (!crop) {
      const { data: newCrop, error: cropError } = await supabase
        .from('crops')
        .insert({ name: 'שזיף', description: 'שזיף' })
        .select()
        .single();

      if (cropError) throw cropError;
      crop = newCrop;
      console.log('✅ Created crop: שזיף');
    } else {
      console.log('✅ Found existing crop: שזיף');
    }

    // 3. Create areas, sub-areas, and link to customer
    for (const areaData of areasData) {
      console.log(`\n📍 Processing area ${areaData.name}...`);

      // Check if area already exists with this name
      let { data: area } = await supabase
        .from('areas')
        .select('id')
        .eq('name', areaData.name)
        .single();

      if (!area) {
        const { data: newArea, error: areaError } = await supabase
          .from('areas')
          .insert({
            name: areaData.name,
            description: `אזור ${areaData.name}`,
            crop_id: crop!.id,
            size: areaData.size,
            size_unit_type: 'dunam',
          })
          .select()
          .single();

        if (areaError) throw areaError;
        area = newArea;
        console.log(`   ✅ Created area: ${areaData.name} (${areaData.size} דונם)`);
      } else {
        // Update existing area with crop and size
        await supabase
          .from('areas')
          .update({
            crop_id: crop!.id,
            size: areaData.size,
            size_unit_type: 'dunam',
          })
          .eq('id', area.id);
        console.log(`   ✅ Updated existing area: ${areaData.name}`);
      }

      // 4. Link area to customer (ignore if already linked)
      const { error: linkError } = await supabase
        .from('customer_areas')
        .upsert(
          { customer_id: CUSTOMER_ID, area_id: area!.id },
          { onConflict: 'customer_id,area_id' }
        );

      if (linkError) {
        console.log(`   ⚠️  Link error (may already exist): ${linkError.message}`);
      } else {
        console.log(`   ✅ Linked area to customer`);
      }

      // 5. Create sub-areas
      // First delete existing sub-areas for this area to avoid duplicates
      await supabase.from('sub_areas').delete().eq('area_id', area!.id);

      const subAreaInserts = areaData.subAreas.map((sa) => ({
        area_id: area!.id,
        parent_sub_area_id: null,
        level: 1,
        name: sa.variety,
        variety: sa.variety,
        rows: sa.rows,
        display: sa.rows
          ? `${areaData.name} | ${sa.variety} | ${sa.rows}`
          : `${areaData.name} | ${sa.variety}`,
        crop_id: crop!.id,
        size: sa.size,
        size_unit_type: 'dunam',
      }));

      const { data: insertedSubAreas, error: subAreaError } = await supabase
        .from('sub_areas')
        .insert(subAreaInserts)
        .select();

      if (subAreaError) throw subAreaError;
      console.log(`   ✅ Created ${insertedSubAreas?.length || 0} sub-areas:`);

      for (const sa of insertedSubAreas || []) {
        console.log(`      - ${sa.display} (${sa.size} דונם)`);
      }
    }

    // Summary
    console.log('\n✅ Seeding completed!\n');
    console.log('📊 Summary:');

    const { data: customerAreasList } = await supabase
      .from('customer_areas')
      .select('areas(id, name, size, crop_id)')
      .eq('customer_id', CUSTOMER_ID);

    console.log(`   Customer areas: ${customerAreasList?.length || 0}`);

    for (const ca of customerAreasList || []) {
      const area = ca.areas as any;
      if (area) {
        const { count } = await supabase
          .from('sub_areas')
          .select('*', { count: 'exact', head: true })
          .eq('area_id', area.id);
        console.log(`   - Area ${area.name}: ${count || 0} sub-areas (${area.size || '?'} דונם)`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedCustomerAreas();
