'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, Check, Compass, FlaskConical, Loader2, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { NIR_DIRECTIONS, PARAMETER_STATUS_CONFIG, type ParameterRule } from '@/types/database';
import { evaluateParameter } from '@/lib/olive/logic';
import type { ApiPlot } from '@/lib/olive/adapt';
import type { NirRow } from '@/lib/olive/nir-rows';

/**
 * NIR entry, in a drawer.
 *
 * The form itself is unchanged from when it owned the whole page — hero,
 * progress steps, sectioned cards, sticky submit, and the live readout that
 * scores oil/water/dry against parameter_rules as they are typed, so the
 * sampler sees the harvest verdict before saving. What changed is where it
 * lives: the log is the page now, and this opens over it.
 */

const NONE = '__none__';

/** What the drawer is open for. `null` means closed. */
export type NirEditorState =
  | { mode: 'create'; areaId: string | null }
  | { mode: 'edit'; row: NirRow };

const numericField = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'נדרש מספר' });

/**
 * Percentages carry a CHECK (… BETWEEN 0 AND 100) in the nir_report table.
 * Mirroring it here turns a typo into a message under the field instead of a
 * constraint violation surfacing as a generic save error.
 */
const percentField = numericField.refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), {
  message: 'נדרש ערך בין 0 ל-100',
});

const nirSchema = z.object({
  area_id: z.string().min(1, 'נדרש לבחור חלקה'),
  report_date: z.string().min(1, 'נדרש תאריך'),
  sub_area_id: z.string().optional(),
  direction: z.string().optional(),
  oil: percentField,
  water: percentField,
  green: percentField,
  acid: numericField,
  maturity: numericField,
  irrig_amount: numericField,
  notes: z.string().optional(),
});

type NirFormData = z.infer<typeof nirSchema>;

const STEPS = [
  { label: 'חלקה', icon: MapPin },
  { label: 'דגימה', icon: Compass },
  { label: 'מדידות', icon: FlaskConical },
];

const MEASUREMENTS: { name: keyof NirFormData; label: string; step: string }[] = [
  { name: 'oil', label: 'אחוז שמן %', step: '0.1' },
  { name: 'water', label: 'אחוז מים %', step: '0.1' },
  { name: 'green', label: 'אחוז צבע ירוק %', step: '1' },
  { name: 'acid', label: 'חומציות %', step: '0.01' },
  { name: 'maturity', label: 'אינדקס הבשלה', step: '0.1' },
  { name: 'irrig_amount', label: 'השקיה (קוב/דונם/יום)', step: '0.25' },
];

const MEASUREMENT_NAMES = MEASUREMENTS.map((m) => m.name);

function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** '' → null so a blank field is stored as NULL rather than 0. */
function optionalNumber(value?: string) {
  if (value === undefined || value.trim() === '') return null;
  return Number(value);
}

const EMPTY_FORM = {
  report_date: todayString(),
  sub_area_id: NONE,
  direction: NONE,
  oil: '',
  water: '',
  green: '',
  acid: '',
  maturity: '',
  irrig_amount: '',
  notes: '',
};

function defaultsFor(editor: NirEditorState): NirFormData {
  if (editor.mode === 'create') {
    return { area_id: editor.areaId ?? '', ...EMPTY_FORM };
  }

  const { row } = editor;
  const str = (n: number | null) => (n != null ? String(n) : '');

  return {
    area_id: row.areaId ?? '',
    report_date: row.reportDate ?? todayString(),
    sub_area_id: row.subAreaId ?? NONE,
    direction: row.direction ?? NONE,
    oil: str(row.oil),
    water: str(row.water),
    green: str(row.green),
    acid: str(row.acid),
    maturity: str(row.maturity),
    irrig_amount: str(row.irrigAmount),
    notes: row.notes,
  };
}

interface NirFormSheetProps {
  editor: NirEditorState | null;
  onOpenChange: (open: boolean) => void;
  plots: ApiPlot[];
  rules: ParameterRule[];
  /** Called after a successful save or update so the log can refresh. */
  onSaved: () => void;
  /**
   * Opened on top of another drawer. Narrows this one and lightens its scrim so
   * the drawer underneath stays visible rather than being buried.
   */
  stacked?: boolean;
  /** The plot is implied by where this was opened from — show it, fix it. */
  lockPlot?: boolean;
}

