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
  const parts = [name, plantYear, variety].map((part) => (part ?? '').trim());
  // A plot named after its variety ("ארבקינה", variety ארבקינה) would otherwise
  // read "ארבקינה — ארבקינה"; a part identical to the name is dropped.
  return parts
    .filter((part, i) => part !== '' && (i === 0 || part !== parts[0]))
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

/** The year part of a plot: the grower's label ("2006/7") if any, else the date's year. */
export function plantYearOf(
  label: string | null | undefined,
  plantingTime: string | null | undefined
): string {
  const text = (label ?? '').trim();
  if (text) return text;
  const year = String(plantingTime ?? '').match(/^(\d{4})/);
  return year ? year[1] : '';
}

/** The fields a plot's display name is built from. Every one may be missing. */
export interface PlotNameParts {
  name?: string | null;
  region?: string | null;
  plantYearLabel?: string | null;
  plantingTime?: string | null;
  variety?: string | null;
}

/**
 * The name every olive screen shows for a plot: "{שם} — {שנת נטיעה} — {זן}".
 *
 * Computed, never stored — areas.name stays what the client wrote, because the
 * backup import matches plots by it. "שם" is the block (olive_plot_details.region)
 * when there is one, else the plot's own name, so a partner plot called "דרום"
 * reads "דרום — 2018 — ארבקינה".
 *
 * A plot with no block whose stored name is ALREADY in this format (some
 * imported plots lost their region) is shown as stored rather than having the
 * year and variety appended a second time.
 */
export function plotDisplayName(parts: PlotNameParts): string {
  const region = (parts.region ?? '').trim();
  const name = (parts.name ?? '').trim();
  if (!region && name.includes(PLOT_NAME_SEPARATOR.trim())) return name;
  return (
    composePlotName(
      region || name,
      plantYearOf(parts.plantYearLabel, parts.plantingTime),
      parts.variety
    ) || name
  );
}

/** plotDisplayName for an `areas` row with its olive_plot_details embedded. */
export function plotDisplayNameOf(plot: {
  name?: string | null;
  variety?: string | null;
  planting_time?: string | null;
  details?: { region?: string | null; plant_year_label?: string | null } | null;
}): string {
  return plotDisplayName({
    name: plot.name,
    region: plot.details?.region,
    plantYearLabel: plot.details?.plant_year_label,
    plantingTime: plot.planting_time,
    variety: plot.variety,
  });
}

/**
 * plotDisplayNameOf for an `area` embedded in a report row
 * (`area:areas(..., details:olive_plot_details(...))`). PostgREST returns the
 * 1:1 details as an array, so the first element is taken.
 */
export function embeddedAreaDisplayName(
  area:
    | {
        name?: string | null;
        variety?: string | null;
        planting_time?: string | null;
        details?: unknown;
      }
    | null
    | undefined
): string {
  if (!area) return '';
  const details = (Array.isArray(area.details) ? area.details[0] : area.details) as
    | { region?: string | null; plant_year_label?: string | null }
    | null
    | undefined;
  return plotDisplayNameOf({ ...area, details: details ?? null });
}
