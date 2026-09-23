/**
 * The report's "המלצה" paragraph.
 *
 * A direct port of the prototype's recParts join (docs/code.html:5946-5951),
 * including its order: what to do, then the harvest window, then the weather,
 * then who is scheduled to pick it. The grower reads the first sentence and
 * stops; everything after it is the justification.
 *
 * Pure, and separate from the loader, so the wording is pinned by a test rather
 * than by whoever next edits a database call.
 */

export interface RecommendationInput {
  /** computePlotStatus().headline — already a full sentence, unpunctuated. */
  headline: string;
  /** computePlotStatus().windowLine, '' when the variety has no window. */
  windowLine: string;
  /** computeUpcomingWeather().weatherLines. */
  weatherLines: string[];
  /** Resolved HARVESTER_LABELS value, or null when none is assigned. */
  harvesterLabel: string | null;
}

export function buildRecommendation({
  headline,
  windowLine,
  weatherLines,
  harvesterLabel,
}: RecommendationInput): string {
  const parts = [`${headline}.`];
  if (windowLine) parts.push(`${windowLine}.`);
  if (weatherLines.length > 0) parts.push(`${weatherLines.join(' · ')}.`);
  if (harvesterLabel) parts.push(`מוסקת משובצת: ${harvesterLabel}.`);
  return parts.join(' ');
}
