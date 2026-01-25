/**
 * Verify data in database
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

async function verifyData() {
  console.log('🔍 Verifying database data...\n');

  try {
    // Check auth users
    const { data: users } = await supabase.auth.admin.listUsers();
    console.log(`✅ Auth users: ${users?.users?.length || 0}`);
    users?.users?.forEach(u => {
      console.log(`   - ${u.email} (${u.user_metadata?.name || 'no name'})`);
    });

    // Check customers
    const { data: customers, error: custError } = await supabase.from('customers').select('*');
    if (custError) {
      console.log(`\n❌ Error querying customers: ${custError.message}`);
    } else {
      console.log(`\n✅ Customers: ${customers?.length || 0}`);
      customers?.forEach(c => {
        const userEmail = users?.users?.find(u => u.id === c.user_id)?.email || c.user_id;
        console.log(`   - ${c.name} (user: ${userEmail})`);
      });
    }

    // Check workers
    const { data: workers, error: workError } = await supabase.from('workers').select('*, customer:customers(name), worker_type:worker_types(name)');
    if (workError) {
      console.log(`\n❌ Error querying workers: ${workError.message}`);
    } else {
      console.log(`\n✅ Workers: ${workers?.length || 0}`);
      workers?.forEach(w => {
        const userEmail = users?.users?.find(u => u.id === w.user_id)?.email || w.user_id;
        console.log(`   - ${w.name} (${(w as any).worker_type?.name || 'no type'}) - Customer: ${(w as any).customer?.name || 'no customer'} - User: ${userEmail}`);
      });
    }

    // Check areas
    const { data: areas } = await supabase.from('areas').select('*');
    console.log(`\n✅ Areas: ${areas?.length || 0}`);
    areas?.forEach(a => {
      console.log(`   - ${a.name}`);
    });

    // Check customer_areas
    const { data: customerAreas } = await supabase.from('customer_areas').select('*, customer:customers(name), area:areas(name)');
    console.log(`\n✅ Customer-Area links: ${customerAreas?.length || 0}`);
    customerAreas?.forEach(ca => {
      console.log(`   - ${(ca as any).customer?.name} -> ${(ca as any).area?.name}`);
    });

    // Check sub_areas
    const { data: subAreas } = await supabase.from('sub_areas').select('*, area:areas(name)');
    console.log(`\n✅ Sub-areas: ${subAreas?.length || 0}`);
    subAreas?.slice(0, 5).forEach(sa => {
      console.log(`   - ${sa.name} (Area: ${(sa as any).area?.name})`);
    });
    if (subAreas && subAreas.length > 5) {
      console.log(`   ... and ${subAreas.length - 5} more`);
    }

    // Check report_areas
    const { data: reportAreas } = await supabase.from('report_areas').select('*, area:areas(name)');
    console.log(`\n✅ Report areas: ${reportAreas?.length || 0}`);
    reportAreas?.slice(0, 5).forEach(ra => {
      console.log(`   - ${ra.name} (${ra.type}) - Area: ${(ra as any).area?.name}`);
    });
    if (reportAreas && reportAreas.length > 5) {
      console.log(`   ... and ${reportAreas.length - 5} more`);
    }

    // Check monitoring reports
    const { data: monitoringReports } = await supabase.from('monitoring_area_report').select('*');
    console.log(`\n✅ Monitoring reports: ${monitoringReports?.length || 0}`);

    // Check action reports
    const { data: actionReports } = await supabase.from('actions_area_report').select('*');
    console.log(`\n✅ Action reports: ${actionReports?.length || 0}`);

    // Check user roles
    const { data: userRoles, error: urError } = await supabase.from('user_roles').select('*, role:roles(name)');
    if (urError) {
      console.log(`\n❌ Error querying user roles: ${urError.message}`);
    } else {
      console.log(`\n✅ User roles: ${userRoles?.length || 0}`);
      userRoles?.forEach(ur => {
        const userEmail = users?.users?.find(u => u.id === ur.user_id)?.email || ur.user_id;
        console.log(`   - ${userEmail} -> ${(ur as any).role?.name}`);
      });
    }

    console.log('\n✅ Verification complete!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

verifyData();
