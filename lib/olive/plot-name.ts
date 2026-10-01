/**
 * The client's plot-name convention: "{שם} — {שנת נטיעה} — {זן}", e.g.
 * "זית בוגר (מיצר) — 2003 — ארבקינה". The separator is an em dash with a space
 * each side, the exact form the client's own dashboard writes.
 */
export const PLOT_NAME_SEPARATOR = ' — ';

/** Joins the parts that are filled in; an empty part is skipped, not left blank. */
export function composePlotName(
  name: string | null | undefined,
  plantYear: string | null | undefined,
  variety: string | null | undefined
): string {
  return [name, plantYear, variety]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(PLOT_NAME_SEPARATOR);
}

/**
 * The planting year as the name shows it. While the date is untouched the
 * grower's own label wins ("2006/7" — July 2006 — not "2006"); once a new date
 * is picked, its year.
 */
export function plantYearForName(
  plantingTime: string | null | undefined,
  initialPlantingTime: string,
  label: string | null | undefined
): string {
  const date = (plantingTime ?? '').trim();
  if (date === initialPlantingTime && label) return label;
  const year = date.match(/^(\d{4})/);
  return year ? year[1] : '';
}
