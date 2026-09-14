'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { showToast } from '@/lib/toast';

import { classifyPlotCategory, type NirLike, type PlotCategory } from '@/lib/olive/logic';
import { toCategoryThresholds } from '@/lib/olive/adapt';
import { PLOT_CATEGORY_CARDS, DEFAULT_CATEGORY_THRESHOLDS } from '@/lib/olive/constants';
import {
  ALERT_BAND_FIELDS,
  ALERT_FIELD_NAMES,
  CATEGORY_FIELD_NAMES,
  DEFAULT_ALERT_BOUNDS,
  alertToForm,
  applyAlertBounds,
  categoryToForm,
  parseThresholdForm,
  readAlertBounds,
  toCategoryColumns,
  validateThresholdForm,
  warnCategoryThresholds,
  type AlertParameterCode,
} from '@/lib/olive/thresholds';
import { PARAMETER_STATUS_CONFIG, type ParameterRule } from '@/types/database';

/**
 * Editor for the two threshold sets that decide harvest status.
 *
 * WHY THE TWO TABS ARE NOT ONE SCREEN
 * They answer different questions, and treating them as interchangeable is what
 * made תקינה unreachable — the cards read 43/0/7/0 where the prototype read
 * 37/6/7/0. So the tabs are labelled for the job each one does, and each panel
 * opens by saying which part of the app it moves.
 *
 * The values themselves come from the dashboard payload the parent already
 * loaded, so opening this costs no request. Validation is lib/olive/thresholds,
 * the same module the two PUT routes validate with, so the form cannot accept a
 * tuning the server refuses.
 */

// --- Form schema ---

/**
 * Every field is a string in the form and a number on the wire — the repo's
 * numeric convention (NirFormSheet, WeatherPageContent), which keeps a
 * half-typed "1" from becoming the number 1 mid-keystroke.
 */
const bandField = z
  .string()
  .min(1, 'נדרש ערך')
  .refine((v) => Number.isFinite(Number(v)), { message: 'נדרש מספר' })
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, { message: 'נדרש ערך בין 0 ל-100' });

const ALL_FIELD_NAMES = [...CATEGORY_FIELD_NAMES, ...ALERT_FIELD_NAMES];

const thresholdsSchema = z
  .object(Object.fromEntries(ALL_FIELD_NAMES.map((name) => [name, bandField])))
  // Per-field rules live above, where they land under the input for free. Every
  // cross-field rule comes from the shared module, so the form and the server
  // cannot disagree about which tunings are legal.
  .superRefine((values, ctx) => {
    for (const issue of validateThresholdForm(values as Record<string, unknown>)) {
      ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
    }
  });

type ThresholdsForm = Record<string, string>;

// --- Display metadata ---

/** Mirrors the `parameters` seed. Only the three parameters that carry rules. */
const PARAMETER_LABELS: Record<AlertParameterCode, string> = {
  oil: 'אחוז שמן',
  water: 'אחוז מים',
  dry: 'אחוז שמן בחומר יבש',
};

const EMPTY_COUNTS: Record<PlotCategory, number> = {
  testing: 0,
  normal: 0,
  anomaly: 0,
  ready: 0,
};

export interface OliveThresholdsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plot_category_thresholds row as the dashboard payload carries it. Null when the row is missing. */
  categoryThresholds: Record<string, unknown> | null;
  rules: ParameterRule[];
  /** Latest NIR per visible plot — the live preview's only input. */
  nirs: (NirLike | null)[];
  /** What the cards read right now, for the "before" side of the preview. */
  currentCounts: Record<PlotCategory, number>;
  onSaved: () => void;
}

