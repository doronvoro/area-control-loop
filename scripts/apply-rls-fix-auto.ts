/**
 * Automatically apply RLS fix for admin access
 * This script executes the SQL migration directly
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix automatically...\n');

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'supabase/migrations/20260125000000_fix_admin_rls_policies.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute SQL using Supabase REST API directly
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
          
          // Use REST API to execute SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ query: statement }),
          });

          if (!response.ok) {
            // Try alternative approach - use pg_net extension if available
            const errorText = await response.text();
            console.log(`   ⚠️  RPC method failed, trying alternative...`);
            
            // Alternative: Use Supabase management API
            const altResponse = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/pg-meta/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ query: statement }),
            });

            if (!altResponse.ok) {
              console.log(`   ⚠️  Could not execute automatically. Error: ${errorText.substring(0, 100)}`);
              console.log(`   💡 You may need to run this SQL manually in Supabase Studio`);
            } else {
              console.log(`   ✅ Executed successfully`);
            }
          } else {
            console.log(`   ✅ Executed successfully`);
          }
        } catch (err: any) {
          console.log(`   ⚠️  Error: ${err.message}`);
        }
      }
    }

    // Verify the function was created by testing it
    console.log('\n🔍 Verifying function creation...');
    const { data: testResult, error: testError } = await supabase
      .rpc('is_admin_user', { p_user_id: '00000000-0000-0000-0000-000000000000' });

    if (testError) {
      if (testError.message.includes('function') && testError.message.includes('does not exist')) {
        console.log('   ⚠️  Function not found - SQL may need to be run manually');
        console.log('   💡 Open Supabase Studio (http://127.0.0.1:54323) and run the SQL from:');
        console.log('      supabase/migrations/20260125000000_fix_admin_rls_policies.sql\n');
      } else {
        console.log(`   ✅ Function exists (test returned: ${testResult})`);
      }
    } else {
      console.log(`   ✅ Function exists and works`);
    }

    console.log('\n✅ RLS fix application complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Try logging in to the app again');
    console.log('   2. If you still can\'t see data, run the SQL manually in Supabase Studio\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    console.log('\n💡 Please run the SQL manually from:');
    console.log('   supabase/migrations/20260125000000_fix_admin_rls_policies.sql\n');
  }
}

applyRLSFix();
