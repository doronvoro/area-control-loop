/**
 * Complete database seeding script
 * Deletes all existing data and seeds all tables with comprehensive test data
 * Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed-all-tables.ts
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

// Store created IDs for relationships
let createdIds: {
  workerTypes: Map<string, string>;
  actionTypes: Map<string, string>;
  unitTypes: Map<string, string>;
  findings: Map<string, string>;
  materials: Map<string, string>;
  crops: Map<string, string>;
  areas: Map<string, string>;
  subAreas: string[];
  reportAreas: { id: string; areaId: string; type: string }[];
  customers: Map<string, string>;
  workers: Map<string, string>;
  authUsers: Map<string, string>;
  roles: Map<string, string>;
} = {
  workerTypes: new Map(),
  actionTypes: new Map(),
  unitTypes: new Map(),
  findings: new Map(),
  materials: new Map(),
  crops: new Map(),
  areas: new Map(),
  subAreas: [],
  reportAreas: [],
  customers: new Map(),
  workers: new Map(),
  authUsers: new Map(),
  roles: new Map(),
};

/**
 * Delete all data from all tables in reverse dependency order
 */
async function deleteAllData() {
  console.log('🗑️  Deleting all existing data...\n');

  try {
    // Delete in reverse dependency order
    const tables = [
      'monitoring_area_report',
      'actions_area_report',
      'recommend_material',
      'invitations',
      'user_roles',
      'customer_areas',
      'sub_areas',
      'report_areas',
      'workers',
      'customers',
      'findings',
      'action_types',
      'unit_types',
      'worker_types',
      'areas',
      // These tables might not exist if migration hasn't been run
      'materials',
      'crops',
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && !error.message.includes('does not exist')) {
        console.log(`   ⚠️  Error deleting from ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ Deleted from ${table}`);
      }
    }

    // Delete auth users (except system users)
    const { data: users } = await supabase.auth.admin.listUsers();
    if (users?.users) {
      for (const user of users.users) {
        // Skip service role and anon users
        if (user.email && !user.email.includes('@supabase') && user.email !== 'service_role@supabase.local') {
          await supabase.auth.admin.deleteUser(user.id);
        }
      }
      console.log(`   ✅ Deleted auth users`);
    }

    console.log('   ✅ All data deleted\n');
  } catch (error: any) {
    console.error('   ❌ Error deleting data:', error.message);
    throw error;
  }
}

/**
 * Seed lookup tables (worker_types, action_types, unit_types, findings, materials, crops)
 */
