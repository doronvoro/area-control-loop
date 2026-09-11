/**
 * Import a Gashur olive prototype backup into the olive module.
 *
 * The prototype's "הורד גיבוי מלא" button produces an HTML file with the full
 * dataset embedded as JSON in a hidden script tag. This reads that file (or a
 * plain .json export), maps it onto areas / olive_plot_details / report_areas
 * and friends, and reports every value it could not carry across rather than
 * coercing it silently.
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
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolveYieldRows, type YieldPlotLike } from '../lib/olive/import-yield';

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

const OLIVE_CROP_NAME = 'זית';

/**
 * Stand-in area id used during a dry run, so linkage can still be checked.
 *
 * Unique per prototype plot: a single shared constant would make every
 * not-yet-created plot collapse to one key, and the NIR pass dedupes on
 * (area, date) — two readings taken on different plots the same day would
 * report as one duplicate. A dry run has to count what --apply would write.
 */
const DRY_RUN_AREA_PREFIX = '__dry_run__:';

function dryRunAreaId(plotId: string): string {
  return `${DRY_RUN_AREA_PREFIX}${plotId}`;
}

function isDryRunAreaId(areaId: string): boolean {
  return areaId.startsWith(DRY_RUN_AREA_PREFIX);
}

// --- Types (the prototype's own shapes, not ours) ---

interface ProtoPlot {
  id: string;
  type?: string;
  grower?: string;
  region?: string;
  name?: string;
  variety?: string;
  plantYear?: string;
  size?: string | number;
  yieldEst?: string | number;
  harvester?: string;
  waterType?: string;
  taktCount?: string | number;
  harvestStatus?: string;
  totalFruit?: string | number;
  totalOil?: string | number;
}

interface ProtoNir {
  id: string;
  plotId: string;
  date?: string;
  irrigAmount?: string | number;
  maturity?: string | number;
  oil?: string | number;
  water?: string | number;
  dry?: string | number;
  green?: string | number;
  acid?: string | number;
  takt?: string;
  direction?: string;
  notes?: string;
}

interface ProtoBackup {
  plots?: ProtoPlot[];
  nirTests?: ProtoNir[];
  varietyWindows?: { variety: string; start: string; end: string }[];
  weatherEntries?: { date: string; rainMm: number | null; windKmh: number | null }[];
  regionalWeather?: { days?: { date: string; tempMin: number; tempMax: number; rainMm: number; windKmh: number }[] };
  ownYieldData?: { block: string; year: string; variety: string; kg: number | null }[];
  harvestYear?: string;
  harvestYearType?: string;
  exportedAt?: string;
}

// --- Hebrew UI value -> stored English code ---

const PLOT_TYPE_MAP: Record<string, string> = {
  'ארץ גשור': 'owner',
  שותף: 'partner',
  מזדמן: 'occasional',
};

const HARVESTER_MAP: Record<string, string> = {
  '1190x': '1190x',
  '9090x': '9090x',
  אחר: 'other',
};

const WATER_TYPE_MAP: Record<string, string> = {
  שפירים: 'fresh',
  קולחין: 'reclaimed',
  כנרת: 'kinneret',
};

// --- Dirty-data reporting ---

const issues: string[] = [];
function flag(message: string) {
  issues.push(message);
}

/** Number or null, flagging anything non-empty that will not parse. */
function num(value: unknown, where: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  flag(`${where}: "${value}" is not a number — stored as null`);
  return null;
}

/**
 * The planting year, which the prototype stores as free text.
 *
 * areas.planting_time is a DATE and cannot hold '2006/7', so the first four
 * digits become 1 January of that year and the raw label is kept verbatim on
 * olive_plot_details.plant_year_label.
 */
function plantingDate(raw: string | undefined, where: string): string | null {
  if (!raw) return null;
  const match = String(raw).match(/(\d{4})/);
  if (!match) {
    flag(`${where}: planting year "${raw}" has no 4-digit year — date left null, label kept`);
    return null;
  }
  if (!/^\d{4}$/.test(String(raw).trim())) {
    flag(`${where}: planting year "${raw}" kept as a label; date approximated to ${match[1]}-01-01`);
  }
  return `${match[1]}-01-01`;
}

