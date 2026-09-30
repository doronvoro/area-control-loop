'use client';

import { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  Check,
  FlaskConical,
  Info,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  NIR_CRUSHING_TYPES,
  NIR_SAMPLE_TYPE_LABELS,
  NIR_SAMPLE_TYPES,
  PARAMETER_STATUS_CONFIG,
  type ParameterRule,
} from '@/types/database';
import { evaluateParameter } from '@/lib/olive/logic';
import type { ApiPlot } from '@/lib/olive/adapt';
import type { NirRow } from '@/lib/olive/nir-rows';
import { NirGauge } from './NirGauge';

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
  sample_type: z.enum(NIR_SAMPLE_TYPES),
  // Pomace only. Kept in the schema for both types so switching back and forth
  // does not lose what was typed; onSubmit nulls them for fruit.
  crushing_type: z.string().optional(),
  decanter_differential: numericField,
  monopump_speed: numericField,
  malaxation_temp: numericField,
  notes: z.string().optional(),
  // Two fields rather than one nullable string: "ticked, date not picked yet" is
  // a state the form has to be able to hold while the user is in it.
  sent_to_client: z.boolean().optional(),
  sent_to_client_at: z.string().optional(),
});

type NirFormData = z.infer<typeof nirSchema>;

const MEASUREMENTS: { name: keyof NirFormData; label: string; step: string }[] = [
  { name: 'oil', label: 'שמן %', step: '0.1' },
  { name: 'water', label: 'מים %', step: '0.1' },
  { name: 'green', label: 'צבע ירוק %', step: '1' },
  { name: 'acid', label: 'חומציות %', step: '0.01' },
  { name: 'maturity', label: 'אינדקס הבשלה', step: '0.1' },
  { name: 'irrig_amount', label: 'השקיה (קוב/דונם/יום)', step: '0.25' },
];

const MEASUREMENT_NAMES = MEASUREMENTS.map((m) => m.name);

/** The two with parameter_rules bands — drawn with a gauge under the input. */
const GAUGED = new Set<keyof NirFormData>(['oil', 'water']);
const GAUGED_MEASUREMENTS = MEASUREMENTS.filter((m) => GAUGED.has(m.name));
const OTHER_MEASUREMENTS = MEASUREMENTS.filter((m) => !GAUGED.has(m.name));