async function seedLookupTables() {
  console.log('📋 Seeding lookup tables...\n');

  try {
    // 1. Worker Types
    console.log('1. Seeding worker_types...');
    const workerTypes = [
      { name: 'inspector', display_name: 'פקח', description: 'עובד ניטור ופיקוח' },
      { name: 'action_worker', display_name: 'רסס', description: 'עובד ביצוע פעולות' },
    ];

    const { data: insertedWorkerTypes, error: wtError } = await supabase
      .from('worker_types')
      .upsert(workerTypes, { onConflict: 'name' })
      .select();

    if (wtError) throw wtError;
    insertedWorkerTypes?.forEach(wt => createdIds.workerTypes.set(wt.name, wt.id));
    console.log(`   ✅ Seeded ${insertedWorkerTypes?.length || 0} worker types\n`);

    // 2. Action Types
    console.log('2. Seeding action_types...');
    const actionTypes = [
      { name: 'spray', description: 'ריסוס' },
      { name: 'prune', description: 'גיזום' },
      { name: 'treat', description: 'טיפול' },
      { name: 'fertilize', description: 'דישון' },
      { name: 'biological_control', description: 'הדברה ביולוגית' },
      { name: 'foliar_spray', description: 'ריסוס עלוותי' },
      { name: 'systemic_treatment', description: 'טיפול מערכתי' },
      { name: 'preventive_spray', description: 'ריסוס מניעתי' },
    ];

    const { data: insertedActionTypes, error: atError } = await supabase
      .from('action_types')
      .insert(actionTypes)
      .select();

    if (atError) throw atError;
    insertedActionTypes?.forEach(at => createdIds.actionTypes.set(at.name, at.id));
    console.log(`   ✅ Seeded ${insertedActionTypes?.length || 0} action types\n`);

    // 3. Unit Types
    console.log('3. Seeding unit_types...');
    const unitTypes = [
      { name: 'ml', description: 'מיליליטר' },
      { name: 'l', description: 'ליטר' },
      { name: 'kg', description: 'קילוגרם' },
      { name: 'g', description: 'גרם' },
      { name: 'mg', description: 'מיליגרם' },
      { name: 'ppm', description: 'חלקים למיליון' },
      { name: 'percentage', description: 'אחוז' },
      { name: 'dose_per_plant', description: 'מינון לצמח' },
    ];

    const { data: insertedUnitTypes, error: utError } = await supabase
      .from('unit_types')
      .insert(unitTypes)
      .select();

    if (utError) throw utError;
    insertedUnitTypes?.forEach(ut => createdIds.unitTypes.set(ut.name, ut.id));
    console.log(`   ✅ Seeded ${insertedUnitTypes?.length || 0} unit types\n`);

    // 4. Findings
    console.log('4. Seeding findings...');
    const findings = [
      { name: 'pest_infestation', description: 'הדבקות מזיקים', severity: 'high' },
      { name: 'disease', description: 'מחלה', severity: 'medium' },
      { name: 'nutrient_deficiency', description: 'חוסר חומרים מזינים', severity: 'low' },
      { name: 'weed_growth', description: 'צמיחת עשבים', severity: 'low' },
      { name: 'aphids', description: 'כנימות', severity: 'high' },
      { name: 'mites', description: 'קרדיות', severity: 'medium' },
      { name: 'whitefly', description: 'כנימת עש', severity: 'high' },
      { name: 'thrips', description: 'פטריות', severity: 'medium' },
      { name: 'spider_mites', description: 'קרדיות עכביש', severity: 'high' },
      { name: 'powdery_mildew', description: 'קמחון', severity: 'medium' },
      { name: 'downy_mildew', description: 'כשותית', severity: 'high' },
      { name: 'botrytis', description: 'בוטריטיס', severity: 'high' },
    ];

    const { data: insertedFindings, error: fError } = await supabase
      .from('findings')
      .insert(findings)
      .select();

    if (fError) throw fError;
    insertedFindings?.forEach(f => createdIds.findings.set(f.name, f.id));
    console.log(`   ✅ Seeded ${insertedFindings?.length || 0} findings\n`);

    // 5. Materials
    console.log('5. Seeding materials...');
    const materials = [
      { name: 'חומר הדברה A', description: 'חומר הדברה אורגני' },
      { name: 'חומר הדברה B', description: 'חומר הדברה כימי' },
      { name: 'דשן נוזלי', description: 'דשן נוזלי מרוכז' },
      { name: 'דשן מוצק', description: 'דשן מוצק לשחרור איטי' },
      { name: 'קוטל פטריות', description: 'קוטל פטריות מערכתי' },
      { name: 'קוטל חרקים', description: 'קוטל חרקים רחב טווח' },
      { name: 'קוטל עשבים', description: 'קוטל עשבים סלקטיבי' },
      { name: 'חומר ביולוגי', description: 'חומר הדברה ביולוגי' },
      { name: 'תוסף תזונה', description: 'תוסף תזונה לצמחים' },
      { name: 'חומר מניעה', description: 'חומר מניעה למחלות' },
    ];

    const { data: insertedMaterials, error: mError } = await supabase
      .from('materials')
      .insert(materials)
      .select();

    if (mError) {
      if (mError.message.includes('does not exist') || mError.message.includes('schema cache')) {
        console.log('   ⚠️  Materials table does not exist, skipping...');
        console.log('   💡 Run migration 20260124225324_create_crops_and_recommend_material.sql first\n');
      } else {
        throw mError;
      }
    } else {
      insertedMaterials?.forEach((m, i) => createdIds.materials.set(materials[i].name, m.id));
      console.log(`   ✅ Seeded ${insertedMaterials?.length || 0} materials\n`);
    }

    // 6. Crops
    console.log('6. Seeding crops...');
    const crops = [
      { name: 'עגבנייה', description: 'עגבנייה רגילה' },
      { name: 'מלפפון', description: 'מלפפון חממה' },
      { name: 'פלפל', description: 'פלפל מתוק' },
      { name: 'חציל', description: 'חציל סגול' },
      { name: 'תות שדה', description: 'תות שדה' },
      { name: 'חסה', description: 'חסה עלים' },
      { name: 'בזיליקום', description: 'בזיליקום ירוק' },
      { name: 'פטרוזיליה', description: 'פטרוזיליה' },
    ];

    const { data: insertedCrops, error: cError } = await supabase
      .from('crops')
      .insert(crops)
      .select();

    if (cError) {
      if (cError.message.includes('does not exist') || cError.message.includes('schema cache')) {
        console.log('   ⚠️  Crops table does not exist, skipping...');
        console.log('   💡 Run migration 20260124225324_create_crops_and_recommend_material.sql first\n');
      } else {
        throw cError;
      }
    } else {
      insertedCrops?.forEach((c, i) => createdIds.crops.set(crops[i].name, c.id));
      console.log(`   ✅ Seeded ${insertedCrops?.length || 0} crops\n`);
    }

    console.log('✅ Lookup tables seeded\n');
  } catch (error: any) {
    console.error('❌ Error seeding lookup tables:', error.message);
    throw error;
  }
}

