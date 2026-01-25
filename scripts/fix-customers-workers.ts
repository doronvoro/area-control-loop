/**
 * Fix customers and workers - re-insert them
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

async function fixCustomersAndWorkers() {
  console.log('🔧 Fixing customers and workers...\n');

  try {
    // Get auth users
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === 'admin@example.com');
    const customer1User = users?.users?.find(u => u.email === 'customer1@example.com');
    const customer2User = users?.users?.find(u => u.email === 'customer2@example.com');
    const inspector1User = users?.users?.find(u => u.email === 'inspector1@example.com');
    const inspector2User = users?.users?.find(u => u.email === 'inspector2@example.com');
    const inspector3User = users?.users?.find(u => u.email === 'inspector3@example.com');
    const spray1User = users?.users?.find(u => u.email === 'spray1@example.com');
    const spray2User = users?.users?.find(u => u.email === 'spray2@example.com');
    const spray3User = users?.users?.find(u => u.email === 'spray3@example.com');

    if (!adminUser || !customer1User || !customer2User) {
      console.error('❌ Required auth users not found!');
      return;
    }

    // Get worker types
    const { data: workerTypes } = await supabase.from('worker_types').select('*');
    const inspectorType = workerTypes?.find(wt => wt.name === 'inspector');
    const actionWorkerType = workerTypes?.find(wt => wt.name === 'action_worker');

    if (!inspectorType || !actionWorkerType) {
      console.error('❌ Worker types not found!');
      return;
    }

    // Delete existing customers and workers first
    await supabase.from('workers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Create customers
    console.log('Creating customers...');
    const customers = [
      {
        user_id: adminUser.id,
        name: 'חברת ניהול מערכת',
        description: 'חברת ניהול ראשית',
      },
      {
        user_id: customer1User.id,
        name: 'חברת גידול צפון',
        description: 'חברת גידול באזור הצפון',
      },
      {
        user_id: customer2User.id,
        name: 'חברת גידול דרום',
        description: 'חברת גידול באזור הדרום',
      },
    ];

    const { data: insertedCustomers, error: cError } = await supabase
      .from('customers')
      .insert(customers)
      .select();

    if (cError) {
      console.error('❌ Error creating customers:', cError);
      throw cError;
    }

    console.log(`✅ Created ${insertedCustomers?.length || 0} customers`);
    const adminCustomerId = insertedCustomers?.[0].id;
    const customer1Id = insertedCustomers?.[1].id;
    const customer2Id = insertedCustomers?.[2].id;

    // Create workers
    console.log('\nCreating workers...');
    if (!inspector1User || !inspector2User || !inspector3User || !spray1User || !spray2User || !spray3User) {
      console.error('❌ Required worker users not found!');
      return;
    }

    const workers = [
      {
        customer_id: adminCustomerId!,
        user_id: inspector1User.id,
        name: 'פקח יוסי',
        type_id: inspectorType.id,
      },
      {
        customer_id: adminCustomerId!,
        user_id: inspector2User.id,
        name: 'פקח רותם',
        type_id: inspectorType.id,
      },
      {
        customer_id: customer1Id!,
        user_id: inspector3User.id,
        name: 'פקח מיכל',
        type_id: inspectorType.id,
      },
      {
        customer_id: adminCustomerId!,
        user_id: spray1User.id,
        name: 'רסס דני',
        type_id: actionWorkerType.id,
      },
      {
        customer_id: customer1Id!,
        user_id: spray2User.id,
        name: 'רסס אלון',
        type_id: actionWorkerType.id,
      },
      {
        customer_id: customer2Id!,
        user_id: spray3User.id,
        name: 'רסס תומר',
        type_id: actionWorkerType.id,
      },
    ];

    const { data: insertedWorkers, error: wError } = await supabase
      .from('workers')
      .insert(workers)
      .select();

    if (wError) {
      console.error('❌ Error creating workers:', wError);
      throw wError;
    }

    console.log(`✅ Created ${insertedWorkers?.length || 0} workers`);

    // Assign user roles
    console.log('\nAssigning user roles...');
    const { data: roles } = await supabase.from('roles').select('*');
    const adminRole = roles?.find(r => r.name === 'admin');
    const customerOwnerRole = roles?.find(r => r.name === 'customer_owner');
    const workerRole = roles?.find(r => r.name === 'worker');

    if (!adminRole || !customerOwnerRole || !workerRole) {
      console.error('❌ Roles not found!');
      return;
    }

    const userRoles = [
      { user_id: adminUser.id, role_id: adminRole.id },
      { user_id: customer1User.id, role_id: customerOwnerRole.id },
      { user_id: customer2User.id, role_id: customerOwnerRole.id },
      { user_id: inspector1User.id, role_id: workerRole.id },
      { user_id: inspector2User.id, role_id: workerRole.id },
      { user_id: inspector3User.id, role_id: workerRole.id },
      { user_id: spray1User.id, role_id: workerRole.id },
      { user_id: spray2User.id, role_id: workerRole.id },
      { user_id: spray3User.id, role_id: workerRole.id },
    ];

    // Delete existing user roles first
    await supabase.from('user_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: urError } = await supabase.from('user_roles').insert(userRoles);
    if (urError) {
      console.error('❌ Error assigning roles:', urError);
      throw urError;
    }

    console.log(`✅ Assigned ${userRoles.length} user roles`);

    // Re-link customer areas (they might have been orphaned)
    console.log('\nRe-linking customer areas...');
    const { data: allAreas } = await supabase.from('areas').select('*');
    
    // Delete existing customer_areas
    await supabase.from('customer_areas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Link admin customer to all areas
    const adminLinks = allAreas?.map(a => ({
      customer_id: adminCustomerId!,
      area_id: a.id,
    })) || [];
    await supabase.from('customer_areas').insert(adminLinks);

    // Link customer1 to first 4 areas
    const customer1Links = allAreas?.slice(0, 4).map(a => ({
      customer_id: customer1Id!,
      area_id: a.id,
    })) || [];
    await supabase.from('customer_areas').insert(customer1Links);

    // Link customer2 to last 4 areas
    const customer2Links = allAreas?.slice(-4).map(a => ({
      customer_id: customer2Id!,
      area_id: a.id,
    })) || [];
    await supabase.from('customer_areas').insert(customer2Links);

    console.log(`✅ Re-linked customer areas`);

    console.log('\n✅ Fix complete!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixCustomersAndWorkers();