/** The mill settings behind a pomace sample, shown only for sample_type 'pomace'. */
const POMACE_MEASUREMENTS: { name: keyof NirFormData; label: string; step: string }[] = [
  { name: 'decanter_differential', label: 'דיפרנציאל דקנטר', step: '0.1' },
  { name: 'monopump_speed', label: 'מהירות מונופאמפ', step: '0.1' },
  { name: 'malaxation_temp', label: 'טמפרטורת ערבול (°C)', step: '0.1' },
];

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
  sample_type: 'fruit' as const,
  crushing_type: NONE,
  decanter_differential: '',
  monopump_speed: '',
  malaxation_temp: '',
  sub_area_id: NONE,
  direction: NONE,
  oil: '',
  water: '',
  green: '',
  acid: '',
  maturity: '',
  irrig_amount: '',
  notes: '',
  // Ticked by default. A reading is taken in order to be passed on, and every
  // reading in the גשור archive was sent the day it was taken — so the
  // unticked default made the sampler re-tick the box forty times and left
  // the ones they forgot reading as "טרם נשלח ללקוח" on the plots screen.
  // Only for a NEW reading: defaultsFor() still mirrors the stored value when
  // editing, so opening a genuinely unsent reading does not mark it sent.
  sent_to_client: true,
  sent_to_client_at: todayString(),
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
    sample_type: row.sampleType,
    crushing_type: row.crushingType ?? NONE,
    decanter_differential: str(row.decanterDifferential),
    monopump_speed: str(row.monopumpSpeed),
    malaxation_temp: str(row.malaxationTemp),
    notes: row.notes,
    sent_to_client: row.sentToClientAt !== null,
    sent_to_client_at: row.sentToClientAt ?? '',
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
  // Set by שמור והוסף עוד just before it submits, read once by onSubmit. A ref:
  // written and read within the same submit, with no render in between.
  const addAnotherRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const form = useForm<NirFormData>({
    resolver: zodResolver(nirSchema),
    defaultValues: defaultsFor(editor),
  });

  const { control } = form;
  // Scoped watches. A bare form.watch() subscribes the whole subtree to every
  // keystroke, which is what the old single-component page did.
  const areaId = useWatch({ control, name: 'area_id' });
  const sampleType = useWatch({ control, name: 'sample_type' });
  const isPomace = sampleType === 'pomace';
  const sentToClient = useWatch({ control, name: 'sent_to_client' });
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

  const hasMeasurement = measurements.some((v) => !!v && String(v).trim() !== '');

  /**
   * Live verdict for what has been typed. dry mirrors the DB's generated column.
   * Fruit only: parameter_rules score ripeness, and pomace oil is extraction
   * loss — scoring it would print "not ready for harvest" on a mill sample.
   */
  const readout = useMemo(() => {
    if (isPomace) return [];
    const oilNum = optionalNumber(oil as string | undefined);
    const waterNum = optionalNumber(water as string | undefined);
    const dryNum =
      oilNum !== null && waterNum !== null && waterNum < 100
        ? Math.round((oilNum / (100 - waterNum)) * 100 * 100) / 100
        : null;

    // Oil and water have their own gauges under the inputs now; only the
    // derived figure, which has no input to hang one on, is read out here.
    return [
      { label: 'שמן בחו״י', value: dryNum, match: evaluateParameter(rules, 'dry', dryNum) },
    ].filter((row) => row.value !== null);
  }, [oil, water, rules, isPomace]);

  const onSubmit = async (values: NirFormData) => {
    const addAnother = addAnotherRef.current;
    addAnotherRef.current = false;

    // Compared against the stored value rather than read from
    // form.formState.dirtyFields: that object is a Proxy which only tracks
    // fields subscribed during RENDER, so reading it here — inside a callback —
    // comes back empty and the send mark silently never posts. Both sides are a
    // local YYYY-MM-DD, so they compare directly.
    const storedSentDay = editor.mode === 'edit' ? editor.row.sentToClientAt : null;
    const nextSentDay = values.sent_to_client ? values.sent_to_client_at || todayString() : null;
    const sentChanged = nextSentDay !== storedSentDay;

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
          sample_type: values.sample_type,
          // Always sent, so turning a pomace reading into a fruit one clears
          // the mill settings rather than leaving them orphaned on the row.
          ...(values.sample_type === 'pomace'
            ? {
                crushing_type: values.crushing_type === NONE ? null : values.crushing_type || null,
                decanter_differential: optionalNumber(values.decanter_differential),
                monopump_speed: optionalNumber(values.monopump_speed),
                malaxation_temp: optionalNumber(values.malaxation_temp),
              }
            : {
                crushing_type: null,
                decanter_differential: null,
                monopump_speed: null,
                malaxation_temp: null,
              }),
          notes: values.notes || null,
          // Only when it actually changed. nirRow() strips undefined, so an
          // untouched checkbox leaves the stored instant exactly as it was —
          // otherwise opening a sent reading to fix a typo in oil would
          // overwrite a real send time (18:20) with local midnight. An explicit
          // null genuinely clears it, and the column with it.
          ...(sentChanged
            ? {
                sent_to_client_at: nextSentDay
                  ? new Date(`${nextSentDay}T00:00:00`).toISOString()
                  : null,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת הבדיקה');
      }

      showToast.success(editingId ? 'הבדיקה עודכנה' : 'הבדיקה נשמרה');
      onSaved();

      // Saving closes, create and edit alike — staying open and clearing the
      // fields by default read as "the save wiped my values".
      if (editingId || !addAnother) {
        onClose();
        return;
      }

      // שמור והוסף עוד: stay open and keep the plot and date — a sampler
      // recording a run of readings should not reselect the plot each time.
      const plotName = plots.find((p) => p.id === values.area_id)?.name ?? '';
      setSuccess(`הבדיקה נשמרה — ${plotName}`);
      // The type carries over too: a run of samples is usually all fruit from
      // the grove or all pomace at the mill, not alternating.
      form.reset({
        ...form.getValues(),
        ...EMPTY_FORM,
        report_date: values.report_date,
        sample_type: values.sample_type,
        crushing_type: values.crushing_type,
      });
      // Back to the top, where the banner is, so the cleared fields read as
      // "next reading" rather than lost ones.
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          {/* min-h-0 is load-bearing: a flex item defaults to min-height:auto,
              so without it overflow-y-auto never shrinks and the footer below
              gets pushed off a phone screen. */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
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

            {/* Sample type — first, because it decides which fields follow.
                Two buttons rather than a Select: there are only two, and both
                should be visible at a glance. The section header is the label,
                so the radiogroup takes its name from it. */}
            <section className="olive-section olive-section-type px-5 py-3">
              {/* One row: two options do not need a body under a divider. The !
                  is needed because olive.css is unlayered and outranks
                  Tailwind's utilities layer. */}
              <div className="olive-section-header mb-0! flex-wrap border-b-0! pb-0!">
                <div className="olive-section-icon olive-icon-type">
                  <Layers className="size-4" />
                </div>
                <h3 id="nir-sample-type-heading" className="text-base font-bold">
                  סוג בדיקה
                </h3>

                <FormField
                  control={form.control}
                  name="sample_type"
                  render={({ field }) => (
                    <FormItem className="mr-auto">
                      <div
                        role="radiogroup"
                        aria-labelledby="nir-sample-type-heading"
                        className="bg-muted inline-flex rounded-lg p-1"
                      >
                        {NIR_SAMPLE_TYPES.map((type) => {
                          const selected = field.value === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => field.onChange(type)}
                              className={cn(
                                'h-8 min-w-20 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                // Pomace in the brown of its .olive-pill-sample tag,
                                // so a mill sample is recognisable at a glance and
                                // matches how it is tagged in the lists.
                                selected
                                  ? type === 'pomace'
                                    ? 'bg-[oklch(0.45_0.05_60)] text-white shadow-sm'
                                    : 'bg-primary text-primary-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {NIR_SAMPLE_TYPE_LABELS[type]}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Sending to the client, on one row. A mark, not an action —
                nothing in the app sends anything yet. The caption saying so
                moved into the info tooltip beside the checkbox; it still has
                to exist, or the checkbox reads as "send it now". */}
            <section className="olive-section olive-section-send px-5 py-3">
              <div className="olive-section-header mb-0! flex-wrap border-b-0! pb-0!">
                <div className="olive-section-icon olive-icon-send">
                  <Send className="size-4" />
                </div>
                <h3 className="text-base font-bold">שליחה ללקוח</h3>

                <div className="mr-auto flex flex-wrap items-center gap-3">
                  <FormField
                    control={form.control}
                    name="sent_to_client"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          {/* Unchecked, the default border is too faint to
                              find on this row; tint it the section's blue. */}
                          <Checkbox
                            className="data-[state=unchecked]:border-[oklch(0.55_0.07_230/75%)]"
                            checked={!!field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked === true);
                              // Default the date on the way in rather than
                              // validating on the way out: an empty string
                              // reaching PostgREST as a timestamptz is a 400.
                              if (checked === true && !form.getValues('sent_to_client_at')) {
                                form.setValue('sent_to_client_at', todayString(), {
                                  shouldDirty: true,
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-semibold">נשלח</FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="מידע על סימון השליחה"
                              className="olive-muted hover:text-foreground rounded-full"
                            >
                              <Info className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            סימון ידני — המערכת אינה שולחת את הדוח בעצמה.
                            {editor.mode === 'edit' && editor.row.sentToClientBy && (
                              <> סומן ע״י {editor.row.sentToClientBy}.</>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </FormItem>
                    )}
                  />

                  {sentToClient && (
                    <FormField
                      control={form.control}
                      name="sent_to_client_at"
                      render={({ field: dateField }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              aria-label="תאריך השליחה"
                              className="h-8 w-40"
                              {...dateField}
                              value={dateField.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </section>

            {/* The readings */}
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

              {/* Oil and water: one row each — label, a narrow input, and the
                  gauge taking the rest. They are the two the verdict is read
                  from, and a gauge needs the width, so they stack rather than
                  share a line. Typing moves the pointer, so a slip like 80 for
                  8.0 shows up as a pinned, wrong-coloured marker before it is
                  saved. */}
              <div className="space-y-2">
                {GAUGED_MEASUREMENTS.map((m) => (
                  <FormField
                    key={m.name}
                    control={form.control}
                    name={m.name}
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <div className="flex items-start gap-3">
                          <FormLabel className="w-12 shrink-0 text-sm leading-9 font-semibold">
                            {m.label}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={m.step}
                              inputMode="decimal"
                              className="h-9 w-24 shrink-0 text-center tabular-nums"
                              {...field}
                              value={(field.value as string) ?? ''}
                            />
                          </FormControl>
                          {/* pt-2 against the gauge's own -mt-1 puts the track
                              on the input's centre line. */}
                          <div className="min-w-0 flex-1 pt-2">
                            <NirGauge
                              variant="field"
                              label={m.label}
                              value={optionalNumber(field.value as string | undefined)}
                              rules={rules}
                              parameterCode={m.name}
                              neutral={isPomace}
                            />
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {OTHER_MEASUREMENTS.map((m) => (
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

              {isPomace && (
                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="crushing_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">סוג ריסוק</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || NONE}>
                          <FormControl>
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue placeholder="בחר סוג ריסוק" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" sideOffset={4}>
                            <SelectItem value={NONE}>—</SelectItem>
                            {NIR_CRUSHING_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {POMACE_MEASUREMENTS.map((m) => (
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
              )}

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

              {isPomace && (
                <p className="olive-muted mt-3 text-xs">
                  בדיקת גפת אינה מדורגת לפי ספי המסיק ואינה משפיעה על סטטוס החלקה.
                </p>
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

            {/* Plot and date — after the readings, which are what the form is for */}
            <section
              className={`olive-section olive-section-plot px-5 py-4 ${
                areaId ? 'olive-section-completed' : ''
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
          </div>

          {/* Submit. --flush drops the sticky positioning and negative margins,
              which only made sense when this sat in the page flow. */}
          <div className="olive-sticky-footer olive-sticky-footer--flush shrink-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                <X className="ml-1 size-4" />
                {isEdit ? 'בטל עריכה' : 'סגור'}
              </Button>
              {/* Create only: the batch path, opt-in. Runs the same zod
                  validation; a failed one clears the flag so the next plain
                  save still closes. */}
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  aria-label="שמור והוסף עוד"
                  onClick={() => {
                    addAnotherRef.current = true;
                    void form.handleSubmit(onSubmit, () => {
                      addAnotherRef.current = false;
                    })();
                  }}
                >
                  <Plus className="size-4 sm:ml-1" />
                  <span className="hidden sm:inline">שמור והוסף עוד</span>
                </Button>
              )}
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