/**
 * Seed areas
 */
async function seedAreas() {
  console.log('🌍 Seeding areas...\n');

  try {
    const areas = [
      { name: 'אזור צפון', description: 'אזור גידול בצפון הארץ' },
      { name: 'אזור מרכז', description: 'אזור גידול במרכז הארץ' },
      { name: 'אזור דרום', description: 'אזור גידול בדרום הארץ' },
      { name: 'אזור עמק', description: 'אזור גידול בעמק' },
      { name: 'אזור הר', description: 'אזור גידול בהרים' },
      { name: 'אזור גולן', description: 'אזור גידול בגולן' },
      { name: 'אזור הגליל', description: 'אזור גידול בגליל' },
      { name: 'אזור הנגב', description: 'אזור גידול בנגב' },
    ];

    const { data: insertedAreas, error } = await supabase
      .from('areas')
      .insert(areas)
      .select();

    if (error) throw error;
    insertedAreas?.forEach((a, i) => createdIds.areas.set(areas[i].name, a.id));
    console.log(`   ✅ Seeded ${insertedAreas?.length || 0} areas\n`);
  } catch (error: any) {
    console.error('❌ Error seeding areas:', error.message);
    throw error;
  }
}

/**
 * Create auth users
 */
async function createAuthUsers() {
  console.log('👥 Creating auth users...\n');

  try {
    // Get roles
    const { data: roles } = await supabase.from('roles').select('*');
    if (roles) {
      roles.forEach(r => createdIds.roles.set(r.name, r.id));
    }

    const users = [
      // Admin
      { email: 'admin@example.com', password: 'admin123', name: 'מנהל מערכת', role: 'admin' },
      // Customer Owners
      { email: 'customer1@example.com', password: 'customer123', name: 'בעל לקוח 1', role: 'customer_owner' },
      { email: 'customer2@example.com', password: 'customer123', name: 'בעל לקוח 2', role: 'customer_owner' },
      // Workers - Inspectors
      { email: 'inspector1@example.com', password: 'inspector123', name: 'פקח יוסי', role: 'worker', workerType: 'inspector' },
      { email: 'inspector2@example.com', password: 'inspector123', name: 'פקח רותם', role: 'worker', workerType: 'inspector' },
      { email: 'inspector3@example.com', password: 'inspector123', name: 'פקח מיכל', role: 'worker', workerType: 'inspector' },
      // Workers - Action Workers
      { email: 'spray1@example.com', password: 'spray123', name: 'רסס דני', role: 'worker', workerType: 'action_worker' },
      { email: 'spray2@example.com', password: 'spray123', name: 'רסס אלון', role: 'worker', workerType: 'action_worker' },
      { email: 'spray3@example.com', password: 'spray123', name: 'רסס תומר', role: 'worker', workerType: 'action_worker' },
    ];

    for (const user of users) {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
        },
      });

      if (error) {
        console.log(`   ⚠️  Error creating user ${user.email}: ${error.message}`);
        continue;
      }

      if (newUser.user) {
        createdIds.authUsers.set(user.email, newUser.user.id);
        console.log(`   ✅ Created user: ${user.name} (${user.email})`);
      }
    }

    console.log(`\n   ✅ Created ${createdIds.authUsers.size} auth users\n`);
  } catch (error: any) {
    console.error('❌ Error creating auth users:', error.message);
    throw error;
  }
}

