/**
 * Create several demo customers with deliberately different data.
 *
 * Built for testing the admin customer switcher: with every tenant looking the
 * same you cannot tell whether switching worked, so these differ in the things
 * the UI actually shows — number of areas, crops, sizes, sub-area depth, worker
 * counts, and one tenant with no areas at all.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run seed-demo-customers
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run seed-demo-customers -- --clean
 *
 * --clean removes everything this script created (matched by the marker below)
 * and exits. Use it to reset between test runs.
 *
 * LOCAL ONLY. It refuses to run against a non-local Supabase URL unless
 * --i-know-this-is-not-local is passed, because it creates login accounts with
 * a hardcoded weak password. The importer in this repo defaults to local Docker
 * and that has already caused one near-miss, so this one checks rather than
 * assumes.
 *
 * Re-runnable: every customer is matched by name, so running twice updates
 * rather than duplicating.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const args = process.argv.slice(2);
const clean = args.includes('--clean');
const allowRemote = args.includes('--i-know-this-is-not-local');

/** Stamped on every row this script creates, so --clean can find them again. */
const MARKER = 'נתוני הדגמה — seed-demo-customers';
const DEMO_PASSWORD = 'demo123456';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('   Get it from: supabase status');
  process.exit(1);
}

const isLocal = /(127\.0\.0\.1|localhost)/.test(supabaseUrl);
if (!isLocal && !allowRemote) {
  console.error(`❌ Refusing to run against ${supabaseUrl}`);
  console.error('   This creates accounts with a hardcoded password and is meant for local use.');
  console.error('   Pass --i-know-this-is-not-local only if you are certain.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface DemoArea {
  name: string;
  crop: string;
  size: number;
  areaType: 'outdoor' | 'indoor';
  variety?: string;
  subAreas?: string[];
}

interface DemoCustomer {
  name: string;
  email: string;
  /** ASCII stem for generated worker logins — Hebrew names cannot be emails. */
  slug: string;
  description: string;
  areas: DemoArea[];
  workers: { name: string; type: string }[];
}

/**
 * Deliberately uneven. A switcher that silently fails is easiest to spot when
 * the tenants differ in size and shape rather than in name only.
 */
const CUSTOMERS: DemoCustomer[] = [
  {
    name: 'מטע הגליל (הדגמה)',
    email: 'demo_galil@test.local',
    slug: 'galil',
    description: 'מטע גדול — מספר גידולים ותת-שטחים',
    areas: [
      {
        name: 'חלקת תפוח צפון',
        crop: 'תפוח',
        size: 42.5,
        areaType: 'outdoor',
        variety: 'גאלה',
        subAreas: ['שורות 1-10', 'שורות 11-20', 'שורות 21-30'],
      },
      {
        name: 'חלקת אפרסק מזרח',
        crop: 'אפרסק',
        size: 18.25,
        areaType: 'outdoor',
        variety: 'רד היבן',
        subAreas: ['גוש א', 'גוש ב'],
      },
      { name: 'כרם ענבים', crop: 'ענבים', size: 30, areaType: 'outdoor', variety: 'סופיריור' },
      { name: 'חממת עגבניות', crop: 'עגבנייה', size: 3.4, areaType: 'indoor' },
    ],
    workers: [
      { name: 'יוסי מנטר', type: 'inspector' },
      { name: 'דנה מרססת', type: 'action_worker' },
      { name: 'אבי רב-תכליתי', type: 'super_worker' },
    ],
  },
  {
    name: 'משק שדות (הדגמה)',
    email: 'demo_sadot@test.local',
    slug: 'sadot',
    description: 'משק בינוני — גידול אחד',
    areas: [
      {
        name: 'מטע שזיפים',
        crop: 'שזיף',
        size: 12.8,
        areaType: 'outdoor',
        variety: 'בלאק אמבר',
        subAreas: ['צד מערבי', 'צד מזרחי'],
      },
      { name: 'מטע רימונים', crop: 'רימון', size: 7.2, areaType: 'outdoor', variety: 'ווندרפול' },
    ],
    workers: [{ name: 'רונית מנטרת', type: 'inspector' }],
  },
  {
    name: 'חוות תמרים (הדגמה)',
    email: 'demo_tmarim@test.local',
    slug: 'tmarim',
    description: 'חווה קטנה — שטח בודד',
    areas: [{ name: 'מטע תמרים', crop: 'תמר', size: 55, areaType: 'outdoor', variety: 'מג׳הול' }],
    workers: [
      { name: 'משה מנטר', type: 'inspector' },
      { name: 'שרה מרססת', type: 'action_worker' },
    ],
  },
  {
    name: 'לקוח חדש ללא שטחים (הדגמה)',
    email: 'demo_empty@test.local',
    slug: 'empty',
    description: 'לקוח שזה עתה נוצר — בלי שטחים. בודק את מצב הריק.',
    // Deliberately empty: this is the state right after creating a customer,
    // and it is the one the switcher is most likely to render wrongly — an
    // empty tenant and "no tenant selected" must not look identical.
    areas: [],
    workers: [],
  },
];

async function removeDemoData() {
  console.log('🧹 Removing demo data...\n');

  const { data: customers } = await supabase.from('customers').select('id, name, user_id');
  const demo = (customers || []).filter((c: { name: string }) => c.name.includes('(הדגמה)'));

  for (const c of demo) {
    // areas cascade to customer_areas, sub_areas and report_areas.
    const { data: links } = await supabase
      .from('customer_areas')
      .select('area_id')
      .eq('customer_id', c.id);
    const areaIds = (links || []).map((l: { area_id: string }) => l.area_id);

    if (areaIds.length > 0) {
      await supabase.from('report_areas').delete().in('area_id', areaIds);
      await supabase.from('areas').delete().in('id', areaIds);
    }

    await supabase.from('workers').delete().eq('customer_id', c.id);
    await supabase.from('customers').delete().eq('id', c.id);

    if (c.user_id) await supabase.auth.admin.deleteUser(c.user_id);
    console.log(`   removed ${c.name} (${areaIds.length} areas)`);
  }

  // Worker logins are separate auth users and are not reached by the loop above.
  const { data: users } = await supabase.auth.admin.listUsers();
  for (const u of users?.users || []) {
    if (u.email?.startsWith('demo_') && u.email.endsWith('@test.local')) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }

  console.log(`\n✅ Removed ${demo.length} demo customer(s).`);
}

/** Create the auth user, or reuse and reset the password if the email exists. */
async function upsertAuthUser(email: string, name: string): Promise<string> {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    await supabase.auth.admin.updateUserById(found.id, {
      password: DEMO_PASSWORD,
      user_metadata: { name },
    });
    return found.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user!.id;
}

async function attachRole(userId: string, roleName: string) {
  const { data: role, error } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();

  // Checked rather than ignored: a user with no role can log in and can do
  // nothing, which looks like a broken app rather than a broken seed.
  if (error || !role) throw new Error(`role "${roleName}" not found — has migration 006 run?`);

  const { data: already } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role_id', role.id)
    .maybeSingle();

  if (!already) {
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: role.id });
    if (insertError) throw insertError;
  }
}

