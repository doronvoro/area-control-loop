'use client';

import { useState } from 'react';
import { AlertTriangle, Leaf, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AliasField } from '@/components/shared/AliasField';
import { showToast } from '@/lib/toast';
import { normalizeVarietyName } from '@/lib/olive/variety';
import type { VarietyRow } from '@/lib/varieties/variety-rows';

/**
 * A variety, in a drawer: a name and its aliases.
 *
 * Varieties are shared by every customer (20261001100000), so a rename here
 * renames the variety on every plot and harvest window that uses it — the hint
 * under the name field says so.
 *
 * Aliases are what fold "ארבקינה צעיר" into ארבקינה: the database trigger reads
 * them on every plot write, including the backup import.
 */

export type VarietyEditorState = { mode: 'create' } | { mode: 'edit'; row: VarietyRow };

interface VarietyFormSheetProps {
  editor: VarietyEditorState | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function VarietyFormSheet({ editor, onOpenChange, onSaved }: VarietyFormSheetProps) {
  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        dir="rtl"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        {editor && (
          <VarietyFormBody
            key={editor.mode === 'edit' ? `edit:${editor.row.id}` : 'create'}
            editor={editor}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VarietyFormBody({
  editor,
  onSaved,
  onClose,
}: {
  editor: VarietyEditorState;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = editor.mode === 'edit';
  const row = isEdit ? editor.row : null;

  const [name, setName] = useState(row?.name ?? '');
  const [aliases, setAliases] = useState<string[]>(row?.aliases ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = normalizeVarietyName(name);
  const renamed = isEdit && normalizedName !== row!.name;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedName) {
      setError('נדרש שם זן');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const body: Record<string, unknown> = { name: normalizedName, aliases };
      if (isEdit) body.id = row!.id;

      const response = await fetch('/api/varieties', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || (isEdit ? 'שגיאה בעדכון הזן' : 'שגיאה ביצירת הזן'));
      }

      showToast.success(isEdit ? 'הזן עודכן' : 'הזן נוצר');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'שגיאה בשמירת הזן');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="olive-form-hero shrink-0 px-6 py-5 md:px-8 md:py-6">
        <div className="olive-hero-pattern" />
        <div className="relative z-10 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Leaf className="size-5 text-white" />
          </div>
          <div className="text-center">
            <SheetTitle className="olive-hero-title text-2xl tracking-tight md:text-3xl">
              {isEdit ? row!.name : 'זן חדש'}
            </SheetTitle>
            {isEdit && (
              <p className="mt-1 text-sm text-white/75">
                {row!.plotCount > 0
                  ? `${row!.plotCount} חלקות · ${row!.totalDunam.toFixed(1)} דונם`
                  : 'ללא חלקות משויכות'}
              </p>
            )}
          </div>
        </div>
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          {error && (
            <div className="olive-error-banner flex items-center gap-3 p-4">
              <AlertTriangle className="size-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <section className="olive-section space-y-4 px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="variety-name-input">
                שם הזן *
              </label>
              <Input
                id="variety-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
                placeholder="לדוגמה: ארבקינה"
              />
              {renamed && (row!.plotCount > 0 || row!.windowCount > 0) && (
                <p className="olive-muted text-xs">
                  שינוי השם יעדכן את הזן בכל החלקות וחלונות הקטיף של כל הלקוחות.
                </p>
              )}
            </div>

            <AliasField
              id="variety-alias-input"
              aliases={aliases}
              ownName={name}
              onChange={setAliases}
              normalize={normalizeVarietyName}
              description="כתיבים אחרים של הזן, למשל עם ציון גיל ('ארבקינה צעיר'). חלקה שתישמר או תיובא עם אחד מהם תשויך לזן הזה, וגיל החלקה נגזר מתאריך הנטיעה."
              placeholder="לדוגמה: ארבקינה צעיר"
              ownNameLabel="זהו שם הזן עצמו"
            />
          </section>
        </div>

        <div className="olive-sticky-footer olive-sticky-footer--flush shrink-0">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              <X className="ml-1 size-4" />
              ביטול
            </Button>
            <button type="submit" className="olive-submit px-6 py-2.5" disabled={saving}>
              {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
              {isEdit ? 'שמור שינויים' : 'צור זן'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
