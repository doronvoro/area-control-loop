/**
 * Script to remove "אזור" and "תת-אזור" from area and sub-area names in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAreaNames() {
  console.log('🔄 Updating area names (removing "אזור")...\n');

  try {
    // Get all areas
    const { data: areas, error: areasError } = await supabase
      .from('areas')
      .select('id, name');

    if (areasError) throw areasError;

    if (!areas || areas.length === 0) {
      console.log('ℹ️  No areas found');
      return;
    }

    let updated = 0;
    for (const area of areas) {
      const oldName = area.name;
      // Remove "אזור " from the beginning if present
      const newName = oldName.replace(/^אזור\s+/, '').trim();
      
      if (newName !== oldName) {
        const { error: updateError } = await supabase
          .from('areas')
          .update({ name: newName })
          .eq('id', area.id);

        if (updateError) {
          console.error(`❌ Error updating area ${area.id}:`, updateError.message);
        } else {
          console.log(`✓ Updated: "${oldName}" → "${newName}"`);
          updated++;
        }
      }
    }

    console.log(`\n✅ Updated ${updated} area(s)\n`);
  } catch (error: any) {
    console.error('❌ Error updating areas:', error.message);
    throw error;
  }
}

async function updateSubAreaNames() {
  console.log('🔄 Updating sub-area names (removing "תת-אזור")...\n');

  try {
    // Get all sub-areas
    const { data: subAreas, error: subAreasError } = await supabase
      .from('sub_areas')
      .select('id, name');

    if (subAreasError) throw subAreasError;

    if (!subAreas || subAreas.length === 0) {
      console.log('ℹ️  No sub-areas found');
      return;
    }

    let updated = 0;
    for (const subArea of subAreas) {
      const oldName = subArea.name;
      // Remove "תת-אזור " from the beginning if present
      const newName = oldName.replace(/^תת-אזור\s+/, '').trim();
      
      if (newName !== oldName) {
        const { error: updateError } = await supabase
          .from('sub_areas')
          .update({ name: newName })
          .eq('id', subArea.id);

        if (updateError) {
          console.error(`❌ Error updating sub-area ${subArea.id}:`, updateError.message);
        } else {
          console.log(`✓ Updated: "${oldName}" → "${newName}"`);
          updated++;
        }
      }
    }

    console.log(`\n✅ Updated ${updated} sub-area(s)\n`);
  } catch (error: any) {
    console.error('❌ Error updating sub-areas:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting area and sub-area name updates...\n');
  
  await updateAreaNames();
  await updateSubAreaNames();
  
  console.log('✨ All updates completed!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
