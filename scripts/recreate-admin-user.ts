/**
 * Recreate admin user and ensure it's properly set up
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

async function recreateAdminUser() {
  console.log('👤 Recreating admin user...\n');

  try {
    // Check if admin user exists
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingAdmin = users?.users?.find(u => u.email === 'admin@example.com');

    let adminUserId: string;

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists, updating...');
      
      // Update the user
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingAdmin.id,
        {
          email: 'admin@example.com',
          password: 'admin123',
          email_confirm: true,
          user_metadata: {
            name: 'מנהל מערכת',
            role: 'admin',
          },
        }
      );

      if (updateError) {
        console.error('❌ Error updating admin user:', updateError.message);
        throw updateError;
      }

      adminUserId = existingAdmin.id;
      console.log('✅ Admin user updated');
    } else {
      console.log('Creating new admin user...');
      
      // Create the user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@example.com',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
          name: 'מנהל מערכת',
          role: 'admin',
        },
      });

      if (createError) {
        console.error('❌ Error creating admin user:', createError.message);
        throw createError;
      }

      if (!newUser.user) {
        console.error('❌ Failed to create admin user');
        process.exit(1);
      }

      adminUserId = newUser.user.id;
      console.log('✅ Admin user created');
    }

    // Ensure customer exists
    console.log('\nChecking customer record...');
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (!existingCustomer) {
      console.log('Creating customer record...');
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: adminUserId,
          name: 'חברת ניהול מערכת',
          description: 'חברת ניהול ראשית',
        })
        .select()
        .single();

      if (customerError) {
        console.error('❌ Error creating customer:', customerError.message);
        throw customerError;
      }
      console.log('✅ Customer record created');
    } else {
      console.log('✅ Customer record exists');
    }

    // Ensure admin role is assigned
    console.log('\nChecking admin role...');
    const { data: roles } = await supabase.from('roles').select('*').eq('name', 'admin').single();
    
    if (!roles) {
      console.error('❌ Admin role not found in database!');
      return;
    }

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', adminUserId)
      .eq('role_id', roles.id)
      .single();

    if (!existingRole) {
      console.log('Assigning admin role...');
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: adminUserId,
        role_id: roles.id,
      });

      if (roleError) {
        console.error('❌ Error assigning role:', roleError.message);
        throw roleError;
      }
      console.log('✅ Admin role assigned');
    } else {
      console.log('✅ Admin role already assigned');
    }

    // Link customer to all areas
    console.log('\nLinking customer to all areas...');
    const { data: allAreas } = await supabase.from('areas').select('*');
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', adminUserId)
      .single();

    if (customer && allAreas) {
      // Delete existing links
      await supabase.from('customer_areas').delete().eq('customer_id', customer.id);

      // Create new links
      const links = allAreas.map(a => ({
        customer_id: customer.id,
        area_id: a.id,
      }));

      const { error: linkError } = await supabase.from('customer_areas').insert(links);
      if (linkError) {
        console.error('❌ Error linking areas:', linkError.message);
      } else {
        console.log(`✅ Linked customer to ${links.length} areas`);
      }
    }

    console.log('\n✅ Admin user setup complete!\n');
    console.log('📝 Login credentials:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

recreateAdminUser();