/**
 * Seed customers and workers
 */
async function seedCustomersAndWorkers() {
  console.log('🏢 Seeding customers and workers...\n');

  try {
    // Create customers
    const customers = [
      {
        user_id: createdIds.authUsers.get('admin@example.com')!,
        name: 'חברת ניהול מערכת',
        description: 'חברת ניהול ראשית',
      },
      {
        user_id: createdIds.authUsers.get('customer1@example.com')!,
        name: 'חברת גידול צפון',
        description: 'חברת גידול באזור הצפון',
      },
      {
        user_id: createdIds.authUsers.get('customer2@example.com')!,
        name: 'חברת גידול דרום',
        description: 'חברת גידול באזור הדרום',
      },
    ];

    const { data: insertedCustomers, error: cError } = await supabase
      .from('customers')
      .insert(customers)
      .select();

    if (cError) throw cError;
    insertedCustomers?.forEach((c, i) => {
      const email = i === 0 ? 'admin@example.com' : i === 1 ? 'customer1@example.com' : 'customer2@example.com';
      createdIds.customers.set(email, c.id);
    });
    console.log(`   ✅ Created ${insertedCustomers?.length || 0} customers\n`);

    // Create workers
    const adminCustomerId = createdIds.customers.get('admin@example.com')!;
    const customer1Id = createdIds.customers.get('customer1@example.com')!;
    const customer2Id = createdIds.customers.get('customer2@example.com')!;

    const workers = [
      {
        customer_id: adminCustomerId,
        user_id: createdIds.authUsers.get('inspector1@example.com')!,
        name: 'פקח יוסי',
        type_id: createdIds.workerTypes.get('inspector')!,
      },
      {
        customer_id: adminCustomerId,
        user_id: createdIds.authUsers.get('inspector2@example.com')!,
        name: 'פקח רותם',
        type_id: createdIds.workerTypes.get('inspector')!,
      },
      {
        customer_id: customer1Id,
        user_id: createdIds.authUsers.get('inspector3@example.com')!,
        name: 'פקח מיכל',
        type_id: createdIds.workerTypes.get('inspector')!,
      },
      {
        customer_id: adminCustomerId,
        user_id: createdIds.authUsers.get('spray1@example.com')!,
        name: 'רסס דני',
        type_id: createdIds.workerTypes.get('action_worker')!,
      },
      {
        customer_id: customer1Id,
        user_id: createdIds.authUsers.get('spray2@example.com')!,
        name: 'רסס אלון',
        type_id: createdIds.workerTypes.get('action_worker')!,
      },
      {
        customer_id: customer2Id,
        user_id: createdIds.authUsers.get('spray3@example.com')!,
        name: 'רסס תומר',
        type_id: createdIds.workerTypes.get('action_worker')!,
      },
    ];

    const { data: insertedWorkers, error: wError } = await supabase
      .from('workers')
      .insert(workers)
      .select();

    if (wError) throw wError;
    insertedWorkers?.forEach((w, i) => {
      const email = i === 0 ? 'inspector1@example.com' : 
                   i === 1 ? 'inspector2@example.com' :
                   i === 2 ? 'inspector3@example.com' :
                   i === 3 ? 'spray1@example.com' :
                   i === 4 ? 'spray2@example.com' : 'spray3@example.com';
      createdIds.workers.set(email, w.id);
    });
    console.log(`   ✅ Created ${insertedWorkers?.length || 0} workers\n`);
  } catch (error: any) {
    console.error('❌ Error seeding customers and workers:', error.message);
    throw error;
  }
}

