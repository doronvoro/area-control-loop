import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  resolveYieldRows,
  yieldKey,
  type OwnYieldRow,
  type YieldPlotLike,
} from '@/lib/olive/import-yield';

/**
 * The yield matcher joins the prototype's ownYieldData sheet onto its plots.
 *
 * This is the one part of the import where a wrong answer is silent: a
 * mis-joined row attaches a plausible kg/dunam to the wrong plot and nothing
 * downstream complains. So the rules are pinned here — especially that an
 * ambiguous key writes nothing and an unmatched row is never auto-corrected.
 */

// ─── synthetic fixtures ──────────────────────────────────────────────────────

function plot(id: string, region: string, plantYear: string, variety: string): YieldPlotLike {
  return { id, name: `${region} — ${plantYear} — ${variety}`, region, plantYear, variety };
}

function row(block: string, year: string, variety: string, kg: number | null): OwnYieldRow {
  return { block, year, variety, kg };
}

describe('yieldKey', () => {
  it('is insensitive to surrounding and repeated whitespace', () => {
    expect(yieldKey('  מנחת ', '2018', 'ארבקינה')).toBe(yieldKey('מנחת', '2018', 'ארבקינה'));
    expect(yieldKey('זית  בוגר', '2003', 'ברנע')).toBe(yieldKey('זית בוגר', '2003', 'ברנע'));
  });

  it('normalizes to NFC so a decomposed Hebrew form matches a composed one', () => {
    const composed = 'שׁ';
    const decomposed = 'שׁ'.normalize('NFD');
    expect(yieldKey(composed, '2020', 'x')).toBe(yieldKey(decomposed, '2020', 'x'));
  });

  it('separates parts so adjacent fields cannot run together into one key', () => {
    // Without a separator both of these would flatten to "ab2020x".
    expect(yieldKey('a', 'b2020', 'x')).not.toBe(yieldKey('ab', '2020', 'x'));
  });

  it('treats null and undefined parts as empty rather than the string "null"', () => {
    expect(yieldKey(null, undefined, '')).toBe(yieldKey('', '', ''));
  });
});

describe('resolveYieldRows', () => {
  it('matches a row to the single plot with the same block, year and variety', () => {
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה'), plot('p2', 'מנחת', '2020', 'ברנע')];
    const result = resolveYieldRows(plots, [row('מנחת', '2018', 'ארבקינה', 900)]);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].plot.id).toBe('p1');
    expect(result.matched[0].kg).toBe(900);
    expect(result.unmatched).toHaveLength(0);
  });

  it('writes nothing for a key held by more than one plot', () => {
    // Two plots genuinely sharing block/year/variety: picking either one would
    // attach the number to a plot that may not have earned it.
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה'), plot('p2', 'מנחת', '2018', 'ארבקינה')];
    const result = resolveYieldRows(plots, [row('מנחת', '2018', 'ארבקינה', 900)]);

    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].plots.map((p) => p.id)).toEqual(['p1', 'p2']);
    // An ambiguous row is not reported as unmatched — it has a home, just not a
    // provable one, and calling it unmatched would invite a manual mis-fix.
    expect(result.unmatched).toHaveLength(0);
    expect(result.unestimated.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('skips a row with no usable number instead of writing null', () => {
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה')];
    const result = resolveYieldRows(plots, [row('מנחת', '2018', 'ארבקינה', null)]);

    expect(result.matched).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.unestimated.map((p) => p.id)).toEqual(['p1']);
  });

  it('suggests a near-miss only when one candidate is still without an estimate', () => {
    // The real file's shape: a row on a year that does not exist, with two
    // same-variety plots in the block — one already covered, one still open.
    const plots = [
      plot('p2005', 'מיצר', '2005', 'קורטינה'),
      plot('p2018', 'מיצר', '2018', 'קורטינה'),
    ];
    const result = resolveYieldRows(plots, [
      row('מיצר', '2018', 'קורטינה', 1100),
      row('מיצר', '2003', 'קורטינה', 1500),
    ]);

    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].candidates.map((p) => p.id)).toEqual(['p2005', 'p2018']);
    expect(result.unmatched[0].nearest?.id).toBe('p2005');
  });

  it('refuses to suggest when several candidates are equally open', () => {
    const plots = [
      plot('p2005', 'מיצר', '2005', 'קורטינה'),
      plot('p2018', 'מיצר', '2018', 'קורטינה'),
    ];
    const result = resolveYieldRows(plots, [row('מיצר', '2003', 'קורטינה', 1500)]);

    expect(result.unmatched[0].candidates).toHaveLength(2);
    expect(result.unmatched[0].nearest).toBeNull();
  });

  it('reports no candidates at all when block and variety are both unknown', () => {
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה')];
    const result = resolveYieldRows(plots, [row('שדות', '2018', 'פישולין', 700)]);

    expect(result.unmatched[0].candidates).toEqual([]);
    expect(result.unmatched[0].nearest).toBeNull();
  });

  it('leaves a plot out of unestimated when its own yieldEst already covered it', () => {
    // yieldEst is a per-plot override applied by the importer's plot loop; this
    // sheet must not then report the plot as missing an estimate.
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה'), plot('p2', 'מנחת', '2020', 'ברנע')];
    const result = resolveYieldRows(plots, [], new Set(['p1']));

    expect(result.unestimated.map((p) => p.id)).toEqual(['p2']);
  });

  it('does not mutate its inputs', () => {
    const plots = [plot('p1', 'מנחת', '2018', 'ארבקינה')];
    const rows = [row('מנחת', '2018', 'ארבקינה', 900)];
    const plotsBefore = JSON.stringify(plots);
    const rowsBefore = JSON.stringify(rows);

    resolveYieldRows(plots, rows);

    expect(JSON.stringify(plots)).toBe(plotsBefore);
    expect(JSON.stringify(rows)).toBe(rowsBefore);
  });
});

