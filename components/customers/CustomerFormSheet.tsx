'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  Building2,
  KeyRound,
  Loader2,
  MapPin,
  StickyNote,
  User,
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
import { CUSTOMER_TYPE_OPTIONS } from '@/types/database';
import type { CustomerRow } from '@/lib/customers/customer-rows';

/**
 * Customer create/edit, in a drawer.
 *
 * Replaces a Dialog that carried three fields. The table behind it now has ten
 * writable columns, which is more than a modal can hold without becoming a
 * scrolling box that covers the list it was opened from.
 *
 * TWO EMAILS, AND WHY THEY ARE IN DIFFERENT SECTIONS
 * The login email is the tenant's identity in auth.users: set once at creation,
 * changed only through the auth service. contact_email is correspondence. They
 * are routinely different, so the form never puts them side by side — the login
 * address lives under "גישה למערכת" with the password, and in edit mode it is
 * read-only with a recovery-link button where the password field was.
 */

/** Radix Select rejects '' as an item value. */
const NONE = '__none__';

/** What the drawer is open for. `null` means closed. */
export type CustomerEditorState = { mode: 'create' } | { mode: 'edit'; row: CustomerRow };

/**
 * Validation depends on the mode, so the schema is built per mode rather than
 * shared.
 *
 * The original version ended in `.refine(() => true, {})` — a no-op whose
 * comment said requiredness "will be handled in the component". It was: by an
 * imperative check in onSubmit that wrote to a local `error` string. So a
 * missing email rendered as a banner above the form rather than a message under
 * the email field, and the field itself never showed as invalid.
 *
 * superRefine puts the errors on the fields, where react-hook-form's FormMessage
 * already knows how to render them.
 */
const makeCustomerSchema = (isEditMode: boolean) =>
  z
    .object({
      name: z.string().min(1, 'שם הלקוח נדרש'),
      // Required in BOTH modes, unlike the credentials below. Existing rows
      // predate the column and carry null, so making the drawer insist on a
      // type is what backfills them — one tenant at a time, as they are edited.
      customer_type: z.string().optional(),
      description: z.string().optional(),
      contact_person: z.string().optional(),
      contact_phone: z.string().optional(),
      contact_mobile: z.string().optional(),
      contact_email: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      business_id: z.string().optional(),
      notes: z.string().optional(),
      is_active: z.boolean(),
      // Optional at the field level because editing does not resubmit
      // credentials; superRefine below makes them required on create.
      email: z.string().optional().or(z.literal('')),
      password: z.string().optional().or(z.literal('')),
    })
    .superRefine((data, ctx) => {
      if (!data.customer_type || data.customer_type === NONE) {
        ctx.addIssue({
          code: 'custom',
          path: ['customer_type'],
          message: 'נדרש לבחור סוג לקוח',
        });
      }

      if (data.contact_email && !z.string().email().safeParse(data.contact_email).success) {
        ctx.addIssue({ code: 'custom', path: ['contact_email'], message: 'אימייל לא תקין' });
      }

      if (isEditMode) return;

      if (!data.email) {
        ctx.addIssue({
          code: 'custom',
          path: ['email'],
          message: 'אימייל נדרש ליצירת לקוח חדש',
        });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'אימייל לא תקין' });
      }

      if (!data.password || data.password.length < 6) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'סיסמה חייבת להכיל לפחות 6 תווים',
        });
      }
    });

type CustomerFormData = z.infer<ReturnType<typeof makeCustomerSchema>>;

interface CustomerFormSheetProps {
  editor: CustomerEditorState | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Opens the recovery-link dialog for this customer, from the edit drawer. */
  onRecovery: (row: CustomerRow) => void;
}