/**
 * Seed area relationships (customer_areas, sub_areas, report_areas)
 */
async function seedAreaRelationships() {
  console.log('🔗 Seeding area relationships...\n');

  try {
    // 1. Customer Areas - Link customers to areas
    console.log('1. Linking customers to areas...');
    const customerAreas: any[] = [];
    const adminCustomerId = createdIds.customers.get('admin@example.com')!;
    const customer1Id = createdIds.customers.get('customer1@example.com')!;
    const customer2Id = createdIds.customers.get('customer2@example.com')!;

    // Admin gets all areas
    for (const areaId of createdIds.areas.values()) {
      customerAreas.push({ customer_id: adminCustomerId, area_id: areaId });
    }

    // Customer 1 gets first 4 areas
    let count = 0;
    for (const areaId of createdIds.areas.values()) {
      if (count < 4) {
        customerAreas.push({ customer_id: customer1Id, area_id: areaId });
        count++;
      }
    }

    // Customer 2 gets last 4 areas
    const areaIdsArray = Array.from(createdIds.areas.values());
    for (let i = areaIdsArray.length - 4; i < areaIdsArray.length; i++) {
      if (i >= 0) {
        customerAreas.push({ customer_id: customer2Id, area_id: areaIdsArray[i] });
      }
    }

    const { error: caError } = await supabase.from('customer_areas').insert(customerAreas);
    if (caError) throw caError;
    console.log(`   ✅ Linked ${customerAreas.length} customer-area relationships\n`);

    // 2. Sub Areas - Create hierarchical sub-areas
    console.log('2. Creating sub-areas...');
    const subAreasToInsert: any[] = [];
    const subAreaMap = new Map<string, string>(); // Map area name -> sub area IDs

    for (const [areaName, areaId] of createdIds.areas.entries()) {
      const firstLevelSubAreas: any[] = [];
      
      // Create 3-4 first level sub-areas per area
      for (let i = 0; i < 3; i++) {
        const subArea = {
          area_id: areaId,
          parent_sub_area_id: null,
          level: 1,
          name: `תת-אזור ${areaName} ${i + 1}`,
          variety: `זן ${String.fromCharCode(65 + i)}`,
          rows: `${i * 10 + 1}-${(i + 1) * 10}`,
          display: `${i * 10 + 1}-${(i + 1) * 10} | זן ${String.fromCharCode(65 + i)}`,
        };
        firstLevelSubAreas.push(subArea);
      }

      const { data: insertedFirstLevel, error: saError } = await supabase
        .from('sub_areas')
        .insert(firstLevelSubAreas)
        .select();

      if (saError) throw saError;

      if (insertedFirstLevel) {
        insertedFirstLevel.forEach(sa => {
          createdIds.subAreas.push(sa.id);
          subAreaMap.set(`${areaName}_${sa.name}`, sa.id);
        });

        // Create second level sub-areas for first 2 first-level sub-areas
        const secondLevelSubAreas: any[] = [];
        for (let i = 0; i < 2 && i < insertedFirstLevel.length; i++) {
          const parentId = insertedFirstLevel[i].id;
          secondLevelSubAreas.push({
            area_id: areaId,
            parent_sub_area_id: parentId,
            level: 2,
            name: `תת-תת-אזור ${insertedFirstLevel[i].name} - חלקה 1`,
            variety: 'זן D',
            rows: '31-40',
            display: '31-40 | זן D',
          });
        }

        if (secondLevelSubAreas.length > 0) {
          const { data: insertedSecondLevel, error: sa2Error } = await supabase
            .from('sub_areas')
            .insert(secondLevelSubAreas)
            .select();

          if (sa2Error) throw sa2Error;
          insertedSecondLevel?.forEach(sa => createdIds.subAreas.push(sa.id));
        }
      }
    }

    console.log(`   ✅ Created ${createdIds.subAreas.length} sub-areas\n`);

    // 3. Report Areas
    console.log('3. Creating report areas...');
    const reportAreasToInsert: any[] = [];

    for (const [areaName, areaId] of createdIds.areas.entries()) {
      // Create monitoring report area for each area
      reportAreasToInsert.push({
        area_id: areaId,
        type: 'monitoring',
        name: `דוח ניטור ${areaName}`,
        description: `דוח ניטור עבור ${areaName}`,
      });

      // Create action report area for most areas (skip 2)
      if (reportAreasToInsert.length % 2 === 0) {
        reportAreasToInsert.push({
          area_id: areaId,
          type: 'action',
          name: `דוח פעולה ${areaName}`,
          description: `דוח פעולה עבור ${areaName}`,
        });
      }
    }

    const { data: insertedReportAreas, error: raError } = await supabase
      .from('report_areas')
      .insert(reportAreasToInsert)
      .select();

    if (raError) throw raError;
    insertedReportAreas?.forEach(ra => {
      createdIds.reportAreas.push({ id: ra.id, areaId: ra.area_id, type: ra.type });
    });
    console.log(`   ✅ Created ${insertedReportAreas?.length || 0} report areas\n`);
  } catch (error: any) {
    console.error('❌ Error seeding area relationships:', error.message);
    throw error;
  }
}

