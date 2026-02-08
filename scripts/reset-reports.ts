/**
 * Script to clean all report data and verify schema
 * Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/reset-reports.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetReports() {
  console.log('🧹 Cleaning report data...\n');

  // Delete in correct order due to FK constraints
  const tables = [
    'action_treatments',
    'monitoring_treatments',
    'actions_area_report',
    'monitoring_area_report',
    'report_areas',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.log(`❌ Error deleting from ${table}:`, error.message);
    } else {
      console.log(`✅ Cleaned ${table}`);
    }
  }

  console.log('\n📋 Verifying schema...\n');

  // Check report_area_types
  const { data: areaTypes, error: areaTypesError } = await supabase
    .from('report_area_types')
    .select('*');

  if (areaTypesError) {
    console.log('❌ Error querying report_area_types:', areaTypesError.message);
  } else {
    console.log('report_area_types data:');
    console.table(areaTypes);

    if (areaTypes && areaTypes.length > 0) {
      const columns = Object.keys(areaTypes[0]);
      if (columns.includes('id')) {
        console.log('⚠️  WARNING: report_area_types has id column (should use name as PK)');
      } else {
        console.log('✅ report_area_types uses name as PK');
      }
    }
  }

  // Check report_areas structure by inserting a test record
  console.log('\n📝 Testing report_areas insert with area_type_id as string...');

  // First get an area_id to use
  const { data: areas } = await supabase.from('areas').select('id, name').limit(1);

  if (areas && areas.length > 0) {
    const testInsert = await supabase
      .from('report_areas')
      .insert({
        area_id: areas[0].id,
        area_type_id: 'monitoring', // Using string directly (AreaTypeId.MONITORING)
        name: 'Test Report - DELETE ME',
        description: 'Test insert to verify schema',
      })
      .select()
      .single();

    if (testInsert.error) {
      console.log('❌ Test insert failed:', testInsert.error.message);
      console.log('   This may indicate schema mismatch');
    } else {
      console.log('✅ Test insert successful with area_type_id="monitoring"');
      console.log('   Returned data:', JSON.stringify(testInsert.data, null, 2));

      // Clean up test record
      await supabase.from('report_areas').delete().eq('id', testInsert.data.id);
      console.log('✅ Test record cleaned up');
    }
  } else {
    console.log('⚠️  No areas found to test with');
  }

  console.log('\n✨ Done!');
}

resetReports().catch(console.error);