export function NirFormSheet({
  editor,
  onOpenChange,
  plots,
  rules,
  onSaved,
  stacked = false,
  lockPlot = false,
}: NirFormSheetProps) {
  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent
        // side is physical in this component, so it does not flip for RTL:
        // "left" is the trailing edge here, matching ReportDetailSheet.
        side="left"
        dir="rtl"
        // The built-in close sits at top-4 left-4, right on the hero gradient
        // with no contrast against it. Ours lives inside the hero instead.
        showCloseButton={false}
        // gap-0/p-0 undo SheetContent's own spacing, which would otherwise
        // wedge gaps between the hero, the stepper and the body.
        //
        // Stacked, this is 576px against the plot drawer's 672px, so ~96px of
        // it stays visible. In RTL that band is the drawer's LEADING edge —
        // the start of its title and the rim of its cards — rather than the
        // line-ending whitespace an inset would have exposed.
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          stacked ? 'sm:max-w-xl sm:shadow-2xl' : 'sm:max-w-2xl'
        )}
        // A second bg-black/50 over the first composites to 75% black.
        overlayClassName={stacked ? 'bg-black/20' : undefined}
        aria-describedby={undefined}
      >
        {editor && (
          <NirFormBody
            // Identity key instead of a reset effect: defaultValues are then
            // computed once per mount. A useEffect(() => form.reset(...)) here
            // double-fires under StrictMode and eats what the user just typed.
            // Note this key is stable across a create-save, which is what lets
            // the plot and date survive it.
            key={editor.mode === 'edit' ? `edit:${editor.row.id}` : `create:${editor.areaId ?? ''}`}
            editor={editor}
            plots={plots}
            rules={rules}
            lockPlot={lockPlot}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function NirFormBody({
  editor,
  plots,
  rules,
  lockPlot,
  onSaved,
  onClose,
}: {
  editor: NirEditorState;
  plots: ApiPlot[];
  rules: ParameterRule[];
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

  const form = useForm<NirFormData>({
    resolver: zodResolver(nirSchema),
    defaultValues: defaultsFor(editor),
  });

  const { control } = form;
  // Scoped watches. A bare form.watch() subscribes the whole subtree to every
  // keystroke, which is what the old single-component page did.
  const areaId = useWatch({ control, name: 'area_id' });
  const subAreaId = useWatch({ control, name: 'sub_area_id' });
  const direction = useWatch({ control, name: 'direction' });
  const measurements = useWatch({ control, name: MEASUREMENT_NAMES as (keyof NirFormData)[] });
  const [oil, water] = measurements;

  const plotOptions = useMemo(
    () =>
      plots.map((p) => ({
        value: p.id,
        label: [p.name, p.variety].filter(Boolean).join(' · '),
      })),
    [plots]
  );

  const takts = useMemo(() => plots.find((p) => p.id === areaId)?.takts ?? [], [plots, areaId]);

  const hasSampleLocation =
    (!!subAreaId && subAreaId !== NONE) || (!!direction && direction !== NONE);
  const hasMeasurement = measurements.some((v) => !!v && String(v).trim() !== '');

  const currentStep = !areaId ? 0 : !hasSampleLocation && !hasMeasurement ? 1 : 2;

  // Pulse a step circle the moment it is satisfied.
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

  /** Live verdict for what has been typed. dry mirrors the DB's generated column. */
  const readout = useMemo(() => {
    const oilNum = optionalNumber(oil as string | undefined);
    const waterNum = optionalNumber(water as string | undefined);
    const dryNum =
      oilNum !== null && waterNum !== null && waterNum < 100
        ? Math.round((oilNum / (100 - waterNum)) * 100 * 100) / 100
        : null;

    return [
      { label: 'שמן', value: oilNum, match: evaluateParameter(rules, 'oil', oilNum) },
      { label: 'מים', value: waterNum, match: evaluateParameter(rules, 'water', waterNum) },
      { label: 'שמן בחו״י', value: dryNum, match: evaluateParameter(rules, 'dry', dryNum) },
    ].filter((row) => row.value !== null);
  }, [oil, water, rules]);

  const onSubmit = async (values: NirFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/olive/nir', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { report_area_id: editingId } : { area_id: values.area_id }),
          report_date: values.report_date,
          sub_area_id: values.sub_area_id === NONE ? null : values.sub_area_id || null,
          direction: values.direction === NONE ? null : values.direction || null,
          oil: optionalNumber(values.oil),
          water: optionalNumber(values.water),
          green: optionalNumber(values.green),
          acid: optionalNumber(values.acid),
          maturity: optionalNumber(values.maturity),
          irrig_amount: optionalNumber(values.irrig_amount),
          notes: values.notes || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת הבדיקה');
      }

      showToast.success(editingId ? 'הבדיקה עודכנה' : 'הבדיקה נשמרה');
      onSaved();

      if (editingId) {
        onClose();
        return;
      }

      // Stay open and keep the plot and date: a sampler records several
      // readings in a row, and reselecting the plot each time is the slow part.
      const plotName = plots.find((p) => p.id === values.area_id)?.name ?? '';
      setSuccess(`הבדיקה נשמרה — ${plotName}`);
      form.reset({ ...form.getValues(), ...EMPTY_FORM, report_date: values.report_date });
      prevStep.current = 1;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'שגיאה בשמירת הבדיקה');
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
            <FlaskConical className="size-5 text-white" />
          </div>
          <SheetTitle className="olive-hero-title text-2xl tracking-tight md:text-3xl">
            {isEdit ? 'עריכת בדיקת NIR' : 'בדיקת NIR חדשה'}
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

      {/* Progress — only while creating. Over a saved record it is just noise,
          and on a phone it is noise that costs a section of screen. */}
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
                          searchPlaceholder="חיפוש בדיקה לפי חלקה..."
                          // Two independent reasons to fix it: once saved,
                          // moving a reading to another plot would make it a
                          // different reading; and opened from a plot's own
                          // drawer, the plot is what you opened.
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
            </section>

            {/* 2 — where the sample came from */}
            <section
              className={`olive-section olive-section-sample px-5 py-4 ${
                currentStep > 1 ? 'olive-section-completed' : ''
              }`}
            >
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-sample">
                  <Compass className="size-4" />
                </div>
                <h3 className="text-base font-bold">מיקום הדגימה</h3>
                {hasSampleLocation && (
                  <span className="olive-field-check">
                    <Check className="size-2.5" />
                  </span>
                )}
                <span className="olive-muted mr-auto text-xs">לא חובה</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">כיוון דגימה</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || NONE}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="בחר כיוון" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>—</SelectItem>
                          {NIR_DIRECTIONS.map((dir) => (
                            <SelectItem key={dir} value={dir}>
                              {dir}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 3 — the readings */}
            <section className="olive-section olive-section-values px-5 py-4">
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-values">
                  <FlaskConical className="size-4" />
                </div>
                <h3 className="text-base font-bold">מדידות</h3>
                {hasMeasurement && (
                  <span className="olive-field-check">
                    <Check className="size-2.5" />
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MEASUREMENTS.map((m) => (
                  <FormField
                    key={m.name}
                    control={form.control}
                    name={m.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{m.label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={m.step}
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

              {/* Live verdict — the reason this form exists */}
              {readout.length > 0 && (
                <div className="olive-readout mt-4">
                  <span className="olive-muted text-xs font-semibold">לפי הערכים שהוזנו:</span>
                  {readout.map((row) => (
                    <span key={row.label} className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold">
                        {row.label} {row.value}%
                      </span>
                      {row.match ? (
                        <span
                          className={`olive-pill ${PARAMETER_STATUS_CONFIG[row.match.status].pillClass}`}
                        >
                          {row.match.message}
                        </span>
                      ) : (
                        <span className="olive-muted">—</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <p className="olive-muted mt-3 text-xs">
                אחוז שמן בחומר יבש מחושב אוטומטית מהשמן והמים ואינו נרשם ידנית.
              </p>

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
                {isEdit ? 'עדכן בדיקה' : 'שמור בדיקה'}
              </button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
