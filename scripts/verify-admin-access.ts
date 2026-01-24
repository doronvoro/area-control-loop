/**
 * Script to verify admin user access and data visibility
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

async function verifyAccess() {
  console.log('🔍 Verifying admin user access and data...\n');

  try {
    // 1. Check admin user
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === 'admin@example.com');
    
    if (!adminUser) {
      console.error('❌ Admin user not found!');
      return;
    }
    
    console.log(`✅ Admin user found: ${adminUser.email} (${adminUser.id})\n`);

    // 2. Check customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', adminUser.id)
      .single();

    if (!customer) {
      console.error('❌ Customer record not found for admin user!');
      return;
    }
    
    console.log(`✅ Customer record found: ${customer.name} (${customer.id})\n`);

    // 3. Check customer-area links
    const { data: customerAreas } = await supabase
      .from('customer_areas')
      .select('area_id, areas(name)')
      .eq('customer_id', customer.id);

    console.log(`✅ Customer linked to ${customerAreas?.length || 0} areas:`);
    customerAreas?.forEach((ca: any) => {
      console.log(`   - ${ca.areas?.name || 'Unknown'}`);
    });
    console.log('');

    // 4. Check areas (as admin user would see them)
    const { data: allAreas } = await supabase
      .from('areas')
      .select('*');
    
    console.log(`📊 Total areas in database: ${allAreas?.length || 0}`);
    allAreas?.forEach(area => {
      console.log(`   - ${area.name}`);
    });
    console.log('');

    // 5. Check lookup tables
    const [findings, actionTypes, unitTypes, workerTypes] = await Promise.all([
      supabase.from('findings').select('*'),
      supabase.from('action_types').select('*'),
      supabase.from('unit_types').select('*'),
      supabase.from('worker_types').select('*'),
    ]);

    console.log('📋 Lookup tables:');
    console.log(`   - Findings: ${findings.data?.length || 0}`);
    console.log(`   - Action Types: ${actionTypes.data?.length || 0}`);
    console.log(`   - Unit Types: ${unitTypes.data?.length || 0}`);
    console.log(`   - Worker Types: ${workerTypes.data?.length || 0}`);
    console.log('');

    // 6. Check workers
    const { data: workers } = await supabase
      .from('workers')
      .select('*, worker_types(name)');
    
    console.log(`👷 Workers: ${workers?.length || 0}`);
    if (workers && workers.length > 0) {
      workers.forEach((w: any) => {
        console.log(`   - ${w.name} (${w.worker_types?.name || 'unknown'})`);
      });
    } else {
      console.log('   ⚠️  No workers found - forms will have empty dropdowns');
    }
    console.log('');

    // 7. Test RLS by creating a client as the admin user
    console.log('🔐 Testing RLS access as admin user...');
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'admin123',
    });

    if (!session) {
      console.error('❌ Failed to sign in as admin user');
      return;
    }

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    });

    // Test area access
    const { data: accessibleAreas, error: areasError } = await userClient
      .from('areas')
      .select('*');

    if (areasError) {
      console.error(`❌ Error accessing areas: ${areasError.message}`);
    } else {
      console.log(`✅ Admin can see ${accessibleAreas?.length || 0} areas via RLS`);
      if (accessibleAreas && accessibleAreas.length > 0) {
        accessibleAreas.forEach(area => {
          console.log(`   - ${area.name}`);
        });
      } else {
        console.log('   ⚠️  No areas visible - RLS might be blocking access');
      }
    }

    console.log('\n✅ Verification complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAccess();
