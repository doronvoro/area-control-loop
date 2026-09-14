/**
 * Import a Gashur olive prototype backup into the olive module.
 *
 * Extracted from scripts/import-olive-backup.ts so the CLI and the admin import
 * page (app/api/olive/import) run the same code. The client is injected and the
 * result is returned rather than printed — callers do their own presentation,
 * the same split lib/olive/import-yield.ts already uses.
 *
 * The prototype's "הורד גיבוי מלא" button produces an HTML file with the full
 * dataset embedded as JSON in a hidden script tag. This maps it onto areas /
 * sub_areas / olive_plot_details / report_areas and friends, and reports every
 * value it could not carry across rather than coercing it silently.
 *
 * Takts are sub_areas. A plot's takt_count materialises as טאקט 1..N so the NIR
 * and harvest pickers have something to list, and a NIR reading's takt label is
 * resolved back to that row. A reading naming a takt the plot does not have is
 * reported, not dropped.
 *
 * DRY RUN unless opts.apply. Nothing is written otherwise, because the import
 * creates dozens of rows and the prototype's own history includes a seeding bug
 * that destroyed live data.
 *
 * WHY RAW TABLE WRITES AND NOT THE olive-*.service.ts HELPERS
 * createNirReport() routes through findOrCreateReportArea → assertAreaVisible,
 * which reads with the RLS-scoped client. Every area here was created moments
 * ago by this same run, so that check would 403 on rows this import just wrote.
 * The raw writes are deliberate; do not "tidy" them into the services.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OLIVE_CROP_NAME } from '@/lib/olive/constants';
import { resolveYieldRows, type YieldPlotLike } from '@/lib/olive/import-yield';

// --- Types (the prototype's own shapes, not ours) ---

export interface ProtoPlot {
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

export interface ProtoNir {
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

export interface ProtoBackup {
  plots?: ProtoPlot[];
  nirTests?: ProtoNir[];
  varietyWindows?: { variety: string; start: string; end: string }[];
  weatherEntries?: { date: string; rainMm: number | null; windKmh: number | null }[];
  regionalWeather?: {
    days?: { date: string; tempMin: number; tempMax: number; rainMm: number; windKmh: number }[];
  };
  ownYieldData?: { block: string; year: string; variety: string; kg: number | null }[];
  harvestYear?: string;
  harvestYearType?: string;
  exportedAt?: string;
}

export interface ImportOptions {
  /** The tenant the imported plots are linked to. Required — callers resolve it. */
  customerId: string;
  /** Nothing is written unless this is true. */
  apply: boolean;
  /**
   * Plan as though the customer owns no olive areas yet.
   *
   * The import page wipes before it imports, so its preview has to describe the
   * post-wipe world. Against the live database a preview would report
   * "0 new, 45 matched" while the apply it is previewing does "45 new, 0
   * matched" — the operator would be approving a number they never get.
   */
  assumeEmpty?: boolean;
  /**
   * Replace kg/dunam values that differ from the backup. Off by default so a
   * re-run cannot silently undo an estimate someone edited in /olive/yield.
   */
  overwriteYield?: boolean;
  /**
   * Takts to give a plot whose backup record does not say.
   *
   * The prototype creates plots from the dunam sheet with `taktCount: ''`
   * hardcoded and asks the user to fill it in later; on the גשור export nobody
   * did, so all 45 plots arrive blank and no NIR or harvest picker has anything
   * to list. This lets the operator supply the number out of band.
   *
   * A plot that DOES carry its own taktCount keeps it — the file always wins.
   * The count applied is written to olive_plot_details.takt_count as well, so
   * the details pane and the takt rows cannot disagree.
   *
   * 1..10, matching both the prototype's dropdown and
   * olive_plot_details_takt_count_check.
   */
  defaultTaktCount?: number | null;
}

export type SeasonOutcome = 'existed' | 'created' | 'would-create';

