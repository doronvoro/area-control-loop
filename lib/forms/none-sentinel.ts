/**
 * The "no value" sentinel for a nullable Radix Select.
 *
 * Radix rejects '' as an item value — it reserves it for "nothing selected" —
 * so a nullable enum column needs a stand-in to round-trip through the form.
 *
 * Shared because three drawers now hold one: the plot detail sheet, the plot
 * create sheet and the NIR form. Two hand-rolled copies had already drifted to
 * the same string by luck rather than by reference.
 */

export const NONE = '__none__';

/** null/undefined from the database to a value a Select can hold. */
export function toFormValue(value: string | null | undefined): string {
  return value ?? NONE;
}

/** A Select's value back to what the column stores. */
export function fromFormValue(value: string | undefined): string | null {
  return !value || value === NONE ? null : value;
}
