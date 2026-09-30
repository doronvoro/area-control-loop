/**
 * The report's "המלצות" box: one line per measurement that calls for action.
 *
 * The client's sample report (דוח לדוגמה, 2026-09-29) replaced the prototype's
 * single paragraph — headline, window, weather, harvester — with this list, e.g.
 * "מים: צמצום השקיה (55.6%)." The headline already sits in the status pill and
 * the weather in its own ⚠ line, so the box now says only what to do per reading.
 *
 * The wording is each parameter_rules row's `message`, via evaluateParameter, so
 * there stays one place that decides what a reading means. Only `plan` and
 * `urgent` produce a line: `idle` is "nothing to do yet" and `ok` is "leave it",
 * neither of which is a recommendation — the sample shows water and omits oil
 * and dry for exactly that reason.
 *
 * Pure, and separate from the loader, so the wording is pinned by a test rather
 * than by whoever next edits a database call.
 */

import { evaluateParameter } from '@/lib/olive/logic';
import { ParameterStatus, type ParameterRule } from '@/types/database';

export interface RecommendationReading {
  oil: number | null;
  water: number | null;
  dry: number | null;
}

/** Tile order, so the list reads in the same order as the numbers above it. */
const PARAMETERS: { code: keyof RecommendationReading; label: string; digits: number }[] = [
  { code: 'oil', label: 'שמן', digits: 1 },
  { code: 'water', label: 'מים', digits: 1 },
  { code: 'dry', label: 'שמן בחו"י', digits: 2 },
];

/** Rounds, then drops trailing zeros: 55.6 → "55.6", 50 → "50", 42.50 → "42.5". */
function fmt(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

export function buildParameterRecommendations(
  rules: ParameterRule[],
  latest: RecommendationReading | null
): string[] {
  if (!latest) return [];

  const lines: string[] = [];
  for (const { code, label, digits } of PARAMETERS) {
    const value = latest[code];
    if (value === null || !Number.isFinite(value)) continue;

    const match = evaluateParameter(rules, code, value);
    if (match?.status !== ParameterStatus.PLAN && match?.status !== ParameterStatus.URGENT) {
      continue;
    }
    lines.push(`${label}: ${match.message} (${fmt(value, digits)}%).`);
  }
  return lines;
}
