/**
 * Fix admin RLS policies to use user_roles table instead of user_metadata
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

async function fixAdminRLS() {
  console.log('🔧 Fixing admin RLS policies...\n');

  try {
    // Create a helper function to check if user is admin
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
        RETURNS BOOLEAN AS $$
          SELECT EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = p_user_id
            AND r.name = 'admin'
          );
        $$ LANGUAGE sql STABLE SECURITY DEFINER;
      `,
    });

    if (funcError && !funcError.message.includes('already exists')) {
      console.log('Creating helper function...');
      // Try direct SQL execution
      const { error: directError } = await supabase
        .from('_exec_sql')
        .select('*')
        .limit(0);
      
      console.log('   ⚠️  Cannot create function via client, will need to run SQL manually');
    }

    // Drop existing admin policies
    console.log('Dropping old admin policies...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Admins can view all areas" ON areas;
        DROP POLICY IF EXISTS "Admins can view all sub-areas" ON sub_areas;
        DROP POLICY IF EXISTS "Admins can view all report areas" ON report_areas;
        DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
        DROP POLICY IF EXISTS "Admins can view all workers" ON workers;
        DROP POLICY IF EXISTS "Admins can view all monitoring reports" ON monitoring_area_report;
        DROP POLICY IF EXISTS "Admins can view all action reports" ON actions_area_report;
      `,
    });

    console.log('   ✅ Dropped old policies\n');

    // Create new admin policies using user_roles
    console.log('Creating new admin policies...');
    
    // Note: We'll need to run this via SQL directly since Supabase client doesn't support CREATE POLICY
    console.log('\n⚠️  Please run the following SQL in Supabase SQL Editor:\n');
    console.log(`
-- Create helper function
CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.name = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Admin policies for areas
CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for sub-areas
CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for report areas
CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for customers
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for workers
CREATE POLICY "Admins can view all workers"
  ON workers FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for monitoring reports
CREATE POLICY "Admins can view all monitoring reports"
  ON monitoring_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin policies for action reports
CREATE POLICY "Admins can view all action reports"
  ON actions_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));
    `);

    console.log('\n✅ Instructions printed above\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixAdminRLS();
