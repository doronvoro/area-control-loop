/**
 * Match the prototype's own-yield reference table onto its plots.
 *
 * The prototype keeps kg/dunam in a separate sheet keyed on
 * (block, year, variety), while each plot carries the same three values as
 * (region, plantYear, variety). In a real export the per-plot `yieldEst` field
 * is usually empty and this sheet is the only place the numbers exist, so
 * without this join an import produces plots with no yield at all.
 *
 * Pure and side-effect free so it can be tested against the real backup file.
 * It reports rather than guesses: an ambiguous key writes nothing, and a row
 * that matches no plot is returned with its closest candidate for a human to
 * confirm.
 */

export interface YieldPlotLike {
  id: string;
  name?: string;
  region?: string;
  plantYear?: string;
  variety?: string;
  size?: string | number;
}

export interface OwnYieldRow {
  block: string;
  year: string;
  variety: string;
  kg: number | null;
}

export interface ResolvedYield {
  /** Rows that landed on exactly one plot. */
  matched: { row: OwnYieldRow; plot: YieldPlotLike; kg: number }[];
  /**
   * Rows with no plot at that key.
   *
   * `candidates` is every plot sharing the block and variety but not the year;
   * `nearest` is filled only when exactly one of those is still without an
   * estimate, which is the one case where the guess is well founded.
   */
  unmatched: {
    row: OwnYieldRow;
    nearest: YieldPlotLike | null;
    candidates: YieldPlotLike[];
  }[];
  /** Plots left without any estimate, from this sheet or the per-plot override. */
  unestimated: YieldPlotLike[];
  /** Keys held by more than one plot — nothing is written for these. */
  ambiguous: { key: string; plots: YieldPlotLike[] }[];
  /** Rows carrying no usable number. */
  skipped: { row: OwnYieldRow; reason: string }[];
}

/**
 * Composite key shared by both sides.
 *
 * NFC matters: the Hebrew geresh in a variety like לצ'ינו can arrive as U+05F3
 * or U+0027 depending on where the text was typed, and the two are different
 * strings. The separator is NUL rather than a printable character so a block
 * name that happens to contain the separator cannot collide two distinct keys.
 */
export function yieldKey(block: unknown, year: unknown, variety: unknown): string {
  return [block, year, variety]
    .map((part) =>
      String(part ?? '')
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
    )
    .join('\u0000');
}

function isUsableNumber(value: unknown): value is number {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/**
 * @param plots           the backup's plots, in file order
 * @param rows            the backup's ownYieldData rows
 * @param alreadyEstimated prototype plot ids that got an estimate from their own
 *                        `yieldEst` field, which takes precedence over this sheet
 */
export function resolveYieldRows(
  plots: YieldPlotLike[],
  rows: OwnYieldRow[],
  alreadyEstimated: ReadonlySet<string> = new Set()
): ResolvedYield {
  const byKey = new Map<string, YieldPlotLike[]>();
  for (const plot of plots) {
    const key = yieldKey(plot.region, plot.plantYear, plot.variety);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(plot);
    else byKey.set(key, [plot]);
  }

  const ambiguous = [...byKey.entries()]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([key, bucketPlots]) => ({ key, plots: bucketPlots }));
  const ambiguousKeys = new Set(ambiguous.map((a) => a.key));

  const matched: ResolvedYield['matched'] = [];
  const skipped: ResolvedYield['skipped'] = [];
  const missed: OwnYieldRow[] = [];
  const covered = new Set<string>();

  for (const row of rows) {
    if (!isUsableNumber(row.kg)) {
      skipped.push({ row, reason: 'no kg/dunam value' });
      continue;
    }

    const key = yieldKey(row.block, row.year, row.variety);

    if (ambiguousKeys.has(key)) {
      // Deliberately not written: two plots share this block/year/variety and
      // picking one would silently attach a number to the wrong plot.
      continue;
    }

    const bucket = byKey.get(key);
    if (!bucket) {
      missed.push(row);
      continue;
    }

    matched.push({ row, plot: bucket[0], kg: Number(row.kg) });
    covered.add(key);
  }

  const unestimated = plots.filter((plot) => {
    if (alreadyEstimated.has(plot.id)) return false;
    const key = yieldKey(plot.region, plot.plantYear, plot.variety);
    return !covered.has(key);
  });

  // Near-misses are resolved only after every row has been matched, because the
  // discriminator is which candidate is still without an estimate — and that is
  // not known until the whole sheet has been placed.
  const stillOpen = new Set(unestimated.map((plot) => plot.id));
  const unmatched = missed.map((row) => {
    const candidates = findCandidates(plots, row);
    const open = candidates.filter((plot) => stillOpen.has(plot.id));
    return { row, nearest: open.length === 1 ? open[0] : null, candidates };
  });

  return { matched, unmatched, unestimated, ambiguous, skipped };
}

/**
 * Every plot matching on block and variety, whatever the year.
 *
 * A wrong year is the likeliest reason a row misses — the real file has one row
 * on a 2003 קורטינה where the block only has 2005 and 2018 — so naming the
 * candidates is far more useful than reporting "no match". This deliberately
 * returns all of them; narrowing to a suggestion is the caller's job.
 */
function findCandidates(plots: YieldPlotLike[], row: OwnYieldRow): YieldPlotLike[] {
  const norm = (value: unknown) =>
    String(value ?? '')
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ');
  const block = norm(row.block);
  const variety = norm(row.variety);

  return plots.filter((plot) => norm(plot.region) === block && norm(plot.variety) === variety);
}
