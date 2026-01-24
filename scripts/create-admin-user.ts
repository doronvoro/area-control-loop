/**
 * Script to create a default admin user
 * Run with: npx tsx scripts/create-admin-user.ts
 * 
 * This creates:
 * - An admin user in Supabase Auth
 * - A customer record linked to this admin user
 * - Links the customer to all available areas
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Default admin credentials
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'מנהל מערכת';

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

async function createAdminUser() {
  console.log('🔐 Creating default admin user...\n');

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

    let userId: string;

    if (existingUser) {
      console.log(`⚠️  User ${ADMIN_EMAIL} already exists.`);
      console.log('   Updating password and metadata...\n');
      userId = existingUser.id;

      // Update password
      await supabase.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        user_metadata: {
          name: ADMIN_NAME,
          role: 'admin',
        },
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: ADMIN_NAME,
          role: 'admin',
        },
      });

      if (createError) throw createError;
      if (!newUser.user) throw new Error('Failed to create user');

      userId = newUser.user.id;
      console.log(`✅ Created admin user: ${ADMIN_EMAIL}`);
    }

    // Create or update customer record
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .single();

    let customerId: string;

    if (existingCustomer) {
      console.log('   Customer record already exists.');
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: userId,
          name: 'מנהל מערכת',
          description: 'מנהל מערכת ראשי - יכול להזמין לקוחות חדשים',
        })
        .select()
        .single();

      if (customerError) throw customerError;
      if (!newCustomer) throw new Error('Failed to create customer');

      customerId = newCustomer.id;
      console.log('✅ Created customer record for admin');
    }

    // Link customer to all areas
    const { data: areas } = await supabase.from('areas').select('id');
    
    if (areas && areas.length > 0) {
      // Get existing customer-area links
      const { data: existingLinks } = await supabase
        .from('customer_areas')
        .select('area_id')
        .eq('customer_id', customerId);

      const existingAreaIds = new Set(existingLinks?.map(l => l.area_id) || []);
      const newLinks = areas
        .filter(a => !existingAreaIds.has(a.id))
        .map(a => ({
          customer_id: customerId,
          area_id: a.id,
        }));

      if (newLinks.length > 0) {
        const { error: linkError } = await supabase
          .from('customer_areas')
          .insert(newLinks);

        if (linkError) throw linkError;
        console.log(`✅ Linked admin customer to ${newLinks.length} areas`);
      } else {
        console.log('   Customer already linked to all areas');
      }
    }

    console.log('\n✅ Admin user setup completed!\n');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Name: ${ADMIN_NAME}\n`);
    console.log('🔗 Login at: http://localhost:3000/login\n');

  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
