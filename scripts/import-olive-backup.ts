/**
 * Import a Gashur olive prototype backup into the olive module.
 *
 * The import itself lives in lib/olive/import-backup.ts, shared with the admin
 * import page (/admin/olive-import). This file is the CLI over it: argument
 * parsing, reading the file off disk, and formatting the result. It stays as
 * the fallback for when the app is unreachable, and as the way to import
 * without the wipe the page performs.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply, because the import
 * creates dozens of rows and the prototype's own history includes a seeding
 * bug that destroyed live data.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-olive -- <backup.html>
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-olive -- <backup.html> --apply
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run import-olive -- <backup.html> --apply --customer <uuid>
 *
 * --overwrite-yield replaces kg/dunam values that differ from the backup. By
 * default a difference is reported and left alone, so a re-run cannot silently
 * undo an estimate someone edited in /olive/yield.
 *
 * This command MERGES: plots are matched by name and reused. It does not wipe.
 * Harvest reports are inserted unconditionally by the importer, so re-running
 * this on a tenant that already has an import doubles their harvest history —
 * use /admin/olive-import, which wipes first.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { importBackup, parseBackup } from '../lib/olive/import-backup';
import { groupIssues } from '../lib/olive/import-issues';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  console.error('   Get it from: npx supabase status --output json | grep SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const overwriteYield = args.includes('--overwrite-yield');
  const customerFlag = args.indexOf('--customer');
  const customerArg = customerFlag > -1 ? args[customerFlag + 1] : null;
  const taktsFlag = args.indexOf('--takts-per-plot');
  const taktsArg = taktsFlag > -1 ? Number(args[taktsFlag + 1]) : null;

  if (!file) {
    console.error(
      '❌ Usage: npm run import-olive -- <backup.html> [--apply] [--customer <uuid>]' +
        ' [--overwrite-yield] [--takts-per-plot <1-10>]'
    );
    process.exit(1);
  }

  console.log(`🌱 Reading ${file}`);
  const backup = parseBackup(readFileSync(file, 'utf8'));
  console.log(
    `   plots ${backup.plots?.length ?? 0} · NIR ${backup.nirTests?.length ?? 0}` +
      ` · windows ${backup.varietyWindows?.length ?? 0} · yield rows ${backup.ownYieldData?.length ?? 0}`
  );
  if (backup.exportedAt) console.log(`   exported ${backup.exportedAt}`);
  if (!apply)
    console.log('\n🔎 DRY RUN — nothing will be written. Re-run with --apply to import.\n');

  // Resolving the customer is a CLI concern: the page has a dropdown, and the
  // importer itself takes an id it can trust.
  let customerId = customerArg;
  if (!customerId) {
    const { data: customers } = await supabase.from('customers').select('id, name');
    if (!customers || customers.length === 0) {
      console.error('❌ No customers exist. Pass --customer <uuid>.');
      process.exit(1);
    }
    if (customers.length > 1) {
      console.error('❌ Several customers exist — pass --customer <uuid>:');
      for (const c of customers) console.error(`     ${(c as any).id}  ${(c as any).name}`);
      process.exit(1);
    }
    customerId = (customers[0] as any).id;
    console.log(`   linking to the only customer: ${(customers[0] as any).name}`);
  }

  const result = await importBackup(supabase, backup, {
    customerId: customerId!,
    apply,
    overwriteYield,
    defaultTaktCount: taktsArg,
  });

  // --- season ---
  const { name: seasonName, yearType, outcome } = result.season;
  if (outcome === 'adopted') {
    // The backup named no season, so the estimates go on the one the app reads.
    console.log(`📅 season "${seasonName}" adopted (the active season)`);
  } else if (outcome === 'existed') {
    console.log(`⏭️  season "${seasonName}" already exists`);
  } else if (outcome === 'created') {
    console.log(`✅ season "${seasonName}" created and made active`);
  } else {
    console.log(`   would create season "${seasonName}" (${yearType || 'no year type'})`);
  }

  // --- plots and takts ---
  console.log(`📍 plots: ${result.plots.created} new, ${result.plots.reused} matched by name`);
  if (result.takts.created > 0 || result.takts.reused > 0) {
    console.log(
      `🌿 takts: ${result.takts.created} new` +
        (result.takts.reused ? `, ${result.takts.reused} already present` : '') +
        (result.takts.fromDefault
          ? `, ${result.takts.fromDefault} plots used --takts-per-plot ${taktsArg}`
          : '')
    );
  } else {
    console.log(
      '🌿 takts: none — no plot in this backup records a takt count' +
        ' (pass --takts-per-plot <1-10> to supply one)'
    );
  }

  // --- yield ---
  if (result.yield) {
    const y = result.yield;
    console.log(
      `🫒 yield: ${apply ? 'wrote' : 'would write'} ${y.written}` +
        (y.unchanged ? `, ${y.unchanged} unchanged` : '') +
        (y.conflicts ? `, ${y.conflicts} conflicting` : '') +
        `, ${y.unmatched} unmatched` +
        `, ${y.unestimated.length} without an estimate`
    );
    if (y.unestimated.length > 0) {
      console.log(`   no estimate: ${y.unestimated.join(' · ')}`);
    }
  }

  // --- NIR ---
  console.log(
    `🧪 NIR measurements: ${result.nir.created} new` +
      (result.nir.skipped ? `, ${result.nir.skipped} already present` : '') +
      (result.nir.taktLinked ? `, ${result.nir.taktLinked} linked to a takt` : '') +
      (result.nir.dryMismatches ? ` (${result.nir.dryMismatches} dry mismatches)` : '')
  );

  console.log(`📅 variety windows: ${result.varietyWindows}`);
  console.log(`🌦️  weather rows: ${result.weatherRows}`);
  console.log(
    `🎯 status-card thresholds: ${
      result.categoryThresholds ? 'taken from the file' : 'left as they are'
    }`
  );

  // --- summary ---
  console.log('\n📊 Summary');
  console.log(`   plots            ${result.plots.created} new / ${result.plots.reused} matched`);
  console.log(`   takts            ${result.takts.created} new / ${result.takts.reused} matched`);
  console.log(
    `   NIR measurements ${result.nir.created} new${result.nir.skipped ? ` / ${result.nir.skipped} existing` : ''}`
  );
  console.log(`   variety windows  ${result.varietyWindows}`);
  console.log(`   weather rows     ${result.weatherRows}`);
  console.log(`   card thresholds  ${result.categoryThresholds ? 'from file' : 'unchanged'}`);

  if (result.issues.length > 0) {
    const groups = groupIssues(result.issues);
    console.log(
      `\n⚠️  ${result.issues.length} value(s) could not be carried across as-is,` +
        ` in ${groups.length} group(s):`
    );
    // Grouped the same way the admin page groups them, so a flag discussed off
    // one output can be found in the other.
    for (const group of groups) {
      console.log(`\n   [${group.info.label}] ×${group.messages.length}`);
      console.log(`   מה נשמר במערכת: ${group.info.effect}`);
      for (const message of group.messages) console.log(`   · ${message}`);
    }
    console.log('\n   These are reported rather than guessed at. Review them against the source.');
  } else {
    console.log('\n✅ No data-quality issues found.');
  }

  if (!apply) {
    console.log('\n🔎 DRY RUN — nothing was written. Re-run with --apply to import.');
  } else {
    console.log('\n✅ Import complete.');
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message || err);
  process.exit(1);
});
