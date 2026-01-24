/**
 * Comprehensive data seeding script
 * Adds substantial data to all tables for testing
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

async function seedComprehensiveData() {
  console.log('🌱 Seeding comprehensive data to all tables...\n');

  try {
    // 1. Get admin user and customer
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === 'admin@example.com');
    
    if (!adminUser) {
      console.error('❌ Admin user not found! Run npm run create-admin first.');
      return;
    }

    const { data: adminCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', adminUser.id)
      .single();

    if (!adminCustomer) {
      console.error('❌ Admin customer not found!');
      return;
    }

    // 2. Get worker types
    const { data: workerTypes } = await supabase.from('worker_types').select('*');
    const inspectorType = workerTypes?.find(wt => wt.name === 'inspector');
    const actionWorkerType = workerTypes?.find(wt => wt.name === 'action_worker');

    // 3. Add more areas
    console.log('1. Adding more areas...');
    const newAreas = [
      { name: 'אזור גולן', description: 'אזור גידול בגולן' },
      { name: 'אזור הגליל', description: 'אזור גידול בגליל' },
      { name: 'אזור הנגב', description: 'אזור גידול בנגב' },
      { name: 'אזור השפלה', description: 'אזור גידול בשפלה' },
      { name: 'אזור השרון', description: 'אזור גידול בשרון' },
    ];

    const { data: existingAreas } = await supabase.from('areas').select('name');
    const existingAreaNames = new Set(existingAreas?.map(a => a.name) || []);
    const areasToAdd = newAreas.filter(a => !existingAreaNames.has(a.name));

    if (areasToAdd.length > 0) {
      const { error } = await supabase.from('areas').insert(areasToAdd);
      if (error && !error.message.includes('duplicate')) throw error;
      console.log(`   ✅ Added ${areasToAdd.length} new areas`);
    }

    // Get all areas
    const { data: allAreas } = await supabase.from('areas').select('*');
    console.log(`   📊 Total areas: ${allAreas?.length || 0}\n`);

    // 4. Add more sub-areas
    console.log('2. Adding more sub-areas...');
    const { data: existingSubAreas } = await supabase.from('sub_areas').select('area_id, level');
    
    let subAreasAdded = 0;
    for (const area of allAreas?.slice(0, 8) || []) {
      // Add first level sub-areas
      const firstLevelSubAreas = Array.from({ length: 3 }, (_, i) => ({
        area_id: area.id,
        parent_sub_area_id: null,
        level: 1,
        name: `תת-אזור ${area.name} ${i + 1}`,
        variety: `זן ${String.fromCharCode(65 + i)}`,
        rows: `${i * 10 + 1}-${(i + 1) * 10}`,
        display: `${i * 10 + 1}-${(i + 1) * 10} | זן ${String.fromCharCode(65 + i)}`,
      }));

      const { data: inserted } = await supabase
        .from('sub_areas')
        .insert(firstLevelSubAreas)
        .select();

      if (inserted) {
        subAreasAdded += inserted.length;
        // Add second level sub-areas for some
        if (inserted.length > 0) {
          const secondLevel = inserted.slice(0, 2).map((sa: any) => ({
            area_id: area.id,
            parent_sub_area_id: sa.id,
            level: 2,
            name: `תת-תת-אזור ${sa.name} - חלקה 1`,
            variety: 'זן D',
            rows: '31-40',
            display: '31-40 | זן D',
          }));

          await supabase.from('sub_areas').insert(secondLevel);
        }
      }
    }
    console.log(`   ✅ Added ${subAreasAdded} new sub-areas\n`);

    // 5. Add more findings
    console.log('3. Adding more findings...');
    const newFindings = [
      { name: 'whitefly', description: 'כנימת עש', severity: 'high' },
      { name: 'thrips', description: 'פטריות', severity: 'medium' },
      { name: 'spider_mites', description: 'קרדיות עכביש', severity: 'high' },
      { name: 'aphids_green', description: 'כנימות ירוקות', severity: 'medium' },
      { name: 'leaf_miner', description: 'כורי עלים', severity: 'low' },
      { name: 'powdery_mildew', description: 'קמחון', severity: 'medium' },
      { name: 'downy_mildew', description: 'כשותית', severity: 'high' },
      { name: 'botrytis', description: 'בוטריטיס', severity: 'high' },
      { name: 'bacterial_spot', description: 'כתם חיידקי', severity: 'medium' },
      { name: 'virus', description: 'וירוס', severity: 'high' },
    ];

    await supabase.from('findings').upsert(newFindings, { onConflict: 'name' });
    const { data: allFindings } = await supabase.from('findings').select('*');
    console.log(`   ✅ Total findings: ${allFindings?.length || 0}\n`);

    // 6. Add more action types
    console.log('4. Adding more action types...');
    const newActionTypes = [
      { name: 'biological_control', description: 'הדברה ביולוגית' },
      { name: 'mechanical_removal', description: 'הסרה מכנית' },
      { name: 'soil_treatment', description: 'טיפול בקרקע' },
      { name: 'foliar_spray', description: 'ריסוס עלוותי' },
      { name: 'systemic_treatment', description: 'טיפול מערכתי' },
      { name: 'preventive_spray', description: 'ריסוס מניעתי' },
    ];

    await supabase.from('action_types').upsert(newActionTypes, { onConflict: 'name' });
    const { data: allActionTypes } = await supabase.from('action_types').select('*');
    console.log(`   ✅ Total action types: ${allActionTypes?.length || 0}\n`);

    // 7. Add more unit types
    console.log('5. Adding more unit types...');
    const newUnitTypes = [
      { name: 'mg', description: 'מיליגרם' },
      { name: 'ppm', description: 'חלקים למיליון' },
      { name: 'percentage', description: 'אחוז' },
      { name: 'dose_per_plant', description: 'מינון לצמח' },
    ];

    await supabase.from('unit_types').upsert(newUnitTypes, { onConflict: 'name' });
    const { data: allUnitTypes } = await supabase.from('unit_types').select('*');
    console.log(`   ✅ Total unit types: ${allUnitTypes?.length || 0}\n`);

    // 8. Add more workers
    console.log('6. Adding more workers...');
    const newWorkers = [
      { name: 'רותם כהן', type: 'inspector', email: 'rotem@example.com' },
      { name: 'אור לוי', type: 'inspector', email: 'or@example.com' },
      { name: 'תמר דוד', type: 'action_worker', email: 'tamar@example.com' },
      { name: 'אלון שרון', type: 'action_worker', email: 'alon@example.com' },
      { name: 'מיכל גולן', type: 'inspector', email: 'michal@example.com' },
      { name: 'יואב נגב', type: 'action_worker', email: 'yoav@example.com' },
    ];

    let workersAdded = 0;
    for (const worker of newWorkers) {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === worker.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: worker.email,
          password: 'worker123',
          email_confirm: true,
          user_metadata: { name: worker.name },
        });

        if (createError) {
          console.log(`   ⚠️  Skipped ${worker.name}: ${createError.message}`);
          continue;
        }

        if (!newUser.user) continue;
        userId = newUser.user.id;
      }

      // Check if worker record exists
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingWorker) continue;

      // Create worker record
      const typeId = worker.type === 'inspector' ? inspectorType?.id : actionWorkerType?.id;
      if (!typeId) continue;

      const { error: workerError } = await supabase.from('workers').insert({
        customer_id: adminCustomer.id,
        user_id: userId,
        name: worker.name,
        type_id: typeId,
      });

      if (!workerError) workersAdded++;
    }

    const { data: allWorkers } = await supabase.from('workers').select('*');
    console.log(`   ✅ Total workers: ${allWorkers?.length || 0} (added ${workersAdded})\n`);

    // 9. Link admin customer to all new areas
    console.log('7. Linking customer to all areas...');
    const { data: customerAreas } = await supabase
      .from('customer_areas')
      .select('area_id')
      .eq('customer_id', adminCustomer.id);

    const linkedAreaIds = new Set(customerAreas?.map(ca => ca.area_id) || []);
    const areasToLink = allAreas
      ?.filter(a => !linkedAreaIds.has(a.id))
      .map(a => ({
        customer_id: adminCustomer.id,
        area_id: a.id,
      })) || [];

    if (areasToLink.length > 0) {
      await supabase.from('customer_areas').insert(areasToLink);
      console.log(`   ✅ Linked customer to ${areasToLink.length} additional areas\n`);
    }

    // 10. Add more report areas
    console.log('8. Adding more report areas...');
    const { data: existingReportAreas } = await supabase.from('report_areas').select('area_id, type');
    
    const reportAreasToAdd: any[] = [];
    for (const area of allAreas || []) {
      // Check if monitoring report area exists
      const hasMonitoring = existingReportAreas?.some(
        ra => ra.area_id === area.id && ra.type === 'monitoring'
      );
      
      if (!hasMonitoring) {
        reportAreasToAdd.push({
          area_id: area.id,
          type: 'monitoring',
          name: `דוח ניטור ${area.name}`,
          description: `דוח ניטור עבור ${area.name}`,
        });
      }

      // Add action report areas for some
      const hasAction = existingReportAreas?.some(
        ra => ra.area_id === area.id && ra.type === 'action'
      );
      
      if (!hasAction && Math.random() > 0.3) {
        reportAreasToAdd.push({
          area_id: area.id,
          type: 'action',
          name: `דוח פעולה ${area.name}`,
          description: `דוח פעולה עבור ${area.name}`,
        });
      }
    }

    if (reportAreasToAdd.length > 0) {
      await supabase.from('report_areas').insert(reportAreasToAdd);
      console.log(`   ✅ Added ${reportAreasToAdd.length} report areas\n`);
    }

    // 11. Create sample monitoring reports
    console.log('9. Creating sample monitoring reports...');
    const { data: reportAreas } = await supabase
      .from('report_areas')
      .select('*')
      .eq('type', 'monitoring')
      .limit(5);

    const { data: subAreas } = await supabase.from('sub_areas').select('*').limit(10);
    const { data: inspectors } = await supabase
      .from('workers')
      .select('*, worker_types(*)')
      .eq('worker_types.name', 'inspector')
      .limit(3);

    if (reportAreas && subAreas && inspectors && allFindings && allActionTypes && allUnitTypes) {
      const monitoringReports = [];
      for (let i = 0; i < 10; i++) {
        const reportArea = reportAreas[i % reportAreas.length];
        const subArea = subAreas[i % subAreas.length];
        const inspector = inspectors[i % inspectors.length];
        const finding = allFindings[i % allFindings.length];
        const actionType = allActionTypes[i % allActionTypes.length];
        const unitType = allUnitTypes[i % allUnitTypes.length];

        if (reportArea.area_id === subArea.area_id) {
          monitoringReports.push({
            area_report_id: reportArea.id,
            sub_area_id: subArea.id,
            finding_id: finding.id,
            inspector_id: inspector.id,
            recommend_material: `חומר מומלץ ${i + 1}`,
            recommend_dosage: String(50 + i * 10),
            recommend_unit_type_id: unitType.id,
            recommend_action_type_id: actionType.id,
            status: ['pending', 'in_progress', 'completed'][i % 3],
          });
        }
      }

      if (monitoringReports.length > 0) {
        await supabase.from('monitoring_area_report').insert(monitoringReports);
        console.log(`   ✅ Created ${monitoringReports.length} monitoring reports\n`);
      }
    }

    // 12. Create sample action reports
    console.log('10. Creating sample action reports...');
    const { data: actionReportAreas } = await supabase
      .from('report_areas')
      .select('*')
      .eq('type', 'action')
      .limit(3);

    const { data: actionWorkers } = await supabase
      .from('workers')
      .select('*, worker_types(*)')
      .eq('worker_types.name', 'action_worker')
      .limit(3);

    if (actionReportAreas && subAreas && actionWorkers && allFindings && allActionTypes && allUnitTypes) {
      const actionReports = [];
      for (let i = 0; i < 8; i++) {
        const reportArea = actionReportAreas[i % actionReportAreas.length];
        const subArea = subAreas[i % subAreas.length];
        const worker = actionWorkers[i % actionWorkers.length];
        const finding = allFindings[i % allFindings.length];
        const actionType = allActionTypes[i % allActionTypes.length];
        const unitType = allUnitTypes[i % allUnitTypes.length];

        if (reportArea.area_id === subArea.area_id) {
          actionReports.push({
            area_report_id: reportArea.id,
            sub_area_id: subArea.id,
            finding_id: finding.id,
            material: `חומר ${i + 1}`,
            dosage: String(100 + i * 20),
            unit_type_id: unitType.id,
            action_type_id: actionType.id,
            action_time: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            status: ['planned', 'in_progress', 'completed'][i % 3],
            notes: `הערות לדוח פעולה ${i + 1}`,
          });
        }
      }

      if (actionReports.length > 0) {
        await supabase.from('actions_area_report').insert(actionReports);
        console.log(`   ✅ Created ${actionReports.length} action reports\n`);
      }
    }

    // Summary
    console.log('✅ Comprehensive data seeding completed!\n');
    console.log('📊 Summary:');
    const [areasCount, subAreasCount, findingsCount, actionTypesCount, unitTypesCount, workersCount, monitoringCount, actionsCount] = await Promise.all([
      supabase.from('areas').select('*', { count: 'exact', head: true }),
      supabase.from('sub_areas').select('*', { count: 'exact', head: true }),
      supabase.from('findings').select('*', { count: 'exact', head: true }),
      supabase.from('action_types').select('*', { count: 'exact', head: true }),
      supabase.from('unit_types').select('*', { count: 'exact', head: true }),
      supabase.from('workers').select('*', { count: 'exact', head: true }),
      supabase.from('monitoring_area_report').select('*', { count: 'exact', head: true }),
      supabase.from('actions_area_report').select('*', { count: 'exact', head: true }),
    ]);

    console.log(`   - Areas: ${areasCount.count || 0}`);
    console.log(`   - Sub-areas: ${subAreasCount.count || 0}`);
    console.log(`   - Findings: ${findingsCount.count || 0}`);
    console.log(`   - Action Types: ${actionTypesCount.count || 0}`);
    console.log(`   - Unit Types: ${unitTypesCount.count || 0}`);
    console.log(`   - Workers: ${workersCount.count || 0}`);
    console.log(`   - Monitoring Reports: ${monitoringCount.count || 0}`);
    console.log(`   - Action Reports: ${actionsCount.count || 0}\n`);

  } catch (error: any) {
    console.error('❌ Error seeding data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedComprehensiveData();
