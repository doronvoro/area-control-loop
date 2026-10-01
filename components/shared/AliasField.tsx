'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Alias chips — the other names one record goes by in an import file.
 *
 * Shared by the grower and variety drawers. An alias is not free text on the
 * record: it is a key the import resolver looks names up by, so the two rules
 * that would make it ambiguous are enforced here as well as in the database —
 * no repeats, and not the record's own name. Anything cross-row (an alias that
 * is ANOTHER record's name, or already taken) is answered by the server as a
 * 409 in the drawer's banner.
 *
 * `normalize` is how the database will compare the value; the grower drawer
 * trims, the variety drawer also NFC-normalises and collapses whitespace.
 */
export function AliasField({
  id,
  aliases,
  ownName,
  onChange,
  description,
  placeholder,
  ownNameLabel,
  normalize = (value) => value.trim(),
}: {
  id: string;
  aliases: string[];
  ownName: string;
  onChange: (next: string[]) => void;
  description: string;
  placeholder: string;
  /** Shown when the draft equals the record's own name, e.g. "זהו שם המגדל עצמו". */
  ownNameLabel: string;
  normalize?: (value: string) => string;
}) {
  const [draft, setDraft] = useState('');

  const value = normalize(draft);
  const duplicate = value !== '' && aliases.includes(value);
  const isOwnName = value !== '' && value === normalize(ownName);
  const canAdd = value !== '' && !duplicate && !isOwnName;

  const add = () => {
    if (!canAdd) return;
    onChange([...aliases, value]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold" htmlFor={id}>
        שמות נוספים
      </label>
      <p className="olive-muted text-xs">{description}</p>

      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <span
              key={alias}
              className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            >
              {alias}
              <button
                type="button"
                onClick={() => onChange(aliases.filter((a) => a !== alias))}
                aria-label={`הסר את השם הנוסף ${alias}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter adds the chip instead of submitting the drawer, which would
          // save a half-typed alias and close.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!canAdd}>
          <Plus className="ml-1 size-4" />
          הוסף
        </Button>
      </div>

      {duplicate && <p className="text-destructive text-xs">השם כבר ברשימה</p>}
      {isOwnName && <p className="text-destructive text-xs">{ownNameLabel}</p>}
    </div>
  );
}