/**
 * Seed recommendations (recommend_material)
 */
async function seedRecommendations() {
  console.log('💡 Seeding recommendations...\n');

  try {
    if (createdIds.materials.size === 0 || createdIds.crops.size === 0) {
      console.log('   ⚠️  Materials or crops not available, skipping recommendations...\n');
      return;
    }

    const recommendations: any[] = [];
    const findingIds = Array.from(createdIds.findings.values());
    const materialIds = Array.from(createdIds.materials.values());
    const cropIds = Array.from(createdIds.crops.values());
    const actionTypeIds = Array.from(createdIds.actionTypes.values());
    const unitTypeIds = Array.from(createdIds.unitTypes.values());

    // Create 20 recommendations
    for (let i = 0; i < 20; i++) {
      recommendations.push({
        finding_id: findingIds[i % findingIds.length],
        material_id: materialIds[i % materialIds.length],
        crop_id: cropIds[i % cropIds.length],
        action_type_id: actionTypeIds[i % actionTypeIds.length],
        unit_type_id: unitTypeIds[i % unitTypeIds.length],
        dosage: String(50 + i * 5),
      });
    }

    const { data: inserted, error } = await supabase
      .from('recommend_material')
      .insert(recommendations)
      .select();

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        console.log('   ⚠️  Recommend_material table does not exist, skipping...');
        console.log('   💡 Run migration 20260124225324_create_crops_and_recommend_material.sql first\n');
      } else {
        throw error;
      }
    } else {
      console.log(`   ✅ Created ${inserted?.length || 0} recommendations\n`);
    }
  } catch (error: any) {
    console.error('❌ Error seeding recommendations:', error.message);
    throw error;
  }
}

/**
 * Seed reports (monitoring_area_report, actions_area_report)
 */
