/**
 * Script to assign roles to users
 * Assigns admin role to admin user and customer_owner role to customer owners
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

async function assignRoles() {
  console.log('👤 Assigning roles to users...\n');

  try {
    // Get roles
    const { data: roles } = await supabase.from('roles').select('*');
    const adminRole = roles?.find(r => r.name === 'admin');
    const customerOwnerRole = roles?.find(r => r.name === 'customer_owner');
    const workerRole = roles?.find(r => r.name === 'worker');

    if (!adminRole || !customerOwnerRole || !workerRole) {
      console.error('❌ Roles not found! Run migrations first.');
      return;
    }

    // Get all users
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users?.users) {
      console.error('❌ No users found!');
      return;
    }

    // Get customers
    const { data: customers } = await supabase.from('customers').select('*');
    const { data: workers } = await supabase.from('workers').select('*');

    let assigned = 0;

    for (const user of users.users) {
      // Check if user is admin
      if (user.email === 'admin@example.com') {
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: user.id,
            role_id: adminRole.id,
          }, {
            onConflict: 'user_id,role_id'
          });
        if (!error) {
          console.log(`✅ Assigned admin role to ${user.email}`);
          assigned++;
        }
      }
      // Check if user is a customer owner
      else if (customers?.some(c => c.user_id === user.id)) {
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: user.id,
            role_id: customerOwnerRole.id,
          }, {
            onConflict: 'user_id,role_id'
          });
        if (!error) {
          console.log(`✅ Assigned customer_owner role to ${user.email}`);
          assigned++;
        }
      }
      // Check if user is a worker
      else if (workers?.some(w => w.user_id === user.id)) {
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: user.id,
            role_id: workerRole.id,
          }, {
            onConflict: 'user_id,role_id'
          });
        if (!error) {
          console.log(`✅ Assigned worker role to ${user.email}`);
          assigned++;
        }
      }
    }

    console.log(`\n✅ Assigned roles to ${assigned} users\n`);

    // Summary
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('*, roles(name, display_name)');

    console.log('📊 Current role assignments:');
    const roleCounts: Record<string, number> = {};
    userRoles?.forEach((ur: any) => {
      const roleName = ur.roles?.name || 'unknown';
      roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
    });

    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

assignRoles();
