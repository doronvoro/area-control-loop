'use client';

import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { NONE } from '@/lib/forms/none-sentinel';

/**
 * Pick a plot's grower from the tenant's list, or name a new one.
 *
 * Replaces the free-text box that used to sit on both plot forms. Typing the
 * name each time is how "קיבוץ גשור" and "קיבוץ גשור " become two growers on the
 * מגדלים screen, and the count beside each one made that immediately visible.
 *
 * The escape hatch matters as much as the list: a plot is often entered before
 * anyone has set the grower up, so "מגדל חדש" takes a plain name and the
 * database resolves it — trg_olive_plot_details_resolve_grower creates the
 * grower under this plot's tenant on write. That is the same path the backup
 * import takes, so the two cannot disagree.
 */

/** Sentinel for "not in the list yet". Distinct from NONE, which means "none". */
export const NEW_GROWER = '__new__';

export interface GrowerOption {
  id: string;
  name: string;
}

export interface GrowerSelection {
  /** A growers.id, NEW_GROWER, or NONE. */
  growerId: string;
  /** Only meaningful while growerId is NEW_GROWER. */
  growerName: string;
}

interface GrowerPickerProps {
  growers: GrowerOption[];
  value: GrowerSelection;
  onChange: (next: GrowerSelection) => void;
  disabled?: boolean;
}

export function GrowerPicker({ growers, value, onChange, disabled }: GrowerPickerProps) {
  const options = [
    { value: NONE, label: '—' },
    ...growers.map((g) => ({ value: g.id, label: g.name })),
    { value: NEW_GROWER, label: '+ מגדל חדש' },
  ];

  return (
    <div className="space-y-2">
      <SearchableSelect
        options={options}
        value={value.growerId || NONE}
        onValueChange={(next) =>
          // Clear the typed name when leaving "new", so a half-typed name cannot
          // be submitted alongside a picked grower.
          onChange({ growerId: next, growerName: next === NEW_GROWER ? value.growerName : '' })
        }
        placeholder="בחר מגדל"
        searchPlaceholder="חיפוש מגדל..."
        emptyMessage="לא נמצאו מגדלים"
        disabled={disabled}
        className="h-9"
      />

      {value.growerId === NEW_GROWER && (
        <>
          <Input
            autoFocus
            value={value.growerName}
            onChange={(e) => onChange({ growerId: NEW_GROWER, growerName: e.target.value })}
            placeholder="שם המגדל החדש"
            className="h-9"
            aria-label="שם המגדל החדש"
            disabled={disabled}
          />
          <p className="olive-muted text-xs">המגדל ייווצר ויופיע במסך המגדלים.</p>
        </>
      )}
    </div>
  );
}

/**
 * The initial selection for a plot that already has a grower.
 *
 * A plot whose grower_id is set but is missing from `growers` falls back to
 * "new" carrying its existing name, rather than silently showing "—" and
 * clearing the grower on the next save.
 */
export function initialGrowerSelection(
  growerId: string | null | undefined,
  growerName: string | null | undefined,
  growers: GrowerOption[]
): GrowerSelection {
  if (growerId && growers.some((g) => g.id === growerId)) {
    return { growerId, growerName: '' };
  }
  if (growerName) {
    return { growerId: NEW_GROWER, growerName };
  }
  return { growerId: NONE, growerName: '' };
}

/** What the API should receive for this selection. */
export function growerPayload(value: GrowerSelection): {
  grower_id: string | null;
  grower_name: string | null;
} {
  if (value.growerId === NEW_GROWER) {
    const name = value.growerName.trim();
    return { grower_id: null, grower_name: name || null };
  }
  if (!value.growerId || value.growerId === NONE) {
    return { grower_id: null, grower_name: null };
  }
  // The name is left to the trigger, which copies it from the chosen grower.
  return { grower_id: value.growerId, grower_name: null };
}
