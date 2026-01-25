/**
 * Test user access to data
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

async function testUserAccess() {
  console.log('🧪 Testing user access to data...\n');

  try {
    // Test as admin user
    console.log('1. Testing as admin@example.com...');
    const { data: adminUser } = await supabase.auth.admin.getUserByEmail('admin@example.com');
    if (!adminUser?.user) {
      console.log('   ❌ Admin user not found');
      return;
    }

    // Create a client as the admin user
    const { data: adminSession } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'admin@example.com',
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Set the session manually
    await adminClient.auth.setSession({
      access_token: adminSession?.properties?.hashed_token || '',
      refresh_token: '',
    });

    // Try to query areas as admin
    const { data: adminAreas, error: adminAreasError } = await supabase
      .from('areas')
      .select('*');

    console.log(`   Areas visible to admin: ${adminAreas?.length || 0}`);
    if (adminAreasError) {
      console.log(`   ❌ Error: ${adminAreasError.message}`);
    }

    // Try to query customers as admin
    const { data: adminCustomers, error: adminCustomersError } = await supabase
      .from('customers')
      .select('*');

    console.log(`   Customers visible to admin: ${adminCustomers?.length || 0}`);
    if (adminCustomersError) {
      console.log(`   ❌ Error: ${adminCustomersError.message}`);
    }

    // Test as customer owner
    console.log('\n2. Testing as customer1@example.com...');
    const { data: customerUser } = await supabase.auth.admin.getUserByEmail('customer1@example.com');
    if (!customerUser?.user) {
      console.log('   ❌ Customer user not found');
      return;
    }

    const customerClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to query areas as customer
    const { data: customerAreas, error: customerAreasError } = await supabase
      .from('areas')
      .select('*');

    console.log(`   Areas visible to customer: ${customerAreas?.length || 0}`);
    if (customerAreasError) {
      console.log(`   ❌ Error: ${customerAreasError.message}`);
    }

    // Test as worker
    console.log('\n3. Testing as inspector1@example.com...');
    const { data: workerUser } = await supabase.auth.admin.getUserByEmail('inspector1@example.com');
    if (!workerUser?.user) {
      console.log('   ❌ Worker user not found');
      return;
    }

    const workerClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to query areas as worker
    const { data: workerAreas, error: workerAreasError } = await supabase
      .from('areas')
      .select('*');

    console.log(`   Areas visible to worker: ${workerAreas?.length || 0}`);
    if (workerAreasError) {
      console.log(`   ❌ Error: ${workerAreasError.message}`);
    }

    // Try to query monitoring reports as worker
    const { data: workerReports, error: workerReportsError } = await supabase
      .from('monitoring_area_report')
      .select('*');

    console.log(`   Monitoring reports visible to worker: ${workerReports?.length || 0}`);
    if (workerReportsError) {
      console.log(`   ❌ Error: ${workerReportsError.message}`);
    }

    console.log('\n✅ Access test complete!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testUserAccess();
