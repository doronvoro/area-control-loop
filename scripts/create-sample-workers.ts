/**
 * Script to create sample workers for testing
 * This creates workers linked to the admin customer
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

async function createSampleWorkers() {
  console.log('👷 Creating sample workers...\n');

  try {
    // 1. Get admin user
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === 'admin@example.com');
    
    if (!adminUser) {
      console.error('❌ Admin user not found! Run npm run create-admin first.');
      return;
    }

    // 2. Get admin customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', adminUser.id)
      .single();

    if (!customer) {
      console.error('❌ Customer record not found!');
      return;
    }

    // 3. Get worker types
    const { data: workerTypes } = await supabase
      .from('worker_types')
      .select('*');

    const inspectorType = workerTypes?.find(wt => wt.name === 'inspector');
    const actionWorkerType = workerTypes?.find(wt => wt.name === 'action_worker');

    if (!inspectorType || !actionWorkerType) {
      console.error('❌ Worker types not found!');
      return;
    }

    // 4. Create worker users
    const workers = [
      { name: 'יוסי כהן', type: 'inspector', email: 'yossi@example.com', password: 'worker123' },
      { name: 'דני לוי', type: 'action_worker', email: 'dani@example.com', password: 'worker123' },
      { name: 'שרה אברהם', type: 'inspector', email: 'sara@example.com', password: 'worker123' },
      { name: 'משה דוד', type: 'action_worker', email: 'moshe@example.com', password: 'worker123' },
    ];

    console.log('Creating worker users and records...\n');

    for (const worker of workers) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === worker.email);

      let userId: string;

      if (existingUser) {
        console.log(`⚠️  User ${worker.email} already exists, updating...`);
        userId = existingUser.id;
        await supabase.auth.admin.updateUserById(userId, {
          password: worker.password,
          user_metadata: { name: worker.name },
        });
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: worker.email,
          password: worker.password,
          email_confirm: true,
          user_metadata: { name: worker.name },
        });

        if (createError) {
          console.error(`❌ Error creating user ${worker.email}:`, createError.message);
          continue;
        }

        if (!newUser.user) {
          console.error(`❌ Failed to create user ${worker.email}`);
          continue;
        }

        userId = newUser.user.id;
        console.log(`✅ Created user: ${worker.email}`);
      }

      // Check if worker record exists
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingWorker) {
        console.log(`   Worker record already exists for ${worker.name}`);
        continue;
      }

      // Create worker record
      const typeId = worker.type === 'inspector' ? inspectorType.id : actionWorkerType.id;
      const { error: workerError } = await supabase
        .from('workers')
        .insert({
          customer_id: customer.id,
          user_id: userId,
          name: worker.name,
          type_id: typeId,
        });

      if (workerError) {
        console.error(`❌ Error creating worker record for ${worker.name}:`, workerError.message);
      } else {
        console.log(`✅ Created worker: ${worker.name} (${worker.type})`);
      }
    }

    console.log('\n✅ Sample workers created!\n');
    console.log('📋 Worker Login Credentials:');
    workers.forEach(w => {
      console.log(`   ${w.name}: ${w.email} / ${w.password}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSampleWorkers();
