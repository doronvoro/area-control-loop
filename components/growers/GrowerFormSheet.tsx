'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  FileText,
  Loader2,
  MapPin,
  Plus,
  StickyNote,
  User,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { showToast } from '@/lib/toast';
import { NONE, fromFormValue, toFormValue } from '@/lib/forms/none-sentinel';
import { PLOT_TYPE_OPTIONS } from '@/types/database';
import type { GrowerRow } from '@/lib/growers/grower-rows';

/**
 * A grower, in a drawer.
 *
 * The same shape as the customer drawer, minus the credentials section: a grower
 * has no login. That absence is the whole reason growers are their own table
 * rather than customer rows — see 20260922100000_create_growers.sql.
 *
 * Renaming a grower renames it on its plots too, which the API does in the same
 * request. The hint under the name field says so, because otherwise the plots
 * table appearing to change by itself would look like a bug.
 *
 * "שמות נוספים" is the one field here that changes what a future IMPORT does:
 * an alias is how a merge survives the next backup, which would otherwise
 * recreate the absorbed name as its own grower (20260923120000). Aliases are
 * normally born from the merge dialog; this field is the way to add one whose
 * grower does not exist yet, and the way to undo one.
 */

/** What the drawer is open for. `null` means closed. */
export type GrowerEditorState = { mode: 'create' } | { mode: 'edit'; row: GrowerRow };

const growerSchema = z.object({
  name: z.string().min(1, 'נדרש שם מגדל'),
  grower_type: z.string().optional(),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_mobile: z.string().optional(),
  contact_email: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: 'אימייל לא תקין' }),
  address: z.string().optional(),
  city: z.string().optional(),
  business_id: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
});

type GrowerFormData = z.infer<typeof growerSchema>;