async function seedReports() {
  console.log('📊 Seeding reports...\n');

  try {
    // Get monitoring and action report areas
    const monitoringReportAreas = createdIds.reportAreas.filter(ra => ra.type === 'monitoring');
    const actionReportAreas = createdIds.reportAreas.filter(ra => ra.type === 'action');

    // Get sub-areas grouped by area
    const { data: allSubAreas } = await supabase.from('sub_areas').select('*');
    if (!allSubAreas) throw new Error('No sub-areas found');

    const findingIds = Array.from(createdIds.findings.values());
    const actionTypeIds = Array.from(createdIds.actionTypes.values());
    const unitTypeIds = Array.from(createdIds.unitTypes.values());
    const materialNames = Array.from(createdIds.materials.keys());

    // 1. Monitoring Reports
    console.log('1. Creating monitoring reports...');
    const monitoringReports: any[] = [];

    for (let i = 0; i < 20; i++) {
      const reportArea = monitoringReportAreas[i % monitoringReportAreas.length];
      // Find sub-areas that belong to the same area as the report area
      const matchingSubAreas = allSubAreas.filter(sa => sa.area_id === reportArea.areaId);
      
      if (matchingSubAreas.length > 0) {
        const subArea = matchingSubAreas[i % matchingSubAreas.length];
        monitoringReports.push({
          area_report_id: reportArea.id,
          sub_area_id: subArea.id,
          finding_id: findingIds[i % findingIds.length],
          recommend_material: `חומר מומלץ ${i + 1}`,
          recommend_dosage: String(50 + i * 10),
          recommend_unit_type_id: unitTypeIds[i % unitTypeIds.length],
          recommend_action_type_id: actionTypeIds[i % actionTypeIds.length],
          status: ['pending', 'in_progress', 'completed'][i % 3],
        });
      }
    }

    const { data: insertedMonitoring, error: mrError } = await supabase
      .from('monitoring_area_report')
      .insert(monitoringReports)
      .select();

    if (mrError) throw mrError;
    console.log(`   ✅ Created ${insertedMonitoring?.length || 0} monitoring reports\n`);

    // 2. Action Reports
    console.log('2. Creating action reports...');
    const actionReports: any[] = [];

    for (let i = 0; i < 15; i++) {
      const reportArea = actionReportAreas[i % actionReportAreas.length];
      const matchingSubAreas = allSubAreas.filter(sa => sa.area_id === reportArea.areaId);
      
      if (matchingSubAreas.length > 0) {
        const subArea = matchingSubAreas[i % matchingSubAreas.length];
        actionReports.push({
          area_report_id: reportArea.id,
          sub_area_id: subArea.id,
          finding_id: findingIds[i % findingIds.length],
          material: materialNames[i % materialNames.length],
          dosage: String(100 + i * 20),
          unit_type_id: unitTypeIds[i % unitTypeIds.length],
          action_type_id: actionTypeIds[i % actionTypeIds.length],
          action_time: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          status: ['planned', 'in_progress', 'completed'][i % 3],
          notes: `הערות לדוח פעולה ${i + 1}`,
        });
      }
    }

    const { data: insertedActions, error: arError } = await supabase
      .from('actions_area_report')
      .insert(actionReports)
      .select();

    if (arError) throw arError;
    console.log(`   ✅ Created ${insertedActions?.length || 0} action reports\n`);
  } catch (error: any) {
    console.error('❌ Error seeding reports:', error.message);
    throw error;
  }
}

/**
 * Seed user roles
 */
async function seedUserRoles() {
  console.log('👤 Assigning user roles...\n');

  try {
    const userRoles: any[] = [];

    // Admin role
    const adminUserId = createdIds.authUsers.get('admin@example.com');
    const adminRoleId = createdIds.roles.get('admin');
    if (adminUserId && adminRoleId) {
      userRoles.push({ user_id: adminUserId, role_id: adminRoleId });
    }

    // Customer owner roles
    const customer1UserId = createdIds.authUsers.get('customer1@example.com');
    const customer2UserId = createdIds.authUsers.get('customer2@example.com');
    const customerOwnerRoleId = createdIds.roles.get('customer_owner');
    if (customer1UserId && customerOwnerRoleId) {
      userRoles.push({ user_id: customer1UserId, role_id: customerOwnerRoleId });
    }
    if (customer2UserId && customerOwnerRoleId) {
      userRoles.push({ user_id: customer2UserId, role_id: customerOwnerRoleId });
    }

    // Worker roles
    const workerRoleId = createdIds.roles.get('worker');
    for (const userId of createdIds.authUsers.values()) {
      const email = Array.from(createdIds.authUsers.entries()).find(([_, id]) => id === userId)?.[0];
      if (email && (email.includes('inspector') || email.includes('spray')) && workerRoleId) {
        userRoles.push({ user_id: userId, role_id: workerRoleId });
      }
    }

    const { error } = await supabase.from('user_roles').insert(userRoles);
    if (error) throw error;
    console.log(`   ✅ Assigned ${userRoles.length} user roles\n`);
  } catch (error: any) {
    console.error('❌ Error seeding user roles:', error.message);
    throw error;
  }
}

