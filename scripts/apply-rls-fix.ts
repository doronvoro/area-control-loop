/**
 * Apply RLS fix for admin access
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
  console.log('🔧 Applying RLS fix...\n');

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '../supabase/migrations/20260125000000_fix_admin_rls_policies.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            // Try direct query for CREATE POLICY and CREATE FUNCTION
            if (statement.includes('CREATE POLICY') || statement.includes('CREATE OR REPLACE FUNCTION')) {
              console.log(`   Executing: ${statement.substring(0, 50)}...`);
              // Use raw SQL execution via REST API
              const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ sql: statement + ';' }),
              });
              
              if (!response.ok) {
                const text = await response.text();
                console.log(`   ⚠️  Could not execute via RPC, error: ${text.substring(0, 100)}`);
              }
            }
          }
        } catch (err: any) {
          console.log(`   ⚠️  Error executing statement: ${err.message}`);
        }
      }
    }

    console.log('\n⚠️  Some statements may need to be run manually in Supabase SQL Editor');
    console.log('   The SQL file is at: supabase/migrations/20260125000000_fix_admin_rls_policies.sql\n');
    
    // Verify the function was created
    const { data: funcCheck, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'is_admin_user')
      .limit(1);

    if (funcError || !funcCheck || funcCheck.length === 0) {
      console.log('⚠️  Function may not have been created. Please run the SQL manually.\n');
    } else {
      console.log('✅ Function created successfully\n');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

applyRLSFix();