async function main() {
  console.log(`🎯 Target: ${supabaseUrl}${isLocal ? ' (local)' : ' ⚠️  NOT LOCAL'}\n`);

  if (clean) {
    await removeDemoData();
    return;
  }

  const { data: crops } = await supabase.from('crops').select('id, name');
  const cropByName = new Map(
    (crops || []).map((c: { name: string; id: string }) => [c.name, c.id])
  );

  const { data: workerTypes } = await supabase.from('worker_types').select('id, name');
  const typeByName = new Map(
    (workerTypes || []).map((t: { name: string; id: string }) => [t.name, t.id])
  );

  for (const demo of CUSTOMERS) {
    console.log(`👤 ${demo.name}`);

    const userId = await upsertAuthUser(demo.email, demo.name);
    await attachRole(userId, 'customer_owner');

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('name', demo.name)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabase
        .from('customers')
        .update({ user_id: userId, description: demo.description })
        .eq('id', customerId);
      console.log('   customer exists — updated');
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert({ user_id: userId, name: demo.name, description: demo.description })
        .select('id')
        .single();
      if (error) throw error;
      customerId = data.id;
      console.log('   customer created');
    }

    for (const area of demo.areas) {
      const cropId = cropByName.get(area.crop);
      if (!cropId) {
        console.log(`   ⚠️  no crop "${area.crop}" — area "${area.name}" skipped`);
        continue;
      }

      // Matched by name so a re-run does not duplicate areas.
      const { data: existingArea } = await supabase
        .from('areas')
        .select('id')
        .eq('name', area.name)
        .maybeSingle();

      let areaId: string;
      if (existingArea) {
        areaId = existingArea.id;
      } else {
        const { data, error } = await supabase
          .from('areas')
          .insert({
            name: area.name,
            description: MARKER,
            crop_id: cropId,
            size: area.size,
            size_unit_type: 'dunam',
            area_type: area.areaType,
            variety: area.variety || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        areaId = data.id;
      }

      const { data: link } = await supabase
        .from('customer_areas')
        .select('id')
        .eq('customer_id', customerId)
        .eq('area_id', areaId)
        .maybeSingle();
      if (!link) {
        await supabase.from('customer_areas').insert({ customer_id: customerId, area_id: areaId });
      }

      for (const subName of area.subAreas || []) {
        const { data: existingSub } = await supabase
          .from('sub_areas')
          .select('id')
          .eq('area_id', areaId)
          .eq('name', subName)
          .maybeSingle();
        if (!existingSub) {
          await supabase.from('sub_areas').insert({
            area_id: areaId,
            name: subName,
            level: 1,
            crop_id: cropId,
            display: `${area.name} / ${subName}`,
          });
        }
      }
    }

    for (const worker of demo.workers) {
      const typeId = typeByName.get(worker.type);
      if (!typeId) {
        console.log(`   ⚠️  no worker type "${worker.type}" — ${worker.name} skipped`);
        continue;
      }

      // Built from an ASCII slug and an index, never from the display name:
      // GoTrue rejects a Hebrew local part with "invalid format".
      const workerIndex = demo.workers.indexOf(worker) + 1;
      const workerEmail = `demo_${demo.slug}_w${workerIndex}@test.local`;
      const workerUserId = await upsertAuthUser(workerEmail, worker.name);
      await attachRole(workerUserId, 'worker');

      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id')
        .eq('customer_id', customerId)
        .eq('name', worker.name)
        .maybeSingle();

      if (!existingWorker) {
        await supabase.from('workers').insert({
          customer_id: customerId,
          user_id: workerUserId,
          name: worker.name,
          type_id: typeId,
        });
      }
    }

    console.log(`   ${demo.areas.length} area(s), ${demo.workers.length} worker(s)\n`);
  }

  console.log('✅ Done.\n');
  console.log('📋 Logins (all password: ' + DEMO_PASSWORD + ')');
  for (const c of CUSTOMERS) {
    console.log(`   ${c.email.padEnd(28)} ${c.name}`);
  }
  console.log(
    '\n💡 Log in as an admin to see the switcher; these accounts see only their own data.'
  );
  console.log('   Remove everything with: npm run seed-demo-customers -- --clean');
}

main().catch((error) => {
  console.error('❌', error.message || error);
  process.exit(1);
});