/**
 * Seed invitations
 */
async function seedInvitations() {
  console.log('✉️  Seeding invitations...\n');

  try {
    const adminUserId = createdIds.authUsers.get('admin@example.com')!;
    const customer1Id = createdIds.customers.get('customer1@example.com')!;
    const inspectorTypeId = createdIds.workerTypes.get('inspector')!;
    const actionWorkerTypeId = createdIds.workerTypes.get('action_worker')!;

    const invitations = [
      {
        invitation_type: 'customer',
        invited_by_user_id: adminUserId,
        email: 'newcustomer@example.com',
        name: 'לקוח חדש',
        token: 'token-customer-1',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        invitation_type: 'worker',
        invited_by_user_id: adminUserId,
        customer_id: customer1Id,
        email: 'newworker@example.com',
        name: 'עובד חדש',
        worker_type_id: inspectorTypeId,
        token: 'token-worker-1',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        invitation_type: 'worker',
        invited_by_user_id: adminUserId,
        customer_id: customer1Id,
        email: 'newspray@example.com',
        name: 'רסס חדש',
        worker_type_id: actionWorkerTypeId,
        token: 'token-worker-2',
        status: 'accepted',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        invitation_type: 'customer',
        invited_by_user_id: adminUserId,
        email: 'expired@example.com',
        name: 'לקוח פג תוקף',
        token: 'token-expired',
        status: 'expired',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        invitation_type: 'worker',
        invited_by_user_id: adminUserId,
        customer_id: customer1Id,
        email: 'cancelled@example.com',
        name: 'עובד מבוטל',
        worker_type_id: inspectorTypeId,
        token: 'token-cancelled',
        status: 'cancelled',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { data: inserted, error } = await supabase
      .from('invitations')
      .insert(invitations)
      .select();

    if (error) throw error;
    console.log(`   ✅ Created ${inserted?.length || 0} invitations\n`);
  } catch (error: any) {
    console.error('❌ Error seeding invitations:', error.message);
    throw error;
  }
}

/**
 * Print summary of all seeded data
 */
async function printSummary() {
  console.log('📊 Seeding Summary\n');
  console.log('═'.repeat(60));

  try {
    const tables = [
      'worker_types',
      'action_types',
      'unit_types',
      'findings',
      'materials',
      'crops',
      'areas',
      'sub_areas',
      'report_areas',
      'customers',
      'workers',
      'customer_areas',
      'recommend_material',
      'monitoring_area_report',
      'actions_area_report',
      'user_roles',
      'invitations',
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`   ${table.padEnd(30)} ${count || 0}`);
      }
    }

    // Count auth users
    const { data: users } = await supabase.auth.admin.listUsers();
    console.log(`   ${'auth.users'.padEnd(30)} ${users?.users?.length || 0}`);

    console.log('═'.repeat(60));
    console.log('\n✅ Database seeding completed successfully!\n');
  } catch (error: any) {
    console.error('❌ Error printing summary:', error.message);
  }
}

/**
 * Main seeding function
 */
async function seedAllTables() {
  console.log('🌱 Starting complete database seeding...\n');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // 1. Delete all data
    await deleteAllData();

    // 2. Seed lookup tables
    await seedLookupTables();

    // 3. Seed areas
    await seedAreas();

    // 4. Create auth users
    await createAuthUsers();

    // 5. Seed customers and workers
    await seedCustomersAndWorkers();

    // 6. Seed area relationships
    await seedAreaRelationships();

    // 7. Seed recommendations
    await seedRecommendations();

    // 8. Seed reports
    await seedReports();

    // 9. Seed user roles
    await seedUserRoles();

    // 10. Seed invitations
    await seedInvitations();

    // 11. Print summary
    await printSummary();
  } catch (error: any) {
    console.error('\n❌ Error during seeding:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seeding
seedAllTables();
