/**
 * Test data access as the admin user
 * This simulates what the app sees when logged in as admin
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  process.exit(1);
}

async function testAccess() {
  console.log('🔍 Testing data access as admin user...\n');

  // Sign in as admin
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'admin123',
  });

  if (authError || !authData.session) {
    console.error('❌ Failed to sign in:', authError?.message);
    return;
  }

  console.log('✅ Signed in as admin\n');

  // Test each query that the app makes
  const tests = [
    { name: 'Areas', query: () => supabase.from('areas').select('*').order('name') },
    { name: 'Findings', query: () => supabase.from('findings').select('*').order('name') },
    { name: 'Action Types', query: () => supabase.from('action_types').select('*').order('name') },
    { name: 'Unit Types', query: () => supabase.from('unit_types').select('*').order('name') },
    { name: 'Worker Types', query: () => supabase.from('worker_types').select('*') },
    { name: 'Inspectors', query: () => {
      return supabase
        .from('workers')
        .select('*, worker_types(*)')
        .eq('worker_types.name', 'inspector');
    }},
    { name: 'Action Workers', query: () => {
      return supabase
        .from('workers')
        .select('*, worker_types(*)')
        .eq('worker_types.name', 'action_worker');
    }},
  ];

  for (const test of tests) {
    try {
      const { data, error } = await test.query();
      if (error) {
        console.log(`❌ ${test.name}: Error - ${error.message}`);
      } else {
        const count = Array.isArray(data) ? data.length : 0;
        console.log(`✅ ${test.name}: ${count} records`);
        if (count > 0 && count <= 3) {
          data.slice(0, 3).forEach((item: any) => {
            console.log(`   - ${item.name || item.display_name || JSON.stringify(item).substring(0, 50)}`);
          });
        }
      }
    } catch (err: any) {
      console.log(`❌ ${test.name}: Exception - ${err.message}`);
    }
  }

  console.log('\n✅ Test complete!');
}

testAccess();
