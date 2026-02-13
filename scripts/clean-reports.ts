/**
 * Script to delete all report data from the database
 * Deletes in correct order respecting foreign key constraints
 *
 * Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/clean-reports.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanReports() {
  console.log('Cleaning all report data...\n');

  // Delete in order respecting foreign key constraints:
  // 1. monitoring_treatments (FK → action_treatments via action_treatment_id, FK → monitoring_area_report)
  // 2. action_treatments (FK → actions_area_report)
  // 3. monitoring_area_report (FK → report_areas, FK → actions_area_report)
  // 4. actions_area_report (FK → report_areas)
  // 5. report_areas (root report table)
  const tables = [
    { name: 'monitoring_treatments', label: 'Monitoring Treatments' },
    { name: 'action_treatments', label: 'Action Treatments' },
    { name: 'monitoring_area_report', label: 'Monitoring Reports' },
    { name: 'actions_area_report', label: 'Action Reports' },
    { name: 'report_areas', label: 'Report Areas' },
  ];

  for (const table of tables) {
    // Get count before delete
    const { count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });

    // Delete all rows (neq trick to match all rows)
    const { error } = await supabase
      .from(table.name)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error(`✗ Error deleting from ${table.label}:`, error.message);
    } else {
      console.log(`✓ Deleted ${count || 0} rows from ${table.label}`);
    }
  }

  console.log('\nDone! All report data has been cleaned.');
}

cleanReports().catch(console.error);
