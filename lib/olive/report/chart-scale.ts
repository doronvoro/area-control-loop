/**
 * Y-axis scaling for the report's NIR trend chart.
 *
 * WHY THIS EXISTS AT ALL
 * The prototype hardcoded a 0..100 domain — `yAt = v => padT + plotH -
 * (v/100)*plotH`, with gridlines at 0/25/50/75/100 (docs/code.html:5894). Every
 * value it plots is a percentage, so that looks defensible until you print it:
 * on the real Gashur data an oil reading moving 4.8 → 5.3 travels half a pixel,
 * water sits pinned near the ceiling, and the three series render as three flat
 * lines. The rise over the season is the one thing the report exists to show,
 * and the axis was hiding it.
 *
 * So the domain is derived from the data instead. Two rules keep that honest:
 *
 *   1. A minimum span (MIN_SPAN), so a series that barely moves is not blown up
 *      into a dramatic slope. Sampling noise must not read as a trend.
 *   2. Ticks land on round numbers, so a grower reading the chart on paper can
 *      tell what a gridline means without a calculator.
 *
 * Pure and Date-free, like everything else in lib/olive — the chart component
 * is a thin renderer over this.
 */

/** Percentages never go below zero, whatever the padding works out to. */
const FLOOR = 0;

/**
 * The narrowest window the axis will show, in percentage points. Below this the
 * domain is widened around the data's midpoint rather than zoomed further in.
 */
export const MIN_SPAN = 2;

/** Fraction of the data's own span added as breathing room at each end. */
const PAD_RATIO = 0.15;

/** Padding never collapses to nothing on an almost-flat series. */
const MIN_PAD = 0.5;

export interface PanelDomain {
  min: number;
  max: number;
  /** Ascending, inclusive of both ends. */
  ticks: number[];
}

/**
 * A "nice" gridline step: 1, 2, 2.5, 5 or 10, scaled by a power of ten.
 *
 * Rounds to the NEAREST rung, not up. Always rounding up doubles the step
 * whenever the ideal lands just past a rung — an ideal of 0.54 became 1, which
 * on a 2.2-point window left two gridlines with the lower one clipped by the
 * panel edge. The thresholds are the geometric midpoints between rungs.
 */
function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const normalised = raw / base;
  const multiplier =
    normalised <= 1.5
      ? 1
      : normalised <= 2.25
        ? 2
        : normalised <= 3.5
          ? 2.5
          : normalised <= 7.5
            ? 5
            : 10;
  return multiplier * base;
}

/**
 * The axis for one panel, covering every series drawn on it.
 *
 * Returns null when there is nothing finite to scale, which the caller renders
 * as an absent panel rather than an empty box.
 */
export function panelDomain(
  values: (number | null | undefined)[],
  tickCount = 4
): PanelDomain | null {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return null;

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const pad = Math.max((dataMax - dataMin) * PAD_RATIO, MIN_PAD);

  let low = dataMin - pad;
  let high = dataMax + pad;

  // Widen a too-narrow window symmetrically, so the data stays centred.
  if (high - low < MIN_SPAN) {
    const midpoint = (high + low) / 2;
    low = midpoint - MIN_SPAN / 2;
    high = midpoint + MIN_SPAN / 2;
  }

  if (low < FLOOR) {
    high += FLOOR - low;
    low = FLOOR;
  }

  // The domain is the padded data range, NOT that range rounded out to whole
  // gridline steps. Snapping it looks tidier in the abstract and wastes the
  // panel in practice: a season running 12..45 gets a step of 20, snaps out to
  // 0..60, and spends half the height on empty axis — which is the same problem
  // the fixed 0..100 axis had, arrived at by a longer route. Ticks are placed
  // inside the domain instead, so the gridlines are still round numbers and the
  // data still fills the panel.
  const min = Math.round(low * 100) / 100;
  const max = Math.round(high * 100) / 100;

  const step = niceStep((max - min) / Math.max(tickCount, 1));
  const ticks: number[] = [];
  const first = Math.ceil(min / step) * step;
  // Accumulate with a rounding guard: fractional steps drift when added up.
  for (let value = first; value <= max + step / 1000; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }

  return { min, max, ticks };
}