// ─── the real export ─────────────────────────────────────────────────────────

/**
 * Asserted against the grower's actual backup, which is deliberately NOT
 * committed — it is real customer data. The test runs when the file is present
 * (which is the machine doing the rollout) and skips elsewhere, so CI stays
 * green without the numbers going unchecked where it matters.
 *
 * Point OLIVE_BACKUP_FILE at the export to run it from another path.
 */
const BACKUP_FILE =
  process.env.OLIVE_BACKUP_FILE ||
  join(homedir(), 'Downloads', 'גיבוי חיזוי מסיק ונתונים - 2026.html');

/** `yieldEst` is the per-plot override the sheet has to defer to. */
type BackupPlot = YieldPlotLike & { yieldEst?: string | number | null };

interface ProtoBackup {
  plots?: BackupPlot[];
  ownYieldData?: OwnYieldRow[];
}

function readBackup(path: string): ProtoBackup {
  const text = readFileSync(path, 'utf8');
  const match = text.match(
    /<script type="application\/json" id="raw-backup-data">([\s\S]*?)<\/script>/
  );
  return JSON.parse(match ? match[1] : text);
}

describe.skipIf(!existsSync(BACKUP_FILE))('the 2026 Gashur export', () => {
  const backup = existsSync(BACKUP_FILE)
    ? readBackup(BACKUP_FILE)
    : { plots: [], ownYieldData: [] };
  const plots = backup.plots || [];
  const rows = backup.ownYieldData || [];

  it('has the shape the rollout plan was written against', () => {
    expect(plots).toHaveLength(45);
    expect(rows).toHaveLength(42);
    // Every yieldEst is empty, which is why this sheet is the only source of
    // kg/dunam and why the importer needed a second pass at all.
    expect(plots.filter((p) => p.yieldEst !== '' && p.yieldEst != null)).toEqual([]);
  });

  it('keys all 45 plots uniquely on block/year/variety, so the join is injective', () => {
    const keys = new Set(plots.map((p) => yieldKey(p.region, p.plantYear, p.variety)));
    expect(keys.size).toBe(45);
  });

  it('carries 770.02 dunam, the checksum for a complete plot import', () => {
    const total = plots.reduce((sum, p) => sum + Number(p.size || 0), 0);
    expect(Number(total.toFixed(2))).toBe(770.02);
  });

  it('matches 41 rows summing to 43,800 kg/dunam, the checksum for a complete yield import', () => {
    const result = resolveYieldRows(plots, rows);

    expect(result.matched).toHaveLength(41);
    expect(result.matched.reduce((sum, m) => sum + m.kg, 0)).toBe(43800);
    expect(result.ambiguous).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('leaves exactly one orphan row, with 2005 קורטינה as its only open candidate', () => {
    const result = resolveYieldRows(plots, rows);

    expect(result.unmatched).toHaveLength(1);
    const [{ row: orphan, nearest, candidates }] = result.unmatched;
    expect(orphan.kg).toBe(1500);
    expect(orphan.year).toBe('2003');
    // Two plots share the block and variety; only 2005 is still unestimated,
    // and 2018 already took a row of its own.
    expect(candidates.map((c) => c.plantYear)).toEqual(['2005', '2018']);
    expect(nearest?.name).toBe('זית בוגר (מיצר) — 2005 — קורטינה');
  });

  it('leaves 4 plots without an estimate, named so they can be filled by hand', () => {
    const result = resolveYieldRows(plots, rows);

    expect(result.unestimated.map((p) => p.name)).toEqual([
      'זית בוגר (מיצר) — 2003 — ברנע',
      'זית בוגר (מיצר) — 2005 — קורטינה',
      'מנחת — 2020 — זנים וולקני',
      "מנחת — 2026 — לצ'ינו",
    ]);
  });
});