function mapped(
  table: Record<string, string>,
  value: string | undefined,
  where: string,
  field: string
): string | null {
  if (!value) return null;
  const code = table[value.trim()];
  if (!code) {
    flag(`${where}: unknown ${field} "${value}" — stored as null`);
    return null;
  }
  return code;
}

/** Read the payload out of the backup HTML, or accept a bare .json export. */
function readBackup(path: string): ProtoBackup {
  const text = readFileSync(path, 'utf8');
  const match = text.match(
    /<script type="application\/json" id="raw-backup-data">([\s\S]*?)<\/script>/
  );
  const raw = match ? match[1] : text;

  let parsed: ProtoBackup;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'Could not parse the backup. Expected the dashboard HTML with its raw-backup-data block, or a .json export.'
    );
  }
  if (!Array.isArray(parsed.plots)) {
    throw new Error('Backup contains no plots array — is this a dashboard backup?');
  }
  return parsed;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const overwriteYield = args.includes('--overwrite-yield');
  const customerFlag = args.indexOf('--customer');
  const customerArg = customerFlag > -1 ? args[customerFlag + 1] : null;

  if (!file) {
    console.error(
      '❌ Usage: npm run import-olive -- <backup.html> [--apply] [--customer <uuid>] [--overwrite-yield]'
    );
    process.exit(1);
  }

  console.log(`🌱 Reading ${file}`);
  const backup = readBackup(file);
  console.log(
    `   plots ${backup.plots?.length ?? 0} · NIR ${backup.nirTests?.length ?? 0}` +
      ` · windows ${backup.varietyWindows?.length ?? 0} · yield rows ${backup.ownYieldData?.length ?? 0}`
  );
  if (backup.exportedAt) console.log(`   exported ${backup.exportedAt}`);
  if (!apply) console.log('\n🔎 DRY RUN — nothing will be written. Re-run with --apply to import.\n');

  // --- prerequisites ---
  const { data: crop } = await supabase
    .from('crops')
    .select('id')
    .eq('name', OLIVE_CROP_NAME)
    .maybeSingle();

  if (!crop) {
    console.error(`❌ No crop named "${OLIVE_CROP_NAME}". Create it before importing.`);
    process.exit(1);
  }

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

  // --- season ---
  const seasonName = backup.harvestYear ? `מסיק ${backup.harvestYear}` : 'מסיק (מיובא)';
  const year = Number(backup.harvestYear) || new Date().getFullYear();
  let seasonId: string | null = null;

  const { data: existingSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', seasonName)
    .maybeSingle();

  if (existingSeason) {
    seasonId = (existingSeason as any).id;
    console.log(`⏭️  season "${seasonName}" already exists`);
  } else if (apply) {
    const { data, error } = await supabase
      .from('seasons')
      .insert({
        name: seasonName,
        year_type: backup.harvestYearType || null,
        starts_on: `${year}-09-01`,
        ends_on: `${year}-12-31`,
        is_active: true,
      } as any)
      .select('id')
      .single();
    if (error) throw error;
    seasonId = (data as any).id;
    console.log(`✅ season "${seasonName}" created`);
  } else {
    console.log(`   would create season "${seasonName}" (${backup.harvestYearType || 'no year type'})`);
  }

  // --- plots ---
  // Matched on name within this customer's areas. The prototype has no stable
  // key we could reuse, and its names already encode block/year/variety.
  const { data: linked } = await supabase
    .from('customer_areas')
    .select('area_id, areas(id, name)')
    .eq('customer_id', customerId);

  const byName = new Map<string, string>();
  for (const row of (linked || []) as any[]) {
    if (row.areas?.name) byName.set(row.areas.name, row.areas.id);
  }

  const plotIdMap = new Map<string, string>(); // prototype plot id -> area id
  const perPlotYield = new Map<string, number>(); // prototype plot id -> yieldEst override
  let created = 0;
  let reused = 0;

  for (const plot of backup.plots || []) {
    const name = (plot.name || '').trim();
    if (!name) {
      flag(`plot ${plot.id}: no name — skipped`);
      continue;
    }
    const where = `plot "${name}"`;

    const existingId = byName.get(name);
    if (existingId) {
      plotIdMap.set(plot.id, existingId);
      reused += 1;
    } else if (apply) {
      const { data, error } = await supabase
        .from('areas')
        .insert({
          name,
          description: 'יובא מדשבורד המסיק',
          crop_id: (crop as any).id,
          size: num(plot.size, where),
          size_unit_type: 'dunam',
          area_type: 'outdoor',
          variety: plot.variety || null,
          planting_time: plantingDate(plot.plantYear, where),
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      const areaId = (data as any).id;
      await supabase.from('customer_areas').insert({ customer_id: customerId, area_id: areaId } as any);
      plotIdMap.set(plot.id, areaId);
      byName.set(name, areaId);
      created += 1;
    } else {
      plantingDate(plot.plantYear, where);
      num(plot.size, where);
      // Register a placeholder so the NIR pass can still resolve its plot
      // references. Without this a dry run reports every measurement as an
      // orphan, which is the opposite of what a preview is for.
      plotIdMap.set(plot.id, dryRunAreaId(plot.id));
      created += 1;
    }

    // details (validated in both modes so a dry run reports everything)
    const details = {
      grower_name: plot.grower || null,
      region: plot.region || null,
      plot_type: mapped(PLOT_TYPE_MAP, plot.type, where, 'plot type'),
      harvester: mapped(HARVESTER_MAP, plot.harvester, where, 'harvester'),
      water_type: mapped(WATER_TYPE_MAP, plot.waterType, where, 'water type'),
      takt_count: num(plot.taktCount, where),
      plant_year_label: plot.plantYear || null,
    };

    const areaId = plotIdMap.get(plot.id);

    // Parsed in both modes. This per-plot value is an override that beats the
    // ownYieldData sheet, so the yield pass below must know about it even in a
    // dry run — otherwise the preview reports writes it would not make.
    const est = num(plot.yieldEst, where);
    if (est !== null) perPlotYield.set(plot.id, est);

    if (apply && areaId) {
      await supabase
        .from('olive_plot_details')
        .upsert({ area_id: areaId, ...details } as any, { onConflict: 'area_id' });

      if (est !== null && seasonId) {
        await supabase
          .from('yield_estimates')
          .upsert({ area_id: areaId, season_id: seasonId, kg_per_dunam: est } as any, {
            onConflict: 'area_id,season_id',
          });
      }

      // A harvested plot becomes a final harvest pass, replacing the flag.
      if (plot.harvestStatus === 'נמסק') {
        const { data: header } = await supabase
          .from('report_areas')
          .insert({
            area_id: areaId,
            area_type_id: 'harvest',
            name: `מסיק מעבר 1 - ${name}`,
            description: 'יובא מדשבורד המסיק',
            status: 'completed',
            completion_percentage: 100,
          } as any)
          .select('id')
          .single();

        await supabase.from('harvest_report').insert({
          report_area_id: (header as any).id,
          pass_number: 1,
          fruit_kg: num(plot.totalFruit, where),
          oil_kg: num(plot.totalOil, where),
          is_final: true,
        } as any);
      }
    }
  }
  console.log(`📍 plots: ${created} new, ${reused} matched by name`);

  // --- yield estimates (ownYieldData) ---
  // A separate pass on purpose. The plot loop above already writes
  // yield_estimates from plot.yieldEst; folding this in would put two sources in
  // a race for the same (area_id, season_id) with the last write winning
  // silently. Precedence is one visible rule instead: yieldEst is a per-plot
  // override and wins, and this sheet fills in the rest. In a real export
  // yieldEst is empty everywhere and this sheet is the only source of kg/dunam.
  const yieldRows = backup.ownYieldData || [];
  if (yieldRows.length > 0) {
    const resolved = resolveYieldRows(
      (backup.plots || []) as YieldPlotLike[],
      yieldRows,
      new Set(perPlotYield.keys())
    );

    for (const { key, plots } of resolved.ambiguous) {
      flag(
        `yield: ${plots.length} plots share block/year/variety "${key.replace(/\u0000/g, ' / ')}"` +
          ` (${plots.map((p) => p.name).join(', ')}) — no estimate written for any of them`
      );
    }
    for (const { row, reason } of resolved.skipped) {
      flag(`yield row ${row.block} / ${row.year} / ${row.variety}: ${reason} — skipped`);
    }
    for (const { row, nearest, candidates } of resolved.unmatched) {
      let detail = '';
      if (nearest) {
        detail =
          ` — the only plot in that block and variety still without an estimate is` +
          ` "${nearest.name}"; confirm the year before using it`;
      } else if (candidates.length > 0) {
        detail =
          ` — same block and variety exists for ${candidates.map((c) => c.plantYear).join(', ')}` +
          `, none of them clearly the intended one`;
      }
      flag(
        `yield row ${row.block} / ${row.year} / ${row.variety} = ${row.kg} matches no plot${detail}`
      );
    }

    // Existing rows are read once so a re-run can tell "already correct" apart
    // from "somebody edited this in /olive/yield". A blind upsert would revert
    // the second case without saying so.
    const existingYield = new Map<string, number | null>();
    if (seasonId) {
      const { data: rows } = await supabase
        .from('yield_estimates')
        .select('area_id, kg_per_dunam')
        .eq('season_id', seasonId);
      for (const row of (rows || []) as any[]) {
        existingYield.set(row.area_id, row.kg_per_dunam === null ? null : Number(row.kg_per_dunam));
      }
    }

    let yieldWritten = 0;
    let yieldUnchanged = 0;
    let yieldConflicts = 0;

    if (apply && !seasonId) {
      flag(`yield: no season resolved — ${resolved.matched.length} estimates skipped`);
    } else {
      for (const { plot, kg } of resolved.matched) {
        const mappedId = plotIdMap.get(plot.id);
        // A plot the dry run only pretended to create has no row to compare
        // against, so it is unambiguously a write.
        const areaId = mappedId && !isDryRunAreaId(mappedId) ? mappedId : null;
        const current = areaId ? existingYield.get(areaId) : undefined;

        if (current !== undefined && current !== null) {
          if (current === kg) {
            yieldUnchanged += 1;
            continue;
          }
          if (!overwriteYield) {
            yieldConflicts += 1;
            flag(
              `yield "${plot.name}": stored ${current} kg/dunam but the backup says ${kg}` +
                ' — left as is; pass --overwrite-yield to replace'
            );
            continue;
          }
        }

        if (apply && areaId && seasonId) {
          const { error } = await supabase
            .from('yield_estimates')
            .upsert({ area_id: areaId, season_id: seasonId, kg_per_dunam: kg } as any, {
              onConflict: 'area_id,season_id',
            });
          if (error) throw error;
        }
        yieldWritten += 1;
      }
    }

    console.log(
      `🫒 yield: ${apply ? 'wrote' : 'would write'} ${yieldWritten}` +
        (yieldUnchanged ? `, ${yieldUnchanged} unchanged` : '') +
        (yieldConflicts ? `, ${yieldConflicts} conflicting` : '') +
        `, ${resolved.unmatched.length} unmatched` +
        `, ${resolved.unestimated.length} without an estimate`
    );
    if (resolved.unestimated.length > 0) {
      // Left absent rather than written as null: an empty cell in /olive/yield
      // means "nobody has estimated this yet", which is the truth here.
      console.log(`   no estimate: ${resolved.unestimated.map((p) => p.name).join(' · ')}`);
    }
  }

  // --- NIR measurements ---
  // Deduplicated on (area, date): the prototype allows one reading per plot per
  // day, so re-importing the same backup must not double every measurement.
  const { data: existingNir } = await supabase
    .from('report_areas')
    .select('area_id, report_date')
    .eq('area_type_id', 'nir');

  const seenNir = new Set(
    ((existingNir || []) as any[])
      .filter((r) => r.report_date)
      .map((r) => `${r.area_id}|${String(r.report_date).slice(0, 10)}`)
  );

  let nirCount = 0;
  let nirSkipped = 0;
  let dryMismatches = 0;

  for (const test of backup.nirTests || []) {
    const areaId = plotIdMap.get(test.plotId);
    const where = `NIR ${test.date || test.id}`;
    if (!areaId) {
      flag(`${where}: references unknown plot ${test.plotId} — skipped`);
      continue;
    }

    if (test.date && seenNir.has(`${areaId}|${test.date.slice(0, 10)}`)) {
      nirSkipped += 1;
      continue;
    }

    const oil = num(test.oil, where);
    const water = num(test.water, where);

    // dry is a generated column here; the prototype stored it as entered.
    // Report disagreements rather than overwriting either value.
    const storedDry = num(test.dry, where);
    if (storedDry !== null && oil !== null && water !== null && water < 100) {
      const computed = Math.round((oil / (100 - water)) * 100 * 100) / 100;
      if (Math.abs(computed - storedDry) > 0.05) {
        dryMismatches += 1;
        flag(`${where}: stored dry ${storedDry}% but oil/water compute to ${computed}% — computed value wins`);
      }
    }

    if (apply) {
      const { data: header, error } = await supabase
        .from('report_areas')
        .insert({
          area_id: areaId,
          area_type_id: 'nir',
          name: `בדיקת NIR - ${test.date || ''}`.trim(),
          description: test.notes || 'בדיקת NIR',
          status: 'completed',
          completion_percentage: 100,
          report_date: test.date || null,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      await supabase.from('nir_report').insert({
        report_area_id: (header as any).id,
        oil,
        water,
        green: num(test.green, where),
        acid: num(test.acid, where),
        maturity: num(test.maturity, where),
        irrig_amount: num(test.irrigAmount, where),
        direction: test.direction || null,
      } as any);
    }
    if (test.date) seenNir.add(`${areaId}|${test.date.slice(0, 10)}`);
    nirCount += 1;
  }
  console.log(
    `🧪 NIR measurements: ${nirCount} new` +
      (nirSkipped ? `, ${nirSkipped} already present` : '') +
      (dryMismatches ? ` (${dryMismatches} dry mismatches)` : '')
  );

  // --- variety windows ---
  let windowCount = 0;
  for (const w of backup.varietyWindows || []) {
    if (!w.variety || !w.start || !w.end) {
      flag(`variety window "${w.variety}": incomplete — skipped`);
      continue;
    }
    if (apply) {
      await supabase
        .from('variety_windows')
        .insert({ variety: w.variety, start_dm: w.start, end_dm: w.end } as any);
    }
    windowCount += 1;
  }
  console.log(`📅 variety windows: ${windowCount}`);

  // --- weather ---
  let weatherCount = 0;
  const weatherRows = [
    ...(backup.regionalWeather?.days || []).map((d) => ({
      entry_date: d.date,
      temp_min: d.tempMin ?? null,
      temp_max: d.tempMax ?? null,
      rain_mm: d.rainMm ?? null,
      wind_kmh: d.windKmh ?? null,
      is_manual: false,
    })),
    ...(backup.weatherEntries || []).map((w) => ({
      entry_date: w.date,
      temp_min: null,
      temp_max: null,
      rain_mm: w.rainMm ?? null,
      wind_kmh: w.windKmh ?? null,
      is_manual: true,
    })),
  ].filter((r) => r.entry_date);

  if (weatherRows.length > 0) {
    if (apply) {
      await supabase
        .from('weather_days')
        .upsert(weatherRows as any, { onConflict: 'entry_date,is_manual' });
    }
    weatherCount = weatherRows.length;
  }
  console.log(`🌦️  weather rows: ${weatherCount}`);

  // --- summary ---
  console.log('\n📊 Summary');
  console.log(`   plots            ${created} new / ${reused} matched`);
  console.log(`   NIR measurements ${nirCount} new${nirSkipped ? ` / ${nirSkipped} existing` : ''}`);
  console.log(`   variety windows  ${windowCount}`);
  console.log(`   weather rows     ${weatherCount}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} value(s) could not be carried across as-is:`);
    for (const issue of issues) console.log(`   · ${issue}`);
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