export function OliveThresholdsDialog({
  open,
  onOpenChange,
  categoryThresholds,
  rules,
  nirs,
  currentCounts,
  onSaved,
}: OliveThresholdsDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('category');

  const form = useForm<ThresholdsForm>({
    resolver: zodResolver(thresholdsSchema) as never,
    // onChange rather than the repo's usual onSubmit, because the preview below
    // withdraws the moment a value stops parsing and tells the user to fix the
    // marked fields. On submit-only validation nothing is marked yet, so that
    // sentence points at nothing and the dialog looks broken.
    mode: 'onChange',
    defaultValues: {
      ...categoryToForm(DEFAULT_CATEGORY_THRESHOLDS),
      ...alertToForm(DEFAULT_ALERT_BOUNDS),
    },
  });

  /**
   * Seed on open, never while open — re-seeding mid-edit would eat whatever the
   * user had typed. The cost is that a dialog left open overnight saves against
   * what the page last fetched; the population here is two people, so that is
   * the right trade.
   */
  useEffect(() => {
    if (!open) return;
    form.reset({
      ...categoryToForm(toCategoryThresholds(categoryThresholds)),
      ...alertToForm(readAlertBounds(rules)),
    });
    setError(null);
    setTab('category');
  }, [open, categoryThresholds, rules, form]);

  // --- Live preview ---

  const watched = useWatch({ control: form.control }) as Record<string, string>;
  const watchKey = JSON.stringify(watched);

  /**
   * What the cards would read after saving.
   *
   * Classified against `previewRules`, not the loaded rules, because the
   * dry-matter bound on the SECOND tab feeds classifyPlotCategory's anomaly
   * branch — edit it and the card counts move. That is also why this strip sits
   * outside the tabs and stays visible from both.
   *
   * No debounce: fifty plots against ten rules is microseconds, and a debounce
   * would add real lag to hide a cost that does not exist. The memo is keyed on
   * the serialised values, which is cheaper than the work it guards.
   */
  // watchKey stands in for `watched`, whose identity changes every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parsed = useMemo(() => parseThresholdForm(watched ?? {}), [watchKey]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;

    const previewRules = applyAlertBounds(rules, parsed.value.bounds);
    const counts = { ...EMPTY_COUNTS };
    for (const nir of nirs) {
      counts[classifyPlotCategory(nir, previewRules, parsed.value.bands)] += 1;
    }

    return { counts, warnings: warnCategoryThresholds(parsed.value.bands) };
  }, [parsed, rules, nirs]);

  /**
   * What is currently wrong, read from the parse rather than from formState.
   *
   * react-hook-form surfaces an error only on the field being edited, and a
   * cross-field rule lands on the OTHER field: type 30 into ready_oil_min and
   * the complaint belongs to ready_oil_max, which nobody has touched, so
   * nothing appears until submit. The preview has already withdrawn by then and
   * tells the user to fix the marked fields — with no field marked.
   *
   * These come from the same parse the preview uses, so the two can never
   * disagree about whether the form is currently valid. FormMessage still
   * renders per-field errors under the inputs on submit.
   */
  const issues = parsed.ok ? [] : parsed.errors;

  // Errors can also belong to the tab you are not looking at.
  const categoryErrors = issues.filter((i) => CATEGORY_FIELD_NAMES.includes(i.field)).length;
  const alertErrors = issues.filter((i) =>
    (ALERT_FIELD_NAMES as string[]).includes(i.field)
  ).length;

  // --- Save ---

  const onSubmit = async (values: ThresholdsForm) => {
    const dirty = form.formState.dirtyFields as Record<string, boolean | undefined>;
    const categoryDirty = CATEGORY_FIELD_NAMES.some((name) => dirty[name]);
    const alertDirty = (ALERT_FIELD_NAMES as string[]).some((name) => dirty[name]);

    if (!categoryDirty && !alertDirty) {
      onOpenChange(false);
      return;
    }

    const parsed = parseThresholdForm(values);
    if (!parsed.ok) {
      setError(parsed.errors[0].message);
      return;
    }

    setSaving(true);
    setError(null);

    // Sequential, category first, so a failure is ordered: either nothing was
    // written, or the card bands were and the alert bands were not. Never
    // Promise.all, which would make a partial failure unordered as well.
    let categorySaved = false;

    try {
      if (categoryDirty) {
        await put('/api/olive/category-thresholds', toCategoryColumns(parsed.value.bands));
        categorySaved = true;
      }

      if (alertDirty) {
        await put('/api/olive/parameters', { bounds: parsed.value.bounds });

        // That GET is browser-cached for five minutes, so without this the
        // editor's own NIR page would show the old pills and read as a failed
        // save. `reload` bypasses the entry and replaces it.
        await fetch('/api/olive/parameters', { cache: 'reload' }).catch(() => undefined);
      }

      showToast.success('הספים נשמרו');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת הספים';
      const field = (err as { field?: string }).field;

      if (field && ALL_FIELD_NAMES.includes(field)) {
        form.setError(field, { message });
        setTab(CATEGORY_FIELD_NAMES.includes(field) ? 'category' : 'alert');
      }

      // Retrying re-sends both halves. Both writes are idempotent and the bounds
      // updater diffs before writing, so a repeat costs one no-op request and
      // saves an entire class of "what already landed" bookkeeping.
      setError(
        categorySaved
          ? `ספי כרטיסי הסטטוס נשמרו, אך ספי ההתראות לא — ${message}. אפשר לנסות שוב.`
          : message
      );
      if (categorySaved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  const restore = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
      form.setValue(name, value, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>הגדרת ספי מסיק</DialogTitle>
          <DialogDescription>
            הספים שמחליטים את סטטוס החלקות. הם משותפים לכל הלקוחות במערכת.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="category" className="flex-1">
                  כרטיסי סטטוס
                  {categoryErrors > 0 && <ErrorCount count={categoryErrors} />}
                </TabsTrigger>
                <TabsTrigger value="alert" className="flex-1">
                  ספי התראות
                  {alertErrors > 0 && <ErrorCount count={alertErrors} />}
                </TabsTrigger>
              </TabsList>

              {/* Dialog has no max-height of its own and there is no scroll-area
                  component, so without this the second tab runs off a phone
                  screen with no way to reach Save. */}
              <div className="mt-4 max-h-[50vh] overflow-y-auto pe-1">
                <TabsContent value="category" className="mt-0">
                  <CategoryTab form={form} onRestore={restore} />
                </TabsContent>
                <TabsContent value="alert" className="mt-0">
                  <AlertTab form={form} rules={rules} onRestore={restore} />
                </TabsContent>
              </div>
            </Tabs>

            <Separator />

            <PreviewStrip before={currentCounts} after={preview?.counts ?? null} />

            {issues.map((issue) => (
              <p
                key={`${issue.field}:${issue.message}`}
                className="flex items-start gap-2 text-xs text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {issue.message}
              </p>
            ))}

            {preview?.warnings.map((warning) => (
              <p key={warning} className="olive-muted flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {warning}
              </p>
            ))}

            <p className="olive-muted flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              הספים גלובליים — שמירה משנה את הסטטוסים אצל כל הלקוחות במערכת, לא רק בחשבון זה.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 size-4 animate-spin" />}
                {saving ? 'שומר...' : 'שמור'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Tabs ---

type FormApi = ReturnType<typeof useForm<ThresholdsForm>>;

function CategoryTab({
  form,
  onRestore,
}: {
  form: FormApi;
  onRestore: (values: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-4">
      <PanelHeader
        note="הספים שמחליטים לאיזה כרטיס כל חלקה שייכת בראש המסך. אינם משפיעים על דירוג הדחיפות."
        onRestore={() => onRestore(categoryToForm(DEFAULT_CATEGORY_THRESHOLDS))}
      />

      <BandGroup title="מוכן למסיק" note="חלקה נכנסת לכרטיס הזה רק כששני הערכים בתוך הטווח.">
        <BandInput form={form} name="ready_oil_min" label="אחוז שמן — מ־" />
        <BandInput form={form} name="ready_oil_max" label="עד" />
        <BandInput form={form} name="ready_water_min" label="אחוז מים — מ־" />
        <BandInput form={form} name="ready_water_max" label="עד" />
      </BandGroup>

      <BandGroup title="חריגות" note="חלקה נחשבת חריגה כשאחוז המים שלה מחוץ לטווח הזה.">
        <BandInput form={form} name="anomaly_water_low" label="גבול תחתון" />
        <BandInput form={form} name="anomaly_water_high" label="גבול עליון" />
        <p className="olive-muted col-span-2 text-xs">
          בנוסף — חלקה שאחוז השמן בחומר היבש שלה הגיע לטווח &quot;מסיק&quot; (בלשונית ספי התראות)
          מסומנת אף היא כחריגה.
        </p>
      </BandGroup>

      <BandGroup title="חלקות תקינות" note="נדגמה, השמן עדיין בעלייה, והמים בטווח.">
        <BandInput form={form} name="normal_oil_max" label="אחוז שמן עד" />
        <BandInput form={form} name="normal_water_max" label="אחוז מים עד" />
      </BandGroup>
    </div>
  );
}

function AlertTab({
  form,
  rules,
  onRestore,
}: {
  form: FormApi;
  rules: ParameterRule[];
  onRestore: (values: Record<string, string>) => void;
}) {
  const parameters: AlertParameterCode[] = ['oil', 'water', 'dry'];

  return (
    <div className="space-y-4">
      <PanelHeader
        note='הספים שמחליטים את רמת הדחיפות ואת תגית הסטטוס בבדיקות NIR. משפיעים על "מבט על — מה דחוף עכשיו" ועל מסך הבדיקות.'
        onRestore={() => onRestore(alertToForm(DEFAULT_ALERT_BOUNDS))}
      />

      {parameters.map((code) => {
        const cascade = rules
          .filter((r) => r.parameter_code === code)
          .sort((a, b) => a.sort_order - b.sort_order);

        if (cascade.length === 0) return null;

        return (
          <div key={code} className="olive-card space-y-2 p-3">
            <h3 className="text-sm font-bold">{PARAMETER_LABELS[code]}</h3>

            {cascade.map((row) => {
              const field = ALERT_BAND_FIELDS.find(
                (f) => f.parameterCode === code && f.sortOrder === row.sort_order
              );
              const pill = PARAMETER_STATUS_CONFIG[row.status].pillClass;

              return (
                <div key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`olive-pill ${pill} shrink-0`}>{row.message}</span>

                  {field && row.upper_bound !== null ? (
                    <>
                      {/* Words, not `<` and `≤`. Those are bidi-mirrored glyphs:
                          in this RTL page a lone `<` renders as `>`, and which
                          quantity the open side belongs to stops being obvious.
                          Still read from the row — upper_inclusive is not
                          editable here, and hardcoding either phrase would lie
                          the moment someone flips the flag in SQL. */}
                      <span className="olive-muted shrink-0">
                        {row.upper_inclusive ? 'עד (כולל)' : 'מתחת ל־'}
                      </span>
                      <FormField
                        control={form.control}
                        name={field.key}
                        render={({ field: input }) => (
                          <FormItem className="w-28">
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                inputMode="decimal"
                                className="h-9"
                                aria-label={field.label}
                                {...input}
                                value={input.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <span className="olive-muted">מעל הסף הקודם — ללא גבול עליון</span>
                  )}
                </div>
              );
            })}

            {code === 'dry' && (
              <p className="olive-muted text-xs">
                טווח &quot;מסיק&quot; כאן מסמן את החלקה כחריגה גם בכרטיסי הסטטוס.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Pieces ---

function PanelHeader({ note, onRestore }: { note: string; onRestore: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="olive-muted text-xs">{note}</p>
      {/* Writes to the form only, so restoring defaults is previewable like any
          other edit rather than an irreversible button. */}
      <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onRestore}>
        <RotateCcw className="ml-1 size-3.5" />
        שחזר ברירות מחדל
      </Button>
    </div>
  );
}

function BandGroup({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="olive-card space-y-2 p-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="olive-muted text-xs">{note}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function BandInput({ form, name, label }: { form: FormApi; name: string; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              className="h-9"
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * The four cards as they are now and as they would be.
 *
 * Deliberately the same labels and colours as the real cards, and deliberately
 * not buttons: this previews the dashboard, it is not a second copy of it.
 */
function PreviewStrip({
  before,
  after,
}: {
  before: Record<PlotCategory, number>;
  after: Record<PlotCategory, number> | null;
}) {
  const unchanged =
    after !== null && PLOT_CATEGORY_CARDS.every((card) => before[card.key] === after[card.key]);

  return (
    <section aria-live="polite" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">תצוגה מקדימה</h3>
        {after === null ? (
          <span className="text-xs text-destructive">לא ניתן לחשב — ראו את השגיאות מטה.</span>
        ) : (
          unchanged && <span className="olive-muted text-xs">ללא שינוי</span>
        )}
      </div>

      {/* The big number is the RESULT, with the current value demoted to a
          caption beneath it. An inline "37 → 43" was the obvious first shape and
          the wrong one: bidi reorders it in this RTL page so it renders as
          "43 → 37" and reads exactly backwards, and "(+6)" comes out "(6+)". */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {PLOT_CATEGORY_CARDS.map((card) => {
          const next = after?.[card.key];
          const changed = next !== undefined && next !== before[card.key];

          return (
            <div
              key={card.key}
              className={`${card.className} rounded-2xl border px-2 py-2.5 text-center`}
            >
              <div className="olive-status-count">{next ?? '—'}</div>
              <div className="olive-status-label">{card.label}</div>
              {changed && (
                <div className="mt-0.5 text-[0.65rem] opacity-70">היה {before[card.key]}</div>
              )}
            </div>
          );
        })}
      </div>

      <p className="olive-muted text-xs">התצוגה המקדימה מחושבת על החלקות המוצגות במסך זה בלבד.</p>
    </section>
  );
}

function ErrorCount({ count }: { count: number }) {
  return (
    <span className="ms-1.5 rounded-full bg-destructive px-1.5 text-xs font-bold text-white">
      {count}
    </span>
  );
}

// --- Fetch helper ---

/** PUT with the route's Hebrew message, and the field it belongs to when there is one. */
async function put(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'שגיאה בשמירת הספים');
    (error as { field?: string }).field = payload.field;
    throw error;
  }

  return response.json();
}