export interface ImportResult {
  season: { name: string; yearType: string | null; outcome: SeasonOutcome };
  plots: { created: number; reused: number };
  takts: {
    created: number;
    reused: number;
    /**
     * Plots that got their takt count from defaultTaktCount rather than from
     * the file. Surfaced because this is supplied data, not imported data, and
     * a reader should be able to tell which is which.
     */
    fromDefault: number;
  };
  /** Null when the backup carries no ownYieldData sheet. */
  yield: {
    written: number;
    unchanged: number;
    conflicts: number;
    unmatched: number;
    /** Plot names with no estimate from either source. */
    unestimated: string[];
  } | null;
  nir: { created: number; skipped: number; taktLinked: number; dryMismatches: number };
  varietyWindows: number;
  weatherRows: number;
  issues: string[];
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

/** The marker every row this importer creates carries, so provenance is visible. */
export const IMPORTED_DESCRIPTION = 'יובא מדשבורד המסיק';

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

/**
 * Takt names follow supabase/seed/olive_demo_seed.sql, which is also what the
 * NIR and harvest pickers display: טאקט 1, טאקט 2, …
 */
function taktName(index: number): string {
  return `טאקט ${index}`;
}

function dryRunTaktId(plotId: string, index: number): string {
  return `${DRY_RUN_AREA_PREFIX}takt:${plotId}:${index}`;
}

/**
 * Upper bound on takt_count, matching the database.
 *
 * olive_plot_details_takt_count_check is
 * `takt_count IS NULL OR (takt_count >= 1 AND takt_count <= 10)`. A looser
 * limit here is not a guard, only a delay: the details upsert would reject the
 * row while the takt loop happily created the sub_areas.
 */
const MAX_TAKT_COUNT = 10;

// --- Dirty-data reporting ---

/**
 * Per-run issue collector.
 *
 * Deliberately not module state: the API route lives in a long-running server,
 * where a shared array would let one import report the previous one's flags.
 */
function createReporter() {
  const issues: string[] = [];

  const flag = (message: string) => {
    issues.push(message);
  };

  /** Number or null, flagging anything non-empty that will not parse. */
  const num = (value: unknown, where: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    flag(`${where}: "${value}" is not a number — stored as null`);
    return null;
  };

  /**
   * The planting year, which the prototype stores as free text.
   *
   * areas.planting_time is a DATE and cannot hold '2006/7', so the first four
   * digits become 1 January of that year and the raw label is kept verbatim on
   * olive_plot_details.plant_year_label.
   */
  const plantingDate = (raw: string | undefined, where: string): string | null => {
    if (!raw) return null;
    const match = String(raw).match(/(\d{4})/);
    if (!match) {
      flag(`${where}: planting year "${raw}" has no 4-digit year — date left null, label kept`);
      return null;
    }
    if (!/^\d{4}$/.test(String(raw).trim())) {
      flag(
        `${where}: planting year "${raw}" kept as a label; date approximated to ${match[1]}-01-01`
      );
    }
    return `${match[1]}-01-01`;
  };

  const mapped = (
    table: Record<string, string>,
    value: string | undefined,
    where: string,
    field: string
  ): string | null => {
    if (!value) return null;
    const code = table[value.trim()];
    if (!code) {
      flag(`${where}: unknown ${field} "${value}" — stored as null`);
      return null;
    }
    return code;
  };

  /**
   * takt_count, or null when it is not a plain count the database will accept.
   *
   * Validated here rather than at the takt loop so the value is already legal
   * by the time olive_plot_details is written. Out of order, a rejected
   * takt_count takes grower_name, region, plot_type, harvester, water_type and
   * plant_year_label down with it — the whole row fails the CHECK.
   */
  const taktCount = (value: unknown, where: string): number | null => {
    const parsed = num(value, where);
    if (parsed === null || parsed === 0) return null;
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TAKT_COUNT) {
      flag(
        `${where}: takt count ${parsed} is outside 1..${MAX_TAKT_COUNT}` +
          ' — plot details kept, no takts created'
      );
      return null;
    }
    return parsed;
  };

  return { issues, flag, num, plantingDate, mapped, taktCount };
}

/**
 * The operator-supplied takt count, or null.
 *
 * Throws rather than flags: a bad value here is a mistyped form field, not
 * dirty data in someone's export, and silently importing 45 plots with no
 * takts after the operator asked for 3 would be the wrong kind of quiet.
 */
export function validateDefaultTaktCount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > MAX_TAKT_COUNT) {
    throw new Error(`Takts per plot must be a whole number between 1 and ${MAX_TAKT_COUNT}.`);
  }
  return value;
}

