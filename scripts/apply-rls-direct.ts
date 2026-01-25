/**
 * Apply RLS fix directly using fetch to Supabase SQL endpoint
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

async function applyRLSDirect() {
  console.log('🔧 Applying RLS fix directly...\n');

  const sqlStatements = [
    `CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.name = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;`,
    `DROP POLICY IF EXISTS "Admins can view all areas" ON areas;`,
    `DROP POLICY IF EXISTS "Admins can view all sub-areas" ON sub_areas;`,
    `DROP POLICY IF EXISTS "Admins can view all report areas" ON report_areas;`,
    `CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all workers"
  ON workers FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all monitoring reports"
  ON monitoring_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all action reports"
  ON actions_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));`,
    `CREATE POLICY "Admins can view all customer areas"
  ON customer_areas FOR SELECT
  USING (is_admin_user(auth.uid()));`,
  ];

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`[${i + 1}/${sqlStatements.length}] Executing SQL...`);
    
    try {
      // Try using the Supabase REST API with exec_sql function
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        // The exec_sql function doesn't exist, so we need to use a different approach
        console.log(`   ⚠️  Cannot execute via REST API (function not available)`);
        console.log(`   💡 Please run the SQL manually in Supabase Studio:`);
        console.log(`      http://127.0.0.1:54323 → SQL Editor`);
        console.log(`\n   Or copy this SQL:\n`);
        console.log(sql);
        console.log(`\n`);
        break;
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err: any) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
  }

  console.log('\n✅ Done!');
  console.log('\n📝 If SQL was not executed automatically:');
  console.log('   1. Open Supabase Studio: http://127.0.0.1:54323');
  console.log('   2. Go to SQL Editor');
  console.log('   3. Copy and paste the SQL from: supabase/migrations/20260125000000_fix_admin_rls_policies.sql');
  console.log('   4. Click "Run"\n');
}

applyRLSDirect();
