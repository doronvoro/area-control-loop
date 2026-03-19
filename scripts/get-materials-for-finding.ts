/**
 * Script to get recommended materials for a specific finding and crop.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/get-materials-for-finding.ts
 *
 * Default: finding = אקרית החלודה, crop = אפרסק
 * Override with args:
 *   npx tsx scripts/get-materials-for-finding.ts "אקרית החלודה" "אפרסק"
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const findingName = process.argv[2] || 'אקרית החלודה';
const cropName = process.argv[3] || 'אפרסק';

async function main() {
  console.log(`\n🔍 מחפש חומרים עבור ממצא: "${findingName}" | גידול: "${cropName}"\n`);

  // 1. Find the finding
  const { data: finding, error: findingError } = await supabase
    .from('findings')
    .select('id, name')
    .eq('name', findingName)
    .single();

  if (findingError || !finding) {
    console.error(`❌ ממצא "${findingName}" לא נמצא`);
    process.exit(1);
  }
  console.log(`✅ ממצא: ${finding.name} (${finding.id})`);

  // 2. Find the crop
  const { data: crop, error: cropError } = await supabase
    .from('crops')
    .select('id, name')
    .eq('name', cropName)
    .single();

  if (cropError || !crop) {
    console.error(`❌ גידול "${cropName}" לא נמצא`);
    process.exit(1);
  }
  console.log(`✅ גידול: ${crop.name} (${crop.id})`);

  // 3. Query recommend_material for this crop + finding
  const { data: recommendations, error: recError } = await supabase
    .from('recommend_material')
    .select('*, materials(*), unit_types(*)')
    .eq('crop_id', crop.id)
    .eq('finding_id', finding.id);

  if (recError) {
    console.error('❌ שגיאה בשליפת המלצות:', recError.message);
    process.exit(1);
  }

  if (!recommendations || recommendations.length === 0) {
    console.log('\n⚠️  לא נמצאו חומרים מומלצים לשילוב זה.');

    // Check pesticide registry as fallback
    const { data: registry } = await supabase
      .from('pesticide_registry')
      .select('*')
      .eq('crop_id', crop.id)
      .eq('finding_id', finding.id);

    if (registry && registry.length > 0) {
      console.log(`\n📋 נמצאו ${registry.length} רשומות ברישום חומרי הדברה:`);
      registry.forEach((r: any, i: number) => {
        console.log(`  ${i + 1}. ${r.material_name || r.trade_name || 'לא ידוע'} - ${r.active_ingredient || ''}`);
      });
    }
    return;
  }

  // 4. Display results
  console.log(`\n📋 נמצאו ${recommendations.length} המלצות חומרים:\n`);
  console.log('─'.repeat(70));

  const actionTypeLabels: Record<string, string> = {
    spray: 'ריסוס',
    drench: 'הגמעה',
    spread: 'פיזור',
  };

  recommendations.forEach((rec: any, i: number) => {
    const material = rec.materials;
    const unitType = rec.unit_types;
    const actionType = rec.action_type_id
      ? actionTypeLabels[rec.action_type_id] || rec.action_type_id
      : 'כל סוגי הפעולות';

    console.log(`  ${i + 1}. חומר: ${material?.name || 'לא ידוע'}`);
    if (material?.active_ingredient) {
      console.log(`     חומר פעיל: ${material.active_ingredient}`);
    }
    console.log(`     מינון: ${rec.dosage} ${unitType?.name || ''}`);
    console.log(`     סוג פעולה: ${actionType}`);
    console.log(`     מקור: ${rec.source || 'custom'}`);
    console.log('─'.repeat(70));
  });
}

main().catch((err) => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});