// --- Parsing ---

/**
 * Pull the payload out of the backup HTML, or accept a bare .json export.
 *
 * Pure and side-effect free, so it can be unit-tested against the real file and
 * reused by the upload route without touching the filesystem.
 */
export function parseBackup(text: string): ProtoBackup {
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

// --- The import ---

export async function importBackup(
  supabase: SupabaseClient,
  backup: ProtoBackup,
  opts: ImportOptions
): Promise<ImportResult> {
  const { customerId, apply, assumeEmpty = false, overwriteYield = false } = opts;
  const defaultTaktCount = validateDefaultTaktCount(opts.defaultTaktCount);
  const { issues, flag, num, plantingDate, mapped, taktCount: parseTaktCount } = createReporter();

  // --- prerequisites ---
  const { data: crop } = await supabase
    .from('crops')
    .select('id')
    .eq('name', OLIVE_CROP_NAME)
    .maybeSingle();

  if (!crop) {
    throw new Error(`No crop named "${OLIVE_CROP_NAME}". Create it before importing.`);
  }
  const cropId = (crop as any).id;

  // --- season ---
  const seasonName = backup.harvestYear ? `מסיק ${backup.harvestYear}` : 'מסיק (מיובא)';
  const yearType = backup.harvestYearType || null;
  const year = Number(backup.harvestYear) || new Date().getFullYear();
  let seasonId: string | null = null;
  let seasonOutcome: SeasonOutcome;

  const { data: existingSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', seasonName)
    .maybeSingle();

  if (existingSeason) {
    seasonId = (existingSeason as any).id;
    seasonOutcome = 'existed';
  } else if (apply) {
    const { data, error } = await supabase
      .from('seasons')
      .insert({
        name: seasonName,
        year_type: yearType,
        starts_on: `${year}-09-01`,
        ends_on: `${year}-12-31`,
        is_active: true,
      } as any)
      .select('id')
      .single();
    if (error) throw error;
    seasonId = (data as any).id;
    seasonOutcome = 'created';
  } else {
    seasonOutcome = 'would-create';
  }

  // --- plots ---
  // Matched on name within this customer's areas. The prototype has no stable
  // key we could reuse, and its names already encode block/year/variety.
  const byName = new Map<string, string>();
  const taktsByArea = new Map<string, Map<string, string>>();

  // assumeEmpty models the wipe the import page performs first. Skipping both
  // lookups is what makes the preview describe the post-wipe world.
  if (!assumeEmpty) {
    const { data: linked } = await supabase
      .from('customer_areas')
      .select('area_id, areas(id, name)')
      .eq('customer_id', customerId);

    for (const row of (linked || []) as any[]) {
      if (row.areas?.name) byName.set(row.areas.name, row.areas.id);
    }

    // Takts already in place, so a re-run adopts them instead of adding a second
    // "טאקט 1" beside the first. Keyed by area id, then by takt name.
    const linkedAreaIds = [...byName.values()];
    if (linkedAreaIds.length > 0) {
      const { data: existingTakts } = await supabase
        .from('sub_areas')
        .select('id, area_id, name')
        .in('area_id', linkedAreaIds);
      for (const t of (existingTakts || []) as any[]) {
        if (!taktsByArea.has(t.area_id)) taktsByArea.set(t.area_id, new Map());
        taktsByArea.get(t.area_id)!.set(String(t.name).trim(), t.id);
      }
    }
  }

  const plotIdMap = new Map<string, string>(); // prototype plot id -> area id
  const perPlotYield = new Map<string, number>(); // prototype plot id -> yieldEst override
  let created = 0;
  let reused = 0;
  let taktsCreated = 0;
  let taktsReused = 0;
  let taktsFromDefault = 0;

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
          description: IMPORTED_DESCRIPTION,
          crop_id: cropId,
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
      const { error: linkError } = await supabase
        .from('customer_areas')
        .insert({ customer_id: customerId, area_id: areaId } as any);
      if (linkError) throw linkError;

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

    // The file wins. defaultTaktCount only fills a blank, so a backup that
    // does record takts is never overridden by the form field.
    const fileTaktCount = parseTaktCount(plot.taktCount, where);
    const effectiveTaktCount = fileTaktCount ?? defaultTaktCount;
    if (fileTaktCount === null && effectiveTaktCount !== null) taktsFromDefault += 1;

    // details (validated in both modes so a dry run reports everything)
    const details = {
      grower_name: plot.grower || null,
      region: plot.region || null,
      plot_type: mapped(PLOT_TYPE_MAP, plot.type, where, 'plot type'),
      harvester: mapped(HARVESTER_MAP, plot.harvester, where, 'harvester'),
      water_type: mapped(WATER_TYPE_MAP, plot.waterType, where, 'water type'),
      takt_count: effectiveTaktCount,
      plant_year_label: plot.plantYear || null,
    };

    const areaId = plotIdMap.get(plot.id);

    // Parsed in both modes. This per-plot value is an override that beats the
    // ownYieldData sheet, so the yield pass below must know about it even in a
    // dry run — otherwise the preview reports writes it would not make.
    const est = num(plot.yieldEst, where);
    if (est !== null) perPlotYield.set(plot.id, est);

    if (apply && areaId) {
      // The error is captured on purpose: a rejected row here is silent data
      // loss — the plot keeps its takts while every olive-specific field for it
      // vanishes, under an otherwise clean summary.
      const { error: detailsError } = await supabase
        .from('olive_plot_details')
        .upsert({ area_id: areaId, ...details } as any, { onConflict: 'area_id' });
      if (detailsError) throw detailsError;

      if (est !== null && seasonId) {
        const { error: estError } = await supabase
          .from('yield_estimates')
          .upsert({ area_id: areaId, season_id: seasonId, kg_per_dunam: est } as any, {
            onConflict: 'area_id,season_id',
          });
        if (estError) throw estError;
      }

      // A harvested plot becomes a final harvest pass, replacing the flag.
      if (plot.harvestStatus === 'נמסק') {
        const { data: header, error: headerError } = await supabase
          .from('report_areas')
          .insert({
            area_id: areaId,
            area_type_id: 'harvest',
            name: `מסיק מעבר 1 - ${name}`,
            description: IMPORTED_DESCRIPTION,
            status: 'completed',
            completion_percentage: 100,
          } as any)
          .select('id')
          .single();
        if (headerError) throw headerError;

        const { error: harvestError } = await supabase.from('harvest_report').insert({
          report_area_id: (header as any).id,
          pass_number: 1,
          fruit_kg: num(plot.totalFruit, where),
          oil_kg: num(plot.totalOil, where),
          is_final: true,
        } as any);
        if (harvestError) throw harvestError;
      }
    }

    // --- takts ---
    // A takt IS a sub_area: lib/services/olive-plot.service.ts embeds them as
    // `takts:sub_areas`, and that is what the NIR and harvest pickers list.
    // Writing takt_count onto olive_plot_details without these rows leaves a
    // plot claiming N takts while every picker shows "אין טאקטים בחלקה זו".
    //
    // Sizes are deliberately left null. The prototype records how many takts a
    // plot has, never how big each one is, and an even split would read on
    // screen as a surveyed figure — the same reason this importer reports a
    // gap rather than inventing the number.
    const count = details.takt_count;
    if (count !== null && areaId) {
      const known = taktsByArea.get(areaId) ?? new Map<string, string>();
      taktsByArea.set(areaId, known);

      for (let i = 1; i <= count; i += 1) {
        const label = taktName(i);
        if (known.has(label)) {
          taktsReused += 1;
          continue;
        }
        if (apply) {
          const { data, error } = await supabase
            .from('sub_areas')
            .insert({
              area_id: areaId,
              level: 1,
              name: label,
              variety: plot.variety || null,
            } as any)
            .select('id')
            .single();
          if (error) throw error;
          known.set(label, (data as any).id);
        } else {
          known.set(label, dryRunTaktId(plot.id, i));
        }
        taktsCreated += 1;
      }
    }
  }

  // --- yield estimates (ownYieldData) ---
  // A separate pass on purpose. The plot loop above already writes
  // yield_estimates from plot.yieldEst; folding this in would put two sources in
  // a race for the same (area_id, season_id) with the last write winning
  // silently. Precedence is one visible rule instead: yieldEst is a per-plot
  // override and wins, and this sheet fills in the rest. In a real export
  // yieldEst is empty everywhere and this sheet is the only source of kg/dunam.
  const yieldRows = backup.ownYieldData || [];
  let yieldSummary: ImportResult['yield'] = null;

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
    if (seasonId && !assumeEmpty) {
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

    yieldSummary = {
      written: yieldWritten,
      unchanged: yieldUnchanged,
      conflicts: yieldConflicts,
      unmatched: resolved.unmatched.length,
      // Left absent rather than written as null: an empty cell in /olive/yield
      // means "nobody has estimated this yet", which is the truth here.
      unestimated: resolved.unestimated.map((p) => (p.name || '').trim() || p.id),
    };
  }

  // --- NIR measurements ---
  // Deduplicated on (area, date): the prototype allows one reading per plot per
  // day, so re-importing the same backup must not double every measurement.
  const seenNir = new Set<string>();
  if (!assumeEmpty) {
    const { data: existingNir } = await supabase
      .from('report_areas')
      .select('area_id, report_date')
      .eq('area_type_id', 'nir');

    for (const r of (existingNir || []) as any[]) {
      if (r.report_date) seenNir.add(`${r.area_id}|${String(r.report_date).slice(0, 10)}`);
    }
  }

  const plotNameById = new Map<string, string>(
    (backup.plots || []).map((p) => [p.id, (p.name || '').trim() || p.id])
  );

  let nirCount = 0;
  let nirSkipped = 0;
  let dryMismatches = 0;
  let taktLinked = 0;

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

    // The prototype stores the takt as a bare label ("2"), not a reference.
    // nir_report.sub_area_id exists for exactly this — "the takt sampled, when
    // the sample is not plot-wide" — so resolve it against the takts above
    // instead of dropping it.
    let taktSubAreaId: string | null = null;
    const rawTakt = test.takt == null ? '' : String(test.takt).trim();
    if (rawTakt) {
      const known = taktsByArea.get(areaId);
      const match = known?.get(rawTakt) ?? known?.get(taktName(Number(rawTakt))) ?? null;
      if (!match) {
        flag(
          `${where}: recorded on takt "${rawTakt}" but plot "${plotNameById.get(test.plotId) ?? test.plotId}"` +
            ` has no such takt — reading imported against the whole plot`
        );
      } else {
        taktLinked += 1;
        // A dry-run id is a placeholder for a row --apply has not written yet.
        if (!isDryRunAreaId(match)) taktSubAreaId = match;
      }
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
        flag(
          `${where}: stored dry ${storedDry}% but oil/water compute to ${computed}% — computed value wins`
        );
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

      const { error: nirError } = await supabase.from('nir_report').insert({
        report_area_id: (header as any).id,
        sub_area_id: taktSubAreaId,
        oil,
        water,
        green: num(test.green, where),
        acid: num(test.acid, where),
        maturity: num(test.maturity, where),
        irrig_amount: num(test.irrigAmount, where),
        direction: test.direction || null,
      } as any);
      if (nirError) throw nirError;
    }
    if (test.date) seenNir.add(`${areaId}|${test.date.slice(0, 10)}`);
    nirCount += 1;
  }

  // --- variety windows ---
  let windowCount = 0;
  for (const w of backup.varietyWindows || []) {
    if (!w.variety || !w.start || !w.end) {
      flag(`variety window "${w.variety}": incomplete — skipped`);
      continue;
    }
    if (apply) {
      const { error } = await supabase
        .from('variety_windows')
        .insert({ variety: w.variety, start_dm: w.start, end_dm: w.end } as any);
      if (error) throw error;
    }
    windowCount += 1;
  }

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
      const { error } = await supabase
        .from('weather_days')
        .upsert(weatherRows as any, { onConflict: 'entry_date,is_manual' });
      if (error) throw error;
    }
    weatherCount = weatherRows.length;
  }

  return {
    season: { name: seasonName, yearType, outcome: seasonOutcome },
    plots: { created, reused },
    takts: { created: taktsCreated, reused: taktsReused, fromDefault: taktsFromDefault },
    yield: yieldSummary,
    nir: { created: nirCount, skipped: nirSkipped, taktLinked, dryMismatches },
    varietyWindows: windowCount,
    weatherRows: weatherCount,
    issues,
  };
}
