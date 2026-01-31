/**
 * Reset and Seed Script
 * Run with: npx tsx scripts/reset-and-seed.ts
 *
 * This script:
 * 1. Clears existing data (except auth users)
 * 2. Creates admin, inspector, and worker users
 * 3. Seeds all lookup tables
 * 4. Creates sample areas with crop associations
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('Get it from: npx supabase status --output json | grep SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// User credentials
const USERS = {
  admin: { email: 'admin@example.com', password: 'admin123', name: 'מנהל מערכת' },
  inspector1: { email: 'inspector1@example.com', password: 'worker123', name: 'פקח ראשי' },
  inspector2: { email: 'inspector2@example.com', password: 'worker123', name: 'פקח משני' },
  worker1: { email: 'worker1@example.com', password: 'worker123', name: 'עובד פעולות א' },
};

// Lookup data
const CROPS = [
  { name: 'tomatoes', description: 'עגבניות' },
  { name: 'cucumbers', description: 'מלפפונים' },
  { name: 'peppers', description: 'פלפלים' },
  { name: 'eggplant', description: 'חציל' },
  { name: 'zucchini', description: 'קישוא' },
];

const FINDINGS = [
  { name: 'aphids', description: 'כנימות', severity: 'medium' },
  { name: 'powdery_mildew', description: 'קמחון', severity: 'high' },
  { name: 'leaf_damage', description: 'כרסום עלים', severity: 'low' },
  { name: 'bacteria', description: 'חידק', severity: 'high' },
  { name: 'spider_mite', description: 'עכביש אדום', severity: 'medium' },
];

const ACTION_TYPES = [
  { name: 'chemical_spray', description: 'ריסוס כימי' },
  { name: 'biological_control', description: 'הדברה ביולוגית' },
  { name: 'soil_treatment', description: 'ריסוס קרקע' },
  { name: 'preventive_treatment', description: 'טיפול מניעתי' },
];

const MATERIALS = [
  { name: 'confidor', description: 'קונפידור' },
  { name: 'mospilan', description: 'מוספילן' },
  { name: 'bioactol', description: 'ביואקטול' },
  { name: 'tafnit', description: 'תפנית' },
  { name: 'admire', description: 'אדמייר' },
];

const UNIT_TYPES = [
  { name: 'liter_per_dunam', description: 'ליטר/דונם' },
  { name: 'gram_per_dunam', description: 'גרם/דונם' },
  { name: 'ml_per_liter', description: 'מ"ל/ליטר' },
  { name: 'percent', description: 'אחוז' },
];

// Crop-finding associations (which findings are relevant to which crops)
const CROP_FINDINGS_MAP: Record<string, string[]> = {
  tomatoes: ['aphids', 'powdery_mildew', 'bacteria', 'spider_mite'],
  cucumbers: ['aphids', 'powdery_mildew', 'spider_mite'],
  peppers: ['aphids', 'bacteria', 'spider_mite'],
  eggplant: ['aphids', 'spider_mite', 'leaf_damage'],
  zucchini: ['powdery_mildew', 'aphids', 'leaf_damage'],
};

// Sample areas with crops
const AREAS = [
  { name: 'משק 1 - חממה א', description: 'חממה ראשית', cropName: 'tomatoes' },
  { name: 'משק 1 - חממה ב', description: 'חממה משנית', cropName: 'cucumbers' },
  { name: 'משק 2 - שטח פתוח', description: 'שטח פתוח', cropName: 'peppers' },
  { name: 'משק 3 - חממה', description: 'חממת חציל', cropName: 'eggplant' },
];

// Sub-areas for each area
const SUB_AREAS = [
  { areaIndex: 0, name: 'שורות 1-10', level: 1, cropName: null }, // inherits from area
  { areaIndex: 0, name: 'שורות 11-20', level: 1, cropName: null },
  { areaIndex: 1, name: 'אגף צפוני', level: 1, cropName: null },
  { areaIndex: 1, name: 'אגף דרומי', level: 1, cropName: 'zucchini' }, // overrides area crop
  { areaIndex: 2, name: 'חלקה א', level: 1, cropName: null },
  { areaIndex: 2, name: 'חלקה ב', level: 1, cropName: null },
  { areaIndex: 3, name: 'מערב', level: 1, cropName: null },
  { areaIndex: 3, name: 'מזרח', level: 1, cropName: null },
];

// Recommend material entries (no finding_id - schema changed)
interface RecommendMaterialEntry {
  cropName: string;
  actionTypeName: string;
  materialName: string;
  dosage: string;
  unitTypeName: string;
}

const RECOMMEND_MATERIALS: RecommendMaterialEntry[] = [
  // Tomatoes
  { cropName: 'tomatoes', actionTypeName: 'chemical_spray', materialName: 'confidor', dosage: '0.5', unitTypeName: 'liter_per_dunam' },
  { cropName: 'tomatoes', actionTypeName: 'biological_control', materialName: 'bioactol', dosage: '200', unitTypeName: 'ml_per_liter' },
  { cropName: 'tomatoes', actionTypeName: 'chemical_spray', materialName: 'tafnit', dosage: '0.3', unitTypeName: 'percent' },
  { cropName: 'tomatoes', actionTypeName: 'chemical_spray', materialName: 'admire', dosage: '100', unitTypeName: 'gram_per_dunam' },
  // Cucumbers
  { cropName: 'cucumbers', actionTypeName: 'chemical_spray', materialName: 'mospilan', dosage: '50', unitTypeName: 'gram_per_dunam' },
  { cropName: 'cucumbers', actionTypeName: 'preventive_treatment', materialName: 'bioactol', dosage: '150', unitTypeName: 'ml_per_liter' },
  { cropName: 'cucumbers', actionTypeName: 'chemical_spray', materialName: 'tafnit', dosage: '0.25', unitTypeName: 'percent' },
  // Peppers
  { cropName: 'peppers', actionTypeName: 'chemical_spray', materialName: 'confidor', dosage: '0.4', unitTypeName: 'liter_per_dunam' },
  { cropName: 'peppers', actionTypeName: 'soil_treatment', materialName: 'tafnit', dosage: '1', unitTypeName: 'liter_per_dunam' },
  // Eggplant
  { cropName: 'eggplant', actionTypeName: 'chemical_spray', materialName: 'admire', dosage: '120', unitTypeName: 'gram_per_dunam' },
  // Zucchini
  { cropName: 'zucchini', actionTypeName: 'preventive_treatment', materialName: 'tafnit', dosage: '0.2', unitTypeName: 'percent' },
];

async function clearData() {
  console.log('Clearing existing data...');

  // Clear in reverse dependency order
  const tables = [
    'monitoring_area_report',
    'actions_area_report',
    'report_areas',
    'crop_findings',
    'recommend_material',
    'sub_areas',
    'customer_areas',
    'areas',
    'workers',
    'invitations',
    'user_roles',
    'customers',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && !error.message.includes('does not exist')) {
        console.warn(`  Warning clearing ${table}:`, error.message);
      } else {
        console.log(`  Cleared ${table}`);
      }
    } catch (e: any) {
      console.warn(`  Could not clear ${table}:`, e.message);
    }
  }

  // Clear lookup tables (optional - only clear if reseeding)
  const lookupTables = ['materials', 'crops', 'findings', 'action_types', 'unit_types'];
  for (const table of lookupTables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && !error.message.includes('does not exist')) {
        console.warn(`  Warning clearing ${table}:`, error.message);
      } else {
        console.log(`  Cleared ${table}`);
      }
    } catch (e: any) {
      console.warn(`  Could not clear ${table}:`, e.message);
    }
  }

  console.log('Data cleared.\n');
}

async function createOrGetUser(email: string, password: string, name: string, role: string) {
  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let user = existingUsers?.users?.find(u => u.email === email);

  if (user) {
    console.log(`  User ${email} already exists, updating...`);
    await supabase.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { name, role },
    });
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw error;
    user = newUser.user;
    console.log(`  Created user ${email}`);
  }

  return user!;
}

async function assignRole(userId: string, roleName: string) {
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();

  if (role) {
    // Check if already assigned
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', role.id)
      .single();

    if (!existing) {
      await supabase.from('user_roles').insert({ user_id: userId, role_id: role.id });
      console.log(`  Assigned role ${roleName} to user`);
    }
  }
}

async function seedUsers() {
  console.log('Creating users...');

  // Admin
  const adminUser = await createOrGetUser(USERS.admin.email, USERS.admin.password, USERS.admin.name, 'admin');
  await assignRole(adminUser.id, 'admin');

  // Create admin customer
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', adminUser.id)
    .single();

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    console.log('  Admin customer already exists');
  } else {
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        user_id: adminUser.id,
        name: 'חברת הדברה',
        description: 'חברת הדברה ראשית',
      })
      .select()
      .single();
    if (error) throw error;
    customerId = newCustomer.id;
    console.log('  Created admin customer');
  }

  // Get worker types
  const { data: workerTypes } = await supabase.from('worker_types').select('*');
  const inspectorType = workerTypes?.find(wt => wt.name === 'inspector');
  const actionWorkerType = workerTypes?.find(wt => wt.name === 'action_worker');

  if (!inspectorType || !actionWorkerType) {
    throw new Error('Worker types not found. Run migrations first.');
  }

  // Inspectors
  const inspector1User = await createOrGetUser(USERS.inspector1.email, USERS.inspector1.password, USERS.inspector1.name, 'inspector');
  await assignRole(inspector1User.id, 'inspector');

  const { data: existingInspector1 } = await supabase
    .from('workers')
    .select('id')
    .eq('user_id', inspector1User.id)
    .single();

  if (!existingInspector1) {
    await supabase.from('workers').insert({
      customer_id: customerId,
      user_id: inspector1User.id,
      name: USERS.inspector1.name,
      type_id: inspectorType.id,
    });
    console.log('  Created inspector1 worker record');
  }

  const inspector2User = await createOrGetUser(USERS.inspector2.email, USERS.inspector2.password, USERS.inspector2.name, 'inspector');
  await assignRole(inspector2User.id, 'inspector');

  const { data: existingInspector2 } = await supabase
    .from('workers')
    .select('id')
    .eq('user_id', inspector2User.id)
    .single();

  if (!existingInspector2) {
    await supabase.from('workers').insert({
      customer_id: customerId,
      user_id: inspector2User.id,
      name: USERS.inspector2.name,
      type_id: inspectorType.id,
    });
    console.log('  Created inspector2 worker record');
  }

  // Action worker
  const worker1User = await createOrGetUser(USERS.worker1.email, USERS.worker1.password, USERS.worker1.name, 'action_worker');
  await assignRole(worker1User.id, 'action_worker');

  const { data: existingWorker1 } = await supabase
    .from('workers')
    .select('id')
    .eq('user_id', worker1User.id)
    .single();

  if (!existingWorker1) {
    await supabase.from('workers').insert({
      customer_id: customerId,
      user_id: worker1User.id,
      name: USERS.worker1.name,
      type_id: actionWorkerType.id,
    });
    console.log('  Created worker1 worker record');
  }

  console.log('Users created.\n');
  return customerId;
}

async function seedLookupTables() {
  console.log('Seeding lookup tables...');

  // Crops
  const { data: crops, error: cropsError } = await supabase
    .from('crops')
    .insert(CROPS)
    .select();
  if (cropsError) throw cropsError;
  console.log(`  Seeded ${crops?.length || 0} crops`);

  // Findings
  const { data: findings, error: findingsError } = await supabase
    .from('findings')
    .insert(FINDINGS)
    .select();
  if (findingsError) throw findingsError;
  console.log(`  Seeded ${findings?.length || 0} findings`);

  // Action Types
  const { data: actionTypes, error: actionTypesError } = await supabase
    .from('action_types')
    .insert(ACTION_TYPES)
    .select();
  if (actionTypesError) throw actionTypesError;
  console.log(`  Seeded ${actionTypes?.length || 0} action types`);

  // Materials
  const { data: materials, error: materialsError } = await supabase
    .from('materials')
    .insert(MATERIALS)
    .select();
  if (materialsError) throw materialsError;
  console.log(`  Seeded ${materials?.length || 0} materials`);

  // Unit Types
  const { data: unitTypes, error: unitTypesError } = await supabase
    .from('unit_types')
    .insert(UNIT_TYPES)
    .select();
  if (unitTypesError) throw unitTypesError;
  console.log(`  Seeded ${unitTypes?.length || 0} unit types`);

  console.log('Lookup tables seeded.\n');

  return { crops, findings, actionTypes, materials, unitTypes };
}

async function seedCropFindings(crops: any[], findings: any[]) {
  console.log('Seeding crop-findings associations...');

  const cropFindingsData: { crop_id: string; finding_id: string }[] = [];

  for (const [cropName, findingNames] of Object.entries(CROP_FINDINGS_MAP)) {
    const crop = crops.find(c => c.name === cropName);
    if (!crop) continue;

    for (const findingName of findingNames) {
      const finding = findings.find(f => f.name === findingName);
      if (!finding) continue;

      cropFindingsData.push({
        crop_id: crop.id,
        finding_id: finding.id,
      });
    }
  }

  if (cropFindingsData.length > 0) {
    const { error } = await supabase
      .from('crop_findings')
      .insert(cropFindingsData);
    if (error) throw error;
  }

  console.log(`  Created ${cropFindingsData.length} crop-finding associations.\n`);
}

async function seedRecommendMaterials(
  crops: any[],
  actionTypes: any[],
  materials: any[],
  unitTypes: any[]
) {
  console.log('Seeding recommend materials...');

  const recommendData: any[] = [];

  for (const rm of RECOMMEND_MATERIALS) {
    const crop = crops.find(c => c.name === rm.cropName);
    const actionType = actionTypes.find(at => at.name === rm.actionTypeName);
    const material = materials.find(m => m.name === rm.materialName);
    const unitType = unitTypes.find(ut => ut.name === rm.unitTypeName);

    if (crop && actionType && material && unitType) {
      recommendData.push({
        crop_id: crop.id,
        action_type_id: actionType.id,
        material_id: material.id,
        dosage: rm.dosage,
        unit_type_id: unitType.id,
      });
    }
  }

  if (recommendData.length > 0) {
    const { error } = await supabase
      .from('recommend_material')
      .insert(recommendData);
    if (error) throw error;
  }

  console.log(`  Created ${recommendData.length} recommend materials.\n`);
}

async function seedAreas(customerId: string, crops: any[]) {
  console.log('Seeding areas...');

  const areaIds: string[] = [];

  for (const area of AREAS) {
    const crop = crops.find(c => c.name === area.cropName);

    const { data: newArea, error } = await supabase
      .from('areas')
      .insert({
        name: area.name,
        description: area.description,
        crop_id: crop?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    areaIds.push(newArea.id);

    // Link to customer
    await supabase.from('customer_areas').insert({
      customer_id: customerId,
      area_id: newArea.id,
    });

    // Create report area for monitoring
    await supabase.from('report_areas').insert({
      area_id: newArea.id,
      type: 'monitoring',
      name: `דוח ניטור - ${area.name}`,
      description: `דוח ניטור עבור ${area.name}`,
    });

    console.log(`  Created area: ${area.name}`);
  }

  console.log('Areas created.\n');
  return areaIds;
}

async function seedSubAreas(areaIds: string[], crops: any[]) {
  console.log('Seeding sub-areas...');

  for (const subArea of SUB_AREAS) {
    const areaId = areaIds[subArea.areaIndex];
    if (!areaId) continue;

    const crop = subArea.cropName ? crops.find(c => c.name === subArea.cropName) : null;

    // Get area name for display
    const { data: area } = await supabase
      .from('areas')
      .select('name')
      .eq('id', areaId)
      .single();

    const display = `${area?.name || ''} | ${subArea.name}`;

    const { error } = await supabase.from('sub_areas').insert({
      area_id: areaId,
      name: subArea.name,
      level: subArea.level,
      crop_id: crop?.id || null,
      display,
    });

    if (error) throw error;
    console.log(`  Created sub-area: ${subArea.name}`);
  }

  console.log('Sub-areas created.\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('Reset and Seed Script');
  console.log('='.repeat(60) + '\n');

  try {
    // Clear existing data
    await clearData();

    // Create users
    const customerId = await seedUsers();

    // Seed lookup tables
    const { crops, findings, actionTypes, materials, unitTypes } = await seedLookupTables();

    // Seed crop-findings associations
    await seedCropFindings(crops!, findings!);

    // Seed recommend materials
    await seedRecommendMaterials(crops!, actionTypes!, materials!, unitTypes!);

    // Seed areas
    const areaIds = await seedAreas(customerId, crops!);

    // Seed sub-areas
    await seedSubAreas(areaIds, crops!);

    console.log('='.repeat(60));
    console.log('Seed completed successfully!');
    console.log('='.repeat(60) + '\n');

    console.log('Login Credentials:');
    console.log('-'.repeat(40));
    console.log(`Admin:      ${USERS.admin.email} / ${USERS.admin.password}`);
    console.log(`Inspector1: ${USERS.inspector1.email} / ${USERS.inspector1.password}`);
    console.log(`Inspector2: ${USERS.inspector2.email} / ${USERS.inspector2.password}`);
    console.log(`Worker1:    ${USERS.worker1.email} / ${USERS.worker1.password}`);
    console.log('-'.repeat(40));
    console.log('\nLogin at: http://localhost:3000/login\n');

  } catch (error: any) {
    console.error('Error during seeding:', error.message);
    process.exit(1);
  }
}

main();