interface GrowerFormSheetProps {
  editor: GrowerEditorState | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function GrowerFormSheet({ editor, onOpenChange, onSaved }: GrowerFormSheetProps) {
  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        dir="rtl"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {editor && (
          <GrowerFormBody
            // Identity key instead of a reset effect: defaultValues are computed
            // once per mount, so a refetch behind the drawer cannot overwrite
            // half-typed fields.
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

function GrowerFormBody({
  editor,
  onSaved,
  onClose,
}: {
  editor: GrowerEditorState;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editor.mode === 'edit';
  const row = isEdit ? editor.row : null;

  // Outside react-hook-form: a chip list is not a field with a value, and a
  // useFieldArray for a string[] costs more than it explains. Seeded once per
  // mount like defaultValues, for the same reason the parent keys on the row id.
  const [aliases, setAliases] = useState<string[]>(row?.aliases ?? []);

  const form = useForm<GrowerFormData>({
    resolver: zodResolver(growerSchema),
    defaultValues: {
      name: row?.name ?? '',
      grower_type: toFormValue(row?.growerType),
      contact_person: row?.contactPerson ?? '',
      contact_phone: row?.contactPhone ?? '',
      contact_mobile: row?.contactMobile ?? '',
      contact_email: row?.contactEmail ?? '',
      address: row?.address ?? '',
      city: row?.city ?? '',
      business_id: row?.businessId ?? '',
      notes: row?.notes ?? '',
      is_active: row ? row.isActive : true,
    },
  });

  const onSubmit = async (values: GrowerFormData) => {
    try {
      setSaving(true);
      setError(null);

      const body: Record<string, unknown> = {
        name: values.name,
        grower_type: fromFormValue(values.grower_type),
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        contact_mobile: values.contact_mobile,
        contact_email: values.contact_email,
        address: values.address,
        city: values.city,
        business_id: values.business_id,
        notes: values.notes,
        is_active: values.is_active,
        aliases,
      };
      if (isEdit) body.id = row!.id;

      const response = await fetch('/api/growers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        // Where the 409 duplicate-name message lands: in the banner, beside the
        // field it is about.
        throw new Error(payload.error || (isEdit ? 'שגיאה בעדכון המגדל' : 'שגיאה ביצירת המגדל'));
      }

      showToast.success(isEdit ? 'המגדל עודכן' : 'המגדל נוצר');
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : isEdit
            ? 'שגיאה בעדכון המגדל'
            : 'שגיאה ביצירת המגדל'
      );
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
            <Users className="size-5 text-white" />
          </div>
          <div className="text-center">
            <SheetTitle className="olive-hero-title text-2xl tracking-tight md:text-3xl">
              {isEdit ? row!.name || 'עריכת מגדל' : 'מגדל חדש'}
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
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {/* Edit mode only — a grower being created has no id to report on.
              Disabled with no plots because the report would be an empty table,
              and while the form is dirty because it renders the saved rows. */}
          {isEdit && (
            <button
              type="button"
              disabled={row!.plotCount === 0 || form.formState.isDirty}
              title={
                row!.plotCount === 0
                  ? 'אין חלקות משויכות למגדל זה'
                  : form.formState.isDirty
                    ? 'שמור תחילה כדי לכלול את השינויים'
                    : undefined
              }
              onClick={() => window.open(`/olive/report/grower/${row!.id}`, '_blank', 'noopener')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
            >
              <FileText className="size-3.5" />
              דוח עונתי
            </button>
          )}
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          {/* min-h-0 is load-bearing: a flex item defaults to min-height:auto,
              so without it overflow-y-auto never shrinks and the footer below
              gets pushed off a phone screen. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
            {error && (
              <div className="olive-error-banner flex items-center gap-3 p-4">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <Users className="text-primary size-4" />
                פרטי המגדל
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-semibold">שם המגדל *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      {isEdit && row!.plotCount > 0 && (
                        <p className="olive-muted text-xs">
                          שינוי השם יעדכן גם את {row!.plotCount} החלקות המשויכות אליו.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <AliasField
                    aliases={aliases}
                    ownName={form.watch('name')}
                    onChange={setAliases}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="grower_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">סוג מגדל</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || NONE}>
                        <FormControl>
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>—</SelectItem>
                          {PLOT_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="business_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">ח.פ / ע.מ</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 tabular-nums"
                          placeholder="512345678"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="mt-4 flex items-start gap-2 space-y-0 rounded-lg border border-dashed p-3">
                    <FormControl>
                      <Checkbox
                        className="mt-0.5"
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="!mt-0 font-semibold">מגדל פעיל</FormLabel>
                      <p className="olive-muted mt-0.5 text-xs">
                        מגדל לא פעיל נשאר במערכת ומסומן ברשימה. חלקותיו אינן מושפעות.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </section>

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <User className="text-primary size-4" />
                איש קשר
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">שם איש הקשר</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">טלפון</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 tabular-nums"
                          placeholder="04-6961234"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">נייד</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 tabular-nums"
                          placeholder="050-1234567"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">אימייל</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="email"
                          dir="ltr"
                          className="h-9"
                          placeholder="office@example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <MapPin className="text-primary size-4" />
                כתובת
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-semibold">כתובת</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">עיר</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <StickyNote className="text-primary size-4" />
                הערות
              </h3>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ''} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
                {isEdit ? 'שמור שינויים' : 'צור מגדל'}
              </button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

/**
 * The alias chips.
 *
 * An alias is not free text on the grower — it is a key the import resolver
 * looks names up by, so the two rules that would make it ambiguous are enforced
 * here as well as in the database: it may not repeat, and it may not be the
 * grower's own name. Everything cross-row (an alias that is ANOTHER grower's
 * name, or already taken) can only be answered by the server, and comes back as
 * the 409 in the banner above.
 */
function AliasField({
  aliases,
  ownName,
  onChange,
}: {
  aliases: string[];
  ownName: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const duplicate = trimmed !== '' && aliases.includes(trimmed);
  const isOwnName = trimmed !== '' && trimmed === ownName.trim();
  const canAdd = trimmed !== '' && !duplicate && !isOwnName;

  const add = () => {
    if (!canAdd) return;
    onChange([...aliases, trimmed]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold" htmlFor="grower-alias-input">
        שמות נוספים
      </label>
      <p className="olive-muted text-xs">
        שמות שהמגדל מופיע תחתם בקובץ הייבוא. ייבוא שימצא אחד מהם ישייך את החלקה למגדל הזה במקום
        ליצור מגדל חדש.
      </p>

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
          id="grower-alias-input"
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
          placeholder="לדוגמה: קיבוץ גשור דרום"
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!canAdd}>
          <Plus className="ml-1 size-4" />
          הוסף
        </Button>
      </div>

      {duplicate && <p className="text-destructive text-xs">השם כבר ברשימה</p>}
      {isOwnName && <p className="text-destructive text-xs">זהו שם המגדל עצמו</p>}
    </div>
  );
}
