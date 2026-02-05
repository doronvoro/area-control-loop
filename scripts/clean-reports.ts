import { createClient } from '@supabase/supabase-js';

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

  // Delete in order respecting foreign key constraints
  const tables = [
    { name: 'action_treatments', label: 'Action Treatments' },
    { name: 'monitoring_treatments', label: 'Monitoring Treatments' },
    { name: 'actions_area_report', label: 'Action Reports' },
    { name: 'monitoring_area_report', label: 'Monitoring Reports' },
    { name: 'report_areas', label: 'Report Areas' },
  ];

  for (const table of tables) {
    // Get count before delete
    const { count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });

    // Delete all rows
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