export function CustomerFormSheet({
  editor,
  onOpenChange,
  onSaved,
  onRecovery,
}: CustomerFormSheetProps) {
  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent
        // side is physical, so it does not flip for RTL: "left" is the trailing
        // edge here, matching every other drawer in the app.
        side="left"
        dir="rtl"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {editor && (
          <CustomerFormBody
            // Identity key instead of a reset effect: defaultValues are computed
            // once per mount, so a refetch behind the drawer cannot overwrite
            // half-typed fields.
            key={editor.mode === 'edit' ? `edit:${editor.row.id}` : 'create'}
            editor={editor}
            onSaved={onSaved}
            onRecovery={onRecovery}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomerFormBody({
  editor,
  onSaved,
  onRecovery,
  onClose,
}: {
  editor: CustomerEditorState;
  onSaved: () => void;
  onRecovery: (row: CustomerRow) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editor.mode === 'edit';
  const row = isEdit ? editor.row : null;

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(makeCustomerSchema(isEdit)),
    defaultValues: {
      name: row?.name ?? '',
      customer_type: row?.customerType ?? NONE,
      description: row?.description ?? '',
      contact_person: row?.contactPerson ?? '',
      contact_phone: row?.contactPhone ?? '',
      contact_mobile: row?.contactMobile ?? '',
      contact_email: row?.contactEmail ?? '',
      address: row?.address ?? '',
      city: row?.city ?? '',
      business_id: row?.businessId ?? '',
      notes: row?.notes ?? '',
      is_active: row ? row.isActive : true,
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: CustomerFormData) => {
    // Requiredness is enforced by makeCustomerSchema, so onSubmit only runs on
    // valid input. `error` below is for server-side failures only.
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name: values.name,
        customer_type: values.customer_type,
        description: values.description,
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        contact_mobile: values.contact_mobile,
        contact_email: values.contact_email,
        address: values.address,
        city: values.city,
        business_id: values.business_id,
        notes: values.notes,
        is_active: values.is_active,
      };

      if (isEdit) {
        body.id = row!.id;
      } else {
        body.email = values.email?.trim();
        body.password = values.password;
      }

      const response = await fetch('/api/customers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || (isEdit ? 'שגיאה בעדכון הלקוח' : 'שגיאה ביצירת הלקוח'));
      }

      showToast.success(isEdit ? 'הלקוח עודכן בהצלחה' : 'הלקוח נוצר בהצלחה');
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : isEdit
            ? 'שגיאה בעדכון הלקוח'
            : 'שגיאה ביצירת הלקוח';
      setError(message);
      showToast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <div className="from-primary to-primary/85 text-primary-foreground relative shrink-0 bg-gradient-to-l px-6 py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Building2 className="size-5" />
          </div>
          <div>
            <SheetTitle className="text-primary-foreground text-xl tracking-tight md:text-2xl">
              {isEdit ? row!.name || 'עריכת לקוח' : 'לקוח חדש'}
            </SheetTitle>
            <p className="mt-0.5 text-sm text-white/75">
              {isEdit ? 'עדכון פרטי הלקוח' : 'פרטי הלקוח ופרטי הכניסה למערכת'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 left-4 z-10 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          {/* min-h-0 is load-bearing: a flex item defaults to min-height:auto,
              so without it overflow-y-auto never shrinks and the footer below
              gets pushed off a phone screen. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
            {error && (
              <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3 rounded-lg border p-4">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <Section icon={Building2} title="פרטי הלקוח">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>שם הלקוח *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9"
                          placeholder="שם הלקוח / החברה"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סוג לקוח *</FormLabel>
                      <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="בחר סוג" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>בחר סוג</SelectItem>
                          {CUSTOMER_TYPE_OPTIONS.map((o) => (
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
                      <FormLabel>ח.פ / ע.מ</FormLabel>
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

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>תיאור</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={2}
                          placeholder="תיאור הלקוח (אופציונלי)"
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
                      <FormLabel className="!mt-0 font-semibold">לקוח פעיל</FormLabel>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        לקוח לא פעיל נשאר במערכת ומסומן ברשימה. אין לכך השפעה על היכולת שלו
                        להתחבר.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </Section>

            <Section icon={User} title="איש קשר">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שם איש הקשר</FormLabel>
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
                      <FormLabel>טלפון</FormLabel>
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
                      <FormLabel>נייד</FormLabel>
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
                      <FormLabel>אימייל ליצירת קשר</FormLabel>
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
                      <p className="text-muted-foreground text-xs">
                        לתכתובת בלבד — אינו משמש לכניסה למערכת.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            <Section icon={MapPin} title="כתובת">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>כתובת</FormLabel>
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
                      <FormLabel>עיר</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            <Section icon={KeyRound} title="גישה למערכת">
              {isEdit ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground text-sm">אימייל לכניסה</p>
                    <p className="text-sm font-medium" dir="ltr">
                      <bdi>{row!.loginEmail ?? '—'}</bdi>
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    אימייל הכניסה והסיסמה מנוהלים בשירות ההזדהות ואינם נערכים כאן.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRecovery(row!)}
                  >
                    <KeyRound className="ml-1 size-4" />
                    קישור לאיפוס סיסמה
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>אימייל לכניסה *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type="email"
                            dir="ltr"
                            className="h-9"
                            placeholder="email@example.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>סיסמה *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type="password"
                            dir="ltr"
                            className="h-9"
                            placeholder="לפחות 6 תווים"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-muted-foreground text-xs md:col-span-2">
                    כתובת זו היא שם המשתמש לכניסה למערכת. לא ניתן לשנותה לאחר היצירה.
                  </p>
                </div>
              )}
            </Section>

            <Section icon={StickyNote} title="הערות">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={3}
                        placeholder="הערות פנימיות (אופציונלי)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </div>

          <div className="bg-background/95 sticky bottom-0 z-10 shrink-0 border-t px-6 py-3.5 backdrop-blur">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                <X className="ml-1 size-4" />
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 size-4 animate-spin" />}
                {isEdit ? 'שמור שינויים' : 'צור לקוח'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Icon className="text-primary size-4" />
        {title}
      </h3>
      {children}
    </section>
  );
}
