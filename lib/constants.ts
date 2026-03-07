// Sentinel value used in multi-select to represent "entire area" selection.
// Converted to null before sending to API.
export const ENTIRE_AREA = '__entire_area__';

// Display text for entire area selection (Hebrew)
export const ENTIRE_AREA_DISPLAY = 'כל השטח';

// Check if a sub_area_id represents the entire area
export function isEntireArea(id: string | null | undefined): boolean {
  return id === null || id === undefined || id === ENTIRE_AREA;
}

// Convert sentinel value to null for API/DB usage
export function entireAreaToNull(id: string | null | undefined): string | null {
  return isEntireArea(id) ? null : (id as string);
}

// Action status options used in action forms
export const ACTION_STATUS_OPTIONS = [
  { value: 'planned', label: 'מתוכנן' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'completed', label: 'הושלם' },
] as const;

// Get display name for a sub_area_id, with fallback for null (entire area)
export function getSubAreaDisplay(
  subArea: { display?: string | null; name?: string | null } | null | undefined
): string {
  if (!subArea) return ENTIRE_AREA_DISPLAY;
  return subArea.display || subArea.name || ENTIRE_AREA_DISPLAY;
}
