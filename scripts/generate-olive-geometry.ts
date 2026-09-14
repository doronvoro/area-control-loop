/**
 * Generate map polygons for olive plots that have none.
 *
 * The prototype backup carries no coordinates and the importer writes none, so
 * /map is blank for an imported tenant. This lays the plots out around the
 * kibbutz so the map is usable.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npm run generate-olive-geometry -- --customer <uuid>
 *   ... --customer <uuid> --apply
 *   ... --customer <uuid> --apply --overwrite-geometry
 *
 * THE SHAPES ARE INVENTED, NOT SURVEYED. On screen they are indistinguishable
 * from boundaries someone walked with a GPS. Say so when handing the system
 * over, and replace them the moment real ones exist.
 *
 * What is faithful to the data, and what is not:
 *   - faithful: each polygon's true ground area equals the plot's `size` in
 *     dunam, and plots are grouped into their real regions. Relative sizes and
 *     groupings are therefore meaningful.
 *   - invented: absolute position, orientation, and the shape of each block.
 *
 * Deterministic — the same area id always produces the same rectangle, so a
 * re-run never scrambles a map somebody has started to learn.
 */

import { createClient } from '@supabase/supabase-js';
import { WEATHER_LATITUDE, WEATHER_LONGITUDE } from '../lib/services/olive-weather.service';
import type { GeoJSONPolygon } from '../components/map/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const overwrite = args.includes('--overwrite-geometry');
const customerFlag = args.indexOf('--customer');
const customerId = customerFlag > -1 ? args[customerFlag + 1] : null;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}
if (!customerId) {
  console.error(
    '❌ Usage: npm run generate-olive-geometry -- --customer <uuid> [--apply] [--overwrite-geometry]'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OLIVE_CROP_NAME = 'זית';

// --- geodesy -------------------------------------------------------------

/** Metres per degree of latitude. Near enough constant at this scale. */
const M_PER_DEG_LAT = 110574;
/** Metres per degree of longitude shrinks with latitude — 84% of the equator here. */
const M_PER_DEG_LNG = 111320 * Math.cos((WEATHER_LATITUDE * Math.PI) / 180);

const M2_PER_DUNAM = 1000;

/** Gap between plots and between region clusters, in metres. */
const PLOT_GAP_M = 12;
const CLUSTER_GAP_M = 180;

/**
 * How much wider than a perfect square to make each cluster before wrapping to
 * a new row. Shelf packing wastes some space, and orchards are not tessellated.
 */
const CLUSTER_SLACK = 1.6;

// --- deterministic randomness --------------------------------------------

/**
 * A small PRNG seeded from the area id.
 *
 * Deliberately not Math.random(): a re-run must reproduce the same shapes. The
 * exact distribution does not matter, only that it is stable and spread out.
 */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlotRow {
  id: string;
  name: string;
  size: number | null;
  region: string;
  hasGeometry: boolean;
}

interface Rect {
  w: number;
  h: number;
}

/**
 * A rectangle whose area is exactly the plot's size.
 *
 * Only the aspect ratio varies, so the ground area stays truthful while the
 * blocks stop looking like a row of identical squares. Orchard blocks are
 * usually elongated, hence the bias past 1:1.
 */
function rectFor(plot: PlotRow, rand: () => number): Rect {
  const dunam = plot.size && plot.size > 0 ? plot.size : 1;
  const area = dunam * M2_PER_DUNAM;

  const ratio = 1 + rand() * 1.2; // 1:1 .. 1:2.2
  let w = Math.sqrt(area * ratio);
  let h = Math.sqrt(area / ratio);
  if (rand() > 0.5) [w, h] = [h, w]; // half the blocks run the other way

  return { w, h };
}

/** Shelf packing: fill a row left to right, wrap when the row is full. */
function packShelves(items: { rect: Rect; plot: PlotRow }[], maxWidth: number) {
  const placed: { plot: PlotRow; rect: Rect; x: number; y: number }[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let usedWidth = 0;

  for (const item of items) {
    if (cursorX > 0 && cursorX + item.rect.w > maxWidth) {
      cursorX = 0;
      cursorY += rowHeight + PLOT_GAP_M;
      rowHeight = 0;
    }
    placed.push({ plot: item.plot, rect: item.rect, x: cursorX, y: cursorY });
    cursorX += item.rect.w + PLOT_GAP_M;
    rowHeight = Math.max(rowHeight, item.rect.h);
    usedWidth = Math.max(usedWidth, cursorX - PLOT_GAP_M);
  }

  return { placed, width: usedWidth, height: cursorY + rowHeight };
}

/** Local metres (x east, y north) around a centre, as a closed [lng,lat] ring. */
function toPolygon(
  centreLat: number,
  centreLng: number,
  x: number,
  y: number,
  rect: Rect
): GeoJSONPolygon {
  const corner = (dx: number, dy: number): [number, number] => [
    centreLng + (x + dx) / M_PER_DEG_LNG,
    centreLat + (y + dy) / M_PER_DEG_LAT,
  ];

  // Closed ring: first point repeated last, as L.geoJSON expects.
  return {
    type: 'Polygon',
    coordinates: [
      [corner(0, 0), corner(rect.w, 0), corner(rect.w, rect.h), corner(0, rect.h), corner(0, 0)],
    ],
  };
}

async function main() {
  console.log(`🎯 Target: ${supabaseUrl}`);
  console.log(`   customer: ${customerId}`);
  if (!apply) console.log('\n🔎 DRY RUN — nothing will be written. Add --apply to save.\n');

  const { data: links } = await supabase
    .from('customer_areas')
    .select('area_id')
    .eq('customer_id', customerId);

  const areaIds = (links || []).map((l: { area_id: string }) => l.area_id);
  if (areaIds.length === 0) {
    console.error('❌ That customer has no areas. Wrong uuid, or the import has not run.');
    process.exit(1);
  }

  const { data: areas, error: areasError } = await supabase
    .from('areas')
    .select('id, name, size, geometry, crops!inner(name)')
    .in('id', areaIds)
    .eq('crops.name', OLIVE_CROP_NAME);

  if (areasError) throw areasError;

  const { data: details } = await supabase
    .from('olive_plot_details')
    .select('area_id, region')
    .in('area_id', areaIds);

  const regionByArea = new Map(
    (details || []).map((d: { area_id: string; region: string | null }) => [
      d.area_id,
      d.region || '(ללא אזור)',
    ])
  );

  const plots: PlotRow[] = (areas || []).map(
    (a: { id: string; name: string; size: number | null; geometry: unknown }) => ({
      id: a.id,
      name: a.name,
      size: a.size === null ? null : Number(a.size),
      region: regionByArea.get(a.id) || '(ללא אזור)',
      hasGeometry: a.geometry !== null && a.geometry !== undefined,
    })
  );

  console.log(`   found ${plots.length} olive plot(s)`);

  const already = plots.filter((p) => p.hasGeometry);
  const todo = overwrite ? plots : plots.filter((p) => !p.hasGeometry);

  if (already.length > 0) {
    console.log(
      `   ${already.length} already have geometry — ${overwrite ? 'OVERWRITING (--overwrite-geometry)' : 'left untouched'}`
    );
  }
  if (todo.length === 0) {
    console.log('\n✅ Nothing to do.');
    return;
  }

  // --- group into region clusters, pack each one ---
  const byRegion = new Map<string, PlotRow[]>();
  for (const plot of todo) {
    const bucket = byRegion.get(plot.region);
    if (bucket) bucket.push(plot);
    else byRegion.set(plot.region, [plot]);
  }

  // Largest region first, so the big clusters get the tidy positions.
  const regions = [...byRegion.entries()].sort(
    (a, b) =>
      b[1].reduce((s, p) => s + (p.size || 0), 0) - a[1].reduce((s, p) => s + (p.size || 0), 0)
  );

  const clusters = regions.map(([region, regionPlots]) => {
    const items = regionPlots
      .map((plot) => ({ plot, rect: rectFor(plot, seededRandom(plot.id)) }))
      // Tallest first packs noticeably tighter than input order.
      .sort((a, b) => b.rect.h - a.rect.h);

    const totalM2 = regionPlots.reduce((s, p) => s + (p.size || 1) * M2_PER_DUNAM, 0);
    const maxWidth = Math.sqrt(totalM2 * CLUSTER_SLACK);

    return { region, ...packShelves(items, maxWidth) };
  });

  // --- lay the clusters out, same shelf algorithm one level up ---
  const totalClusterWidth = Math.sqrt(
    clusters.reduce((s, c) => s + c.width * c.height, 0) * CLUSTER_SLACK
  );

  let cx = 0;
  let cy = 0;
  let clusterRowHeight = 0;
  const positioned = clusters.map((cluster) => {
    if (cx > 0 && cx + cluster.width > totalClusterWidth) {
      cx = 0;
      cy += clusterRowHeight + CLUSTER_GAP_M;
      clusterRowHeight = 0;
    }
    const pos = { ...cluster, ox: cx, oy: cy };
    cx += cluster.width + CLUSTER_GAP_M;
    clusterRowHeight = Math.max(clusterRowHeight, cluster.height);
    return pos;
  });

  // Centre the whole estate on the kibbutz rather than hanging it off one corner.
  const estateW = Math.max(...positioned.map((c) => c.ox + c.width));
  const estateH = Math.max(...positioned.map((c) => c.oy + c.height));
  const shiftX = -estateW / 2;
  const shiftY = -estateH / 2;

  let written = 0;
  for (const cluster of positioned) {
    const dunam = cluster.placed.reduce((s, p) => s + (p.plot.size || 0), 0);
    console.log(
      `\n📍 ${cluster.region} — ${cluster.placed.length} plot(s), ${dunam.toFixed(2)} dunam, ` +
        `${Math.round(cluster.width)}×${Math.round(cluster.height)} m`
    );

    for (const item of cluster.placed) {
      const polygon = toPolygon(
        WEATHER_LATITUDE,
        WEATHER_LONGITUDE,
        cluster.ox + item.x + shiftX,
        cluster.oy + item.y + shiftY,
        item.rect
      );

      if (apply) {
        const { error } = await supabase
          .from('areas')
          .update({ geometry: polygon })
          .eq('id', item.plot.id);
        // Checked, not ignored: a silent failure here leaves a blank map with a
        // success message, which is the hardest kind of bug to notice.
        if (error) throw error;
      }
      written += 1;
    }
  }

  const estateKm = (Math.max(estateW, estateH) / 1000).toFixed(2);
  console.log(
    `\n${apply ? '✅ wrote' : '🔎 would write'} ${written} polygon(s); estate spans about ${estateKm} km`
  );
  if (!apply) console.log('   Re-run with --apply to save.');
}

main().catch((error) => {
  console.error('❌', error.message || error);
  process.exit(1);
});
