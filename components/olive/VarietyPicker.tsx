'use client';

import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { NONE } from '@/lib/forms/none-sentinel';

/**
 * Pick a plot's variety from the shared list, or name a new one.
 *
 * Replaces the free-text box on the create form — typing the name each time is
 * how "ארבקינה" and "ארבקינה " become two varieties. Same shape as GrowerPicker,
 * including the escape hatch: "זן חדש" takes a plain name, and
 * trg_areas_resolve_variety resolves it on write (exact name, alias, or a new
 * variety), which is the same path the backup import takes.
 */

/** Sentinel for "not in the list yet". Distinct from NONE, which means "none". */
export const NEW_VARIETY = '__new__';

export interface VarietyOption {
  id: string;
  name: string;
}

export interface VarietySelection {
  /** A varieties.id, NEW_VARIETY, or NONE. */
  varietyId: string;
  /** Only meaningful while varietyId is NEW_VARIETY. */
  varietyName: string;
}

interface VarietyPickerProps {
  varieties: VarietyOption[];
  value: VarietySelection;
  onChange: (next: VarietySelection) => void;
  disabled?: boolean;
}

export function VarietyPicker({ varieties, value, onChange, disabled }: VarietyPickerProps) {
  const options = [
    { value: NONE, label: '—' },
    ...varieties.map((v) => ({ value: v.id, label: v.name })),
    { value: NEW_VARIETY, label: '+ זן חדש' },
  ];

  return (
    <div className="space-y-2">
      <SearchableSelect
        options={options}
        value={value.varietyId || NONE}
        onValueChange={(next) =>
          onChange({ varietyId: next, varietyName: next === NEW_VARIETY ? value.varietyName : '' })
        }
        placeholder="בחר זן"
        searchPlaceholder="חיפוש זן..."
        emptyMessage="לא נמצאו זנים"
        disabled={disabled}
        className="h-9"
      />

      {value.varietyId === NEW_VARIETY && (
        <>
          <Input
            autoFocus
            value={value.varietyName}
            onChange={(e) => onChange({ varietyId: NEW_VARIETY, varietyName: e.target.value })}
            placeholder="שם הזן החדש"
            className="h-9"
            aria-label="שם הזן החדש"
            disabled={disabled}
          />
          <p className="olive-muted text-xs">
            אם השם רשום כשם נוסף של זן קיים, החלקה תשויך לאותו זן. אחרת הזן ייווצר ויופיע במסך
            הזנים.
          </p>
        </>
      )}
    </div>
  );
}

/** What the API should receive for this selection. */
export function varietyPayload(value: VarietySelection): {
  variety_id: string | null;
  variety: string | null;
} {
  if (value.varietyId === NEW_VARIETY) {
    const name = value.varietyName.trim();
    return { variety_id: null, variety: name || null };
  }
  if (!value.varietyId || value.varietyId === NONE) {
    return { variety_id: null, variety: null };
  }
  // The name is left to the trigger, which copies it from the chosen variety.
  return { variety_id: value.varietyId, variety: null };
}

/**
 * The initial selection for a plot that already has a variety. A variety_id
 * missing from `varieties` (another crop, or a list not loaded yet) falls back
 * to "new" carrying the stored name, rather than showing "—" and clearing the
 * variety on the next save. Same rule as initialGrowerSelection.
 */
export function initialVarietySelection(
  varietyId: string | null | undefined,
  varietyName: string | null | undefined,
  varieties: VarietyOption[]
): VarietySelection {
  if (varietyId && varieties.some((v) => v.id === varietyId)) {
    return { varietyId, varietyName: '' };
  }
  if (varietyName) {
    return { varietyId: NEW_VARIETY, varietyName };
  }
  return { varietyId: NONE, varietyName: '' };
}

/** Whether `next` would change a plot currently holding `varietyId` / `varietyName`. */
export function varietyChanged(
  next: VarietySelection,
  varietyId: string | null | undefined,
  varietyName: string | null | undefined
): boolean {
  const payload = varietyPayload(next);
  if (payload.variety_id) return payload.variety_id !== (varietyId ?? null);
  if (payload.variety) return payload.variety !== (varietyName ?? '').trim();
  return Boolean(varietyId || varietyName);
}
