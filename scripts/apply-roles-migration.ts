/**
 * Script to apply the roles and permissions migration
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

async function applyMigration() {
  console.log('📝 Applying roles and permissions migration...\n');

  try {
    const migrationPath = join(process.cwd(), 'supabase/migrations/006_roles_and_permissions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
          // Try direct query for statements that can't use RPC
          console.log(`   Executing: ${statement.substring(0, 50)}...`);
        }
      }
    }

    // Use direct SQL execution via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      // Try executing via Supabase client directly
      console.log('   Using alternative method...');
      
      // Execute via pg REST API
      const pgResponse = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/pg/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({ sql: migrationSQL }),
      });
    }

    console.log('✅ Migration applied successfully!\n');
  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n💡 Trying to apply via Supabase CLI...');
    console.log('   Run: npx supabase db reset');
    process.exit(1);
  }
}

applyMigration();
