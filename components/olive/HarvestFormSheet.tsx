'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, Check, Flag, Loader2, MapPin, Scale, Tractor, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { HARVESTER_OPTIONS } from '@/types/database';
import type { ApiPlot } from '@/lib/olive/adapt';
import type { HarvestRow } from '@/lib/olive/harvest-rows';

/**
 * Harvest pass entry, in a drawer.
 *
 * The form is unchanged from when it owned the whole page — hero, steps,
 * sectioned cards, sticky submit, and the live readout comparing what this pass
 * actually achieved against the per-dunam figure the season was planned on.
 *
 * What is new is editing. The PUT endpoint has existed all along and nothing
 * ever called it, so a mistyped weight could only be deleted and re-entered —
 * which, because the server derives pass_number from the highest pass on
 * record, silently left a gap in the numbering.
 *
 * pass_number is still absent from the form: the server owns it. In create mode
 * there is nothing to show yet (the old page guessed from the loaded list, and
 * a season-scoped list makes that guess wrong); in edit mode the real number is
 * shown read-only.
 */

const NONE = '__none__';

/** What the drawer is open for. `null` means closed. */
export type HarvestEditorState =
  | { mode: 'create'; areaId: string | null }
  | { mode: 'edit'; row: HarvestRow };

const numericField = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'נדרש מספר' });

/** Weights and areas cannot be negative; nothing in the table enforces it. */
const nonNegativeField = numericField.refine((v) => !v || Number(v) >= 0, {
  message: 'נדרש ערך חיובי',
});

const harvestSchema = z.object({
  area_id: z.string().min(1, 'נדרש לבחור חלקה'),
  report_date: z.string().min(1, 'נדרש תאריך'),
  sub_area_id: z.string().optional(),
  harvester_type: z.string().optional(),
  operator: z.string().optional(),
  area_done_dunam: nonNegativeField,
  fruit_kg: nonNegativeField,
  oil_kg: nonNegativeField,
  is_final: z.boolean().optional(),
  notes: z.string().optional(),
});

type HarvestFormData = z.infer<typeof harvestSchema>;

const STEPS = [
  { label: 'חלקה', icon: MapPin },
  { label: 'ציוד', icon: Tractor },
  { label: 'תוצאות', icon: Scale },
];

const RESULTS: { name: keyof HarvestFormData; label: string; step: string }[] = [
  { name: 'area_done_dunam', label: 'שטח שנמסק (דונם)', step: '0.1' },
  { name: 'fruit_kg', label: 'סה״כ פרי (ק״ג)', step: '1' },
  { name: 'oil_kg', label: 'סה״כ שמן (ק״ג)', step: '1' },
];

const RESULT_NAMES = RESULTS.map((f) => f.name);

function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function optionalNumber(value?: string) {
  if (value === undefined || value.trim() === '') return null;
  return Number(value);
}

const EMPTY_FORM = {
  report_date: todayString(),
  sub_area_id: NONE,
  harvester_type: NONE,
  operator: '',
  area_done_dunam: '',
  fruit_kg: '',
  oil_kg: '',
  is_final: false,
  notes: '',
};

function defaultsFor(editor: HarvestEditorState): HarvestFormData {
  if (editor.mode === 'create') {
    return { area_id: editor.areaId ?? '', ...EMPTY_FORM };
  }

  const { row } = editor;
  const str = (n: number | null) => (n != null ? String(n) : '');

  return {
    area_id: row.areaId ?? '',
    report_date: row.reportDate ?? todayString(),
    sub_area_id: row.subAreaId ?? NONE,
    harvester_type: row.harvesterType ?? NONE,
    operator: row.operator ?? '',
    area_done_dunam: str(row.areaDoneDunam),
    fruit_kg: str(row.fruitKg),
    oil_kg: str(row.oilKg),
    is_final: row.isFinal,
    notes: row.notes,
  };
}

interface HarvestFormSheetProps {
  editor: HarvestEditorState | null;
  onOpenChange: (open: boolean) => void;
  plots: ApiPlot[];
  /** Per-area planned yield, keyed by area id, for the live readout. */
  estimates: Record<string, { kg_per_dunam?: unknown }>;
  onSaved: () => void;
  /**
   * Opened on top of another drawer. Narrows this one and lightens its scrim so
   * the drawer underneath stays visible rather than being buried.
   */
  stacked?: boolean;
  /** The plot is implied by where this was opened from — show it, fix it. */
  lockPlot?: boolean;
}

