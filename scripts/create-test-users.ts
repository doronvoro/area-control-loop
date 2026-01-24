/**
 * Script to create test users for all roles
 * Creates: Admin, Customer Owner, Inspector Worker, Action Worker, General Worker
 * Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-test-users
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('   Get it from: npx supabase status --output json | grep SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'customer_owner' | 'worker';
  workerType?: 'inspector' | 'action_worker' | 'general_worker';
  customerName?: string;
}

const testUsers: TestUser[] = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    name: 'מנהל מערכת',
    role: 'admin',
    customerName: 'מנהל מערכת',
  },
  {
    email: 'customer@example.com',
    password: 'customer123',
    name: 'בעל לקוח',
    role: 'customer_owner',
    customerName: 'לקוח לדוגמה',
  },
  {
    email: 'inspector@example.com',
    password: 'inspector123',
    name: 'פקח יוסי',
    role: 'worker',
    workerType: 'inspector',
  },
  {
    email: 'spray@example.com',
    password: 'spray123',
    name: 'רסס דני',
    role: 'worker',
    workerType: 'action_worker',
  },
  {
    email: 'general@example.com',
    password: 'general123',
    name: 'עובד כללי שרה',
    role: 'worker',
    workerType: 'general_worker',
  },
];

async function createTestUsers() {
  console.log('👥 Creating test users for all roles...\n');

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

    // Get worker types
    const { data: workerTypes } = await supabase.from('worker_types').select('*');
    const inspectorType = workerTypes?.find(wt => wt.name === 'inspector');
    const actionWorkerType = workerTypes?.find(wt => wt.name === 'action_worker');
    const generalWorkerType = workerTypes?.find(wt => wt.name === 'general_worker');

    // Create general_worker type if it doesn't exist
    let generalWorkerTypeId: string;
    if (!generalWorkerType) {
      const { data: newType, error: typeError } = await supabase
        .from('worker_types')
        .insert({
          name: 'general_worker',
          display_name: 'עובד כללי',
          description: 'General worker - can create both monitoring and action reports',
        })
        .select()
        .single();

      if (typeError) throw typeError;
      generalWorkerTypeId = newType.id;
      console.log('✅ Created general_worker type');
    } else {
      generalWorkerTypeId = generalWorkerType.id;
    }

    // Get admin customer (for linking workers)
    const { data: adminUsers } = await supabase.auth.admin.listUsers();
    const adminAuthUser = adminUsers?.users?.find(u => u.email === 'admin@example.com');
    let adminCustomerId: string | null = null;

    if (adminAuthUser) {
      const { data: adminCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', adminAuthUser.id)
        .single();
      adminCustomerId = adminCustomer?.id || null;
    }

    const credentials: Array<{ email: string; password: string; name: string; role: string }> = [];

    for (const user of testUsers) {
      console.log(`\n📝 Processing: ${user.name} (${user.email})`);

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      let userId: string;

      if (existingUser) {
        console.log(`   ⚠️  User already exists, updating...`);
        userId = existingUser.id;

        await supabase.auth.admin.updateUserById(userId, {
          password: user.password,
          user_metadata: {
            name: user.name,
            role: user.role,
          },
        });
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            role: user.role,
          },
        });

        if (createError) {
          console.error(`   ❌ Error creating user:`, createError.message);
          continue;
        }

        if (!newUser.user) {
          console.error(`   ❌ Failed to create user`);
          continue;
        }

        userId = newUser.user.id;
        console.log(`   ✅ Created user`);
      }

      // Assign role
      let roleId: string;
      if (user.role === 'admin') {
        roleId = adminRole.id;
      } else if (user.role === 'customer_owner') {
        roleId = customerOwnerRole.id;
      } else {
        roleId = workerRole.id;
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(
          {
            user_id: userId,
            role_id: roleId,
          },
          { onConflict: 'user_id,role_id' }
        );

      if (roleError) {
        console.error(`   ❌ Error assigning role:`, roleError.message);
      } else {
        console.log(`   ✅ Assigned ${user.role} role`);
      }

      // Create customer record for admin and customer_owner
      if (user.role === 'admin' || user.role === 'customer_owner') {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', userId)
          .single();

        let customerId: string;

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log(`   ✅ Customer record exists`);
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              user_id: userId,
              name: user.customerName || user.name,
              description: user.role === 'admin' 
                ? 'מנהל מערכת ראשי' 
                : 'לקוח לדוגמה לבדיקות',
            })
            .select()
            .single();

          if (customerError) {
            console.error(`   ❌ Error creating customer:`, customerError.message);
            continue;
          }

          customerId = newCustomer.id;
          console.log(`   ✅ Created customer record`);

          // Link customer to all areas (for admin)
          if (user.role === 'admin') {
            const { data: areas } = await supabase.from('areas').select('id');
            if (areas && areas.length > 0) {
              const links = areas.map(a => ({
                customer_id: customerId,
                area_id: a.id,
              }));

              await supabase.from('customer_areas').insert(links);
              console.log(`   ✅ Linked to ${areas.length} areas`);
            }
          }
        }

        // Store customer ID for worker linking
        if (user.role === 'admin') {
          adminCustomerId = customerId;
        }
      }

      // Create worker record for workers
      if (user.role === 'worker' && user.workerType) {
        const { data: existingWorker } = await supabase
          .from('workers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (existingWorker) {
          // Update worker type if needed
          let typeId: string;
          if (user.workerType === 'inspector') {
            typeId = inspectorType!.id;
          } else if (user.workerType === 'action_worker') {
            typeId = actionWorkerType!.id;
          } else {
            typeId = generalWorkerTypeId;
          }

          await supabase
            .from('workers')
            .update({ type_id: typeId })
            .eq('id', existingWorker.id);

          console.log(`   ✅ Updated worker record`);
        } else {
          // Get customer ID (use admin customer if available, otherwise create one)
          let customerId = adminCustomerId;
          if (!customerId) {
            // Get first customer or create one
            const { data: customers } = await supabase.from('customers').select('id').limit(1);
            if (customers && customers.length > 0) {
              customerId = customers[0].id;
            } else {
              // Create a default customer for workers
              const { data: newCustomer } = await supabase
                .from('customers')
                .insert({
                  user_id: adminAuthUser?.id || userId,
                  name: 'לקוח ברירת מחדל',
                  description: 'לקוח לבדיקות',
                })
                .select()
                .single();
              customerId = newCustomer?.id;
            }
          }

          let typeId: string;
          if (user.workerType === 'inspector') {
            typeId = inspectorType!.id;
          } else if (user.workerType === 'action_worker') {
            typeId = actionWorkerType!.id;
          } else {
            typeId = generalWorkerTypeId;
          }

          const { error: workerError } = await supabase.from('workers').insert({
            customer_id: customerId!,
            user_id: userId,
            name: user.name,
            type_id: typeId,
          });

          if (workerError) {
            console.error(`   ❌ Error creating worker:`, workerError.message);
          } else {
            console.log(`   ✅ Created worker record (${user.workerType})`);
          }
        }
      }

      credentials.push({
        email: user.email,
        password: user.password,
        name: user.name,
        role: user.role + (user.workerType ? ` (${user.workerType})` : ''),
      });
    }

    console.log('\n\n✅ All test users created!\n');
    console.log('📋 Login Credentials:\n');
    console.log('═'.repeat(60));
    credentials.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   Email: ${c.email}`);
      console.log(`   Password: ${c.password}`);
      console.log(`   Role: ${c.role}`);
      console.log('');
    });
    console.log('═'.repeat(60));
    console.log('\n🔗 Login at: http://localhost:3000/login\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestUsers();
