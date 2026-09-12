/**
 * Create an admin user.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run create-admin
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run create-admin -- --email me@example.com
 *
 * Creates the auth user and — the part that actually makes them an admin —
 * inserts the row in `user_roles`. `is_admin_user()` and `has_role()` read ONLY
 * that table; `user_metadata.role` is read by zero authorization paths and is
 * written here purely because the rest of the codebase still writes it.
 *
 * Until this was fixed the script set the metadata and skipped `user_roles`, so
 * it produced a user who was NOT an admin: every /admin/* page redirected them
 * to /dashboard.
 *
 * It also used to create a `customers` row for the admin and link it to every
 * area in the database. That made "admin" mean "a customer who owns
 * everything", which breaks every tenancy question asked of this schema — and
 * it hid the real bug, because the all-areas link made admin screens look like
 * they worked. A real admin owns nothing; their access comes from the role.
 *
 * This does not load .env.local (nothing in scripts/ does) and defaults to local
 * Docker, so the service key must be on the command line. For production, prefer
 * docs/rollout/07-promote-admin.sql — promoting an existing user needs no key.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const emailFlag = process.argv.indexOf('--email');
const ADMIN_EMAIL = emailFlag > -1 ? process.argv[emailFlag + 1] : 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'מנהל מערכת';

if (emailFlag > -1 && !ADMIN_EMAIL) {
  console.error('❌ --email needs a value.');
  process.exit(1);
}

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

    // The role row. THIS is what makes them an admin — is_admin_user() and
    // has_role() read user_roles and nothing else.
    const { data: adminRole, error: roleLookupError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single();

    if (roleLookupError || !adminRole) {
      throw new Error(
        'No role named "admin" exists. Migration 006_roles_and_permissions.sql has not run ' +
          'on this database — creating the auth user without it would produce a non-admin.'
      );
    }

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role_id', (adminRole as any).id)
      .maybeSingle();

    if (existingRole) {
      console.log('   Admin role already attached.');
    } else {
      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: (adminRole as any).id } as any);

      // Checked, not ignored: a silent failure here is exactly the bug this
      // script used to ship — a user who looks like an admin and is not one.
      if (roleInsertError) throw roleInsertError;
      console.log('✅ Attached the admin role');
    }

    // Prove it rather than assume it, using the same function the app calls.
    const { data: isAdminNow } = await (supabase.rpc as any)('has_role', {
      p_user_id: userId,
      p_role_name: 'admin',
    });
    if (isAdminNow !== true) {
      throw new Error('has_role() still reports false for this user — the promotion did not take.');
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