export function HarvestFormSheet({
  editor,
  onOpenChange,
  plots,
  estimates,
  onSaved,
  stacked = false,
  lockPlot = false,
}: HarvestFormSheetProps) {
  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent
        // side is physical in this component, so it does not flip for RTL:
        // "left" is the trailing edge here, matching the NIR drawer.
        side="left"
        dir="rtl"
        showCloseButton={false}
        // Stacked, this is 576px against the plot drawer's 672px, so ~96px of
        // it stays visible — in RTL, its leading edge rather than its margin.
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          stacked ? 'sm:max-w-xl sm:shadow-2xl' : 'sm:max-w-2xl'
        )}
        // A second bg-black/50 over the first composites to 75% black.
        overlayClassName={stacked ? 'bg-black/20' : undefined}
        aria-describedby={undefined}
      >
        {editor && (
          <HarvestFormBody
            // Identity key instead of a reset effect: defaultValues are computed
            // once per mount. Stable across a create-save, which is what lets
            // the plot and date survive it.
            key={editor.mode === 'edit' ? `edit:${editor.row.id}` : `create:${editor.areaId ?? ''}`}
            editor={editor}
            plots={plots}
            estimates={estimates}
            lockPlot={lockPlot}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function HarvestFormBody({
  editor,
  plots,
  estimates,
  lockPlot,
  onSaved,
  onClose,
}: {
  editor: HarvestEditorState;
  plots: ApiPlot[];
  estimates: Record<string, { kg_per_dunam?: unknown }>;
  lockPlot: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = editor.mode === 'edit';
  const editingId = isEdit ? editor.row.id : null;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<Set<number>>(new Set());
  const prevStep = useRef(isEdit ? 2 : 0);

  const form = useForm<HarvestFormData>({
    resolver: zodResolver(harvestSchema),
    defaultValues: defaultsFor(editor),
  });

  const { control } = form;
  // Scoped watches. A bare form.watch() subscribes the whole subtree to every
  // keystroke, which is what the old single-component page did.
  const areaId = useWatch({ control, name: 'area_id' });
  const harvesterType = useWatch({ control, name: 'harvester_type' });
  const operator = useWatch({ control, name: 'operator' });
  const results = useWatch({ control, name: RESULT_NAMES as (keyof HarvestFormData)[] });
  const [areaDone, fruit, oil] = results;

  const plotOptions = useMemo(
    () =>
      plots.map((p) => ({
        value: p.id,
        label: [p.name, p.variety].filter(Boolean).join(' · '),
      })),
    [plots]
  );

  const selectedPlot = useMemo(() => plots.find((p) => p.id === areaId), [plots, areaId]);
  const takts = selectedPlot?.takts ?? [];

  const hasEquipment =
    (!!harvesterType && harvesterType !== NONE) || !!(operator as string | undefined)?.trim();
  const hasResult = results.some((v) => !!v && String(v).trim() !== '');

  const currentStep = !areaId ? 0 : !hasEquipment && !hasResult ? 1 : 2;

  useEffect(() => {
    if (currentStep > prevStep.current) {
      const newly = new Set<number>();
      for (let i = prevStep.current; i < currentStep; i++) newly.add(i);
      setJustCompleted(newly);
      const timer = setTimeout(() => setJustCompleted(new Set()), 600);
      prevStep.current = currentStep;
      return () => clearTimeout(timer);
    }
    prevStep.current = currentStep;
  }, [currentStep]);

  /**
   * Live readout: what this pass actually achieved, against what was expected.
   *
   * Both figures are derived rather than entered — yield per dunam is the number
   * the season was planned on, so seeing it the moment the weights go in is the
   * point of recording them here at all.
   */
  const readout = useMemo(() => {
    const dunam = optionalNumber(areaDone as string | undefined);
    const fruitKg = optionalNumber(fruit as string | undefined);
    const oilKg = optionalNumber(oil as string | undefined);
    const rows: { label: string; value: string; hint?: string; tone?: string }[] = [];

    if (fruitKg !== null && dunam !== null && dunam > 0) {
      const perDunam = fruitKg / dunam;
      const expected = Number(estimates[areaId]?.kg_per_dunam);
      let hint: string | undefined;
      let tone: string | undefined;

      if (Number.isFinite(expected) && expected > 0) {
        const diff = Math.round(((perDunam - expected) / expected) * 100);
        hint = `צפי ${Math.round(expected)} · ${diff >= 0 ? '+' : ''}${diff}%`;
        tone = diff >= 0 ? 'olive-pill-ok' : diff >= -20 ? 'olive-pill-plan' : 'olive-pill-urgent';
      }
      rows.push({ label: 'ק״ג פרי לדונם', value: perDunam.toFixed(0), hint, tone });
    }

    if (fruitKg !== null && fruitKg > 0 && oilKg !== null) {
      rows.push({ label: 'אחוז שמן מהפרי', value: `${((oilKg / fruitKg) * 100).toFixed(1)}%` });
    }

    return rows;
  }, [areaDone, fruit, oil, estimates, areaId]);

  const onSubmit = async (values: HarvestFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/olive/harvest', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { report_area_id: editingId } : { area_id: values.area_id }),
          report_date: values.report_date,
          sub_area_id: values.sub_area_id === NONE ? null : values.sub_area_id || null,
          harvester_type: values.harvester_type === NONE ? null : values.harvester_type || null,
          operator: values.operator || null,
          area_done_dunam: optionalNumber(values.area_done_dunam),
          fruit_kg: optionalNumber(values.fruit_kg),
          oil_kg: optionalNumber(values.oil_kg),
          is_final: Boolean(values.is_final),
          notes: values.notes || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת דוח המסיק');
      }

      const saved = await response.json().catch(() => ({}));
      showToast.success(editingId ? 'הדוח עודכן' : 'דוח המסיק נשמר');
      onSaved();

      if (editingId) {
        onClose();
        return;
      }

      // The pass number comes back from the server, which is the only place
      // that knows it — the old page guessed from the loaded list.
      const plotName = selectedPlot?.name ?? '';
      const pass = saved?.detail?.pass_number;
      const passLabel = pass ? `מעבר ${pass}` : 'המעבר';
      setSuccess(
        values.is_final
          ? `${passLabel} נשמר — ${plotName} סומנה כנמסקה`
          : `${passLabel} נשמר — ${plotName}`
      );

      // Stay open and keep the plot and date: several passes get logged in a row.
      form.reset({ ...form.getValues(), ...EMPTY_FORM, report_date: values.report_date });
      prevStep.current = 1;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <div className="olive-form-hero shrink-0 px-6 py-5 md:px-8 md:py-6">
        <div className="olive-hero-pattern" />
        <div className="relative z-10 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Tractor className="size-5 text-white" />
          </div>
          <SheetTitle className="olive-hero-title text-2xl tracking-tight md:text-3xl">
            {isEdit ? `עריכת מעבר ${editor.row.passNumber ?? ''}`.trim() : 'רישום מעבר מסיק'}
          </SheetTitle>
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

      {/* Progress — only while creating. Over a saved pass it is just noise. */}
      {!isEdit && (
        <div className="olive-steps shrink-0">
          {STEPS.map((step, i) => (
            <div key={step.label} className="olive-step">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`olive-step-circle ${
                    i < currentStep
                      ? 'olive-step-complete'
                      : i === currentStep
                        ? 'olive-step-active'
                        : 'olive-step-pending'
                  } ${justCompleted.has(i) ? 'olive-step-just-completed' : ''}`}
                >
                  {i < currentStep ? (
                    <Check className="size-3.5" />
                  ) : (
                    <step.icon className="size-3.5" />
                  )}
                </div>
                <span
                  className={`olive-step-label ${i === currentStep ? 'olive-step-label-active' : ''}`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`olive-step-connector ${
                    i < currentStep ? 'olive-step-connector-complete' : ''
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

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
            {success && (
              <div className="olive-success-banner flex items-center gap-3 p-4">
                <Check className="size-5 shrink-0" />
                <p className="text-sm font-bold">{success}</p>
              </div>
            )}

            {/* 1 — plot and date */}
            <section
              className={`olive-section olive-section-plot px-5 py-4 ${
                currentStep > 0 ? 'olive-section-completed' : ''
              }`}
            >
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-plot">
                  <MapPin className="size-4" />
                </div>
                <h3 className="text-base font-bold">חלקה ותאריך</h3>
                {areaId && (
                  <span className="olive-field-check">
                    <Check className="size-2.5" />
                  </span>
                )}
                {isEdit && editor.row.passNumber !== null && (
                  <span className="olive-pill olive-pill-idle mr-auto">
                    מעבר {editor.row.passNumber}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">חלקה *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={plotOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="בחר חלקה"
                          searchPlaceholder="חיפוש חלקה..."
                          // Two independent reasons to fix it: once saved, the
                          // pass number was derived from this plot's history so
                          // moving the pass would renumber two plots at once;
                          // and opened from a plot's own drawer, the plot is
                          // what you opened.
                          disabled={isEdit || lockPlot}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="report_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">תאריך *</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="olive-muted mt-3 text-xs">
                {isEdit
                  ? 'מספר המעבר נקבע בעת השמירה ואינו ניתן לשינוי.'
                  : 'מספר המעבר נקבע אוטומטית מהמעברים שכבר נרשמו בחלקה.'}
              </p>
            </section>

            {/* 2 — equipment */}
            <section
              className={`olive-section olive-section-sample px-5 py-4 ${
                currentStep > 1 ? 'olive-section-completed' : ''
              }`}
            >
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-sample">
                  <Tractor className="size-4" />
                </div>
                <h3 className="text-base font-bold">ציוד ומיקום</h3>
                {hasEquipment && (
                  <span className="olive-field-check">
                    <Check className="size-2.5" />
                  </span>
                )}
                <span className="olive-muted mr-auto text-xs">לא חובה</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="sub_area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">טאקט</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || NONE}
                        disabled={!areaId}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue
                              placeholder={
                                !areaId
                                  ? 'בחר חלקה תחילה'
                                  : takts.length
                                    ? 'כל החלקה'
                                    : 'אין טאקטים בחלקה זו'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>כל החלקה</SelectItem>
                          {takts.map((takt) => (
                            <SelectItem key={takt.id} value={takt.id}>
                              {takt.name}
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
                  name="harvester_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">סוג מוסקת</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || NONE}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>—</SelectItem>
                          {HARVESTER_OPTIONS.map((o) => (
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
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">מפעיל</FormLabel>
                      <FormControl>
                        <Input className="h-9" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 3 — results */}
            <section className="olive-section olive-section-values px-5 py-4">
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-values">
                  <Scale className="size-4" />
                </div>
                <h3 className="text-base font-bold">תוצאות המעבר</h3>
                {hasResult && (
                  <span className="olive-field-check">
                    <Check className="size-2.5" />
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {RESULTS.map((f) => (
                  <FormField
                    key={f.name}
                    control={form.control}
                    name={f.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{f.label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={f.step}
                            inputMode="decimal"
                            className="h-9"
                            {...field}
                            value={(field.value as string) ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {/* Live readout — achieved vs what the season was planned on */}
              {readout.length > 0 && (
                <div className="olive-readout mt-4">
                  <span className="olive-muted text-xs font-semibold">לפי הערכים שהוזנו:</span>
                  {readout.map((row) => (
                    <span key={row.label} className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold">
                        {row.label} {row.value}
                      </span>
                      {row.hint && (
                        <span className={`olive-pill ${row.tone ?? 'olive-pill-idle'}`}>
                          {row.hint}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <FormField
                control={form.control}
                name="is_final"
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
                      <FormLabel className="!mt-0 flex items-center gap-1.5 font-semibold">
                        <Flag className="size-3.5" />
                        מעבר אחרון בחלקה
                      </FormLabel>
                      <p className="olive-muted mt-0.5 text-xs">
                        מסמן את החלקה כנמסקה ומוציא אותה מרשימת הפעילות בדשבורד.
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel className="text-sm font-semibold">הערות</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </div>

          {/* Submit. --flush drops the sticky positioning and negative margins,
              which only made sense when this sat in the page flow. */}
          <div className="olive-sticky-footer olive-sticky-footer--flush shrink-0">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                <X className="ml-1 size-4" />
                {isEdit ? 'בטל עריכה' : 'סגור'}
              </Button>
              <button type="submit" className="olive-submit px-6 py-2.5" disabled={saving}>
                {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
                {isEdit ? 'עדכן מעבר' : 'שמור מעבר'}
              </button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
