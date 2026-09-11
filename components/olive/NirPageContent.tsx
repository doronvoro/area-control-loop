'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Loader2,
  Trash2,
  Pencil,
  X,
  Check,
  MapPin,
  Compass,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
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
import { showToast } from '@/lib/toast';
import { NIR_DIRECTIONS, PARAMETER_STATUS_CONFIG, type ParameterRule } from '@/types/database';
import { evaluateParameter, daysSinceLabel } from '@/lib/olive/logic';
import type { ApiPlot } from '@/lib/olive/adapt';

/**
 * NIR entry.
 *
 * Laid out like the monitoring form — hero, progress steps, sectioned cards,
 * sticky submit — but the data model underneath stays flat. A ripeness reading
 * has no findings and no treatments, so there is nothing here to nest.
 *
 * The one thing this form has that monitoring does not: a live readout. Oil,
 * water and the derived dry-matter figure are scored against parameter_rules as
 * they are typed, so the sampler sees the harvest verdict before saving rather
 * than after navigating to the dashboard.
 */

const NONE = '__none__';

const numericField = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'נדרש מספר' });

const nirSchema = z.object({
  area_id: z.string().min(1, 'נדרש לבחור חלקה'),
  report_date: z.string().min(1, 'נדרש תאריך'),
  sub_area_id: z.string().optional(),
  direction: z.string().optional(),
  oil: numericField,
  water: numericField,
  green: numericField,
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

export function NirPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  const [plots, setPlots] = useState<ApiPlot[]>([]);
  const [rules, setRules] = useState<ParameterRule[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<Set<number>>(new Set());
  const prevStep = useRef(0);

  const form = useForm<NirFormData>({
    resolver: zodResolver(nirSchema),
    defaultValues: { area_id: initialAreaId ?? '', ...EMPTY_FORM },
  });

  const areaId = form.watch('area_id');
  const subAreaId = form.watch('sub_area_id');
  const direction = form.watch('direction');
  const oil = form.watch('oil');
  const water = form.watch('water');
  const watched = form.watch();

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [plotsRes, dashRes, nirRes] = await Promise.all([
        fetch('/api/olive/plots'),
        fetch('/api/olive/dashboard'),
        fetch('/api/olive/nir'),
      ]);
      if (!plotsRes.ok) throw new Error('שגיאה בטעינת החלקות');
      setPlots(await plotsRes.json());
      if (dashRes.ok) setRules((await dashRes.json()).parameterRules || []);
      if (nirRes.ok) setReports(await nirRes.json());
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
  const hasMeasurement = MEASUREMENTS.some((m) => {
    const value = watched[m.name] as string | undefined;
    return !!value && value.trim() !== '';
  });

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
    const oilNum = optionalNumber(oil);
    const waterNum = optionalNumber(water);
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

      const plotName = plots.find((p) => p.id === values.area_id)?.name ?? '';
      setSuccess(editingId ? 'הבדיקה עודכנה' : `הבדיקה נשמרה — ${plotName}`);
      showToast.success(editingId ? 'הבדיקה עודכנה' : 'הבדיקה נשמרה');

      // Keep the plot and date: a sampler records several readings in a row.
      form.reset({ ...form.getValues(), ...EMPTY_FORM, report_date: values.report_date });
      setEditingId(null);
      prevStep.current = 1;
      await loadData();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת הבדיקה');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (report: any) => {
    const detail = report.detail || {};
    setEditingId(report.id);
    setError(null);
    setSuccess(null);
    form.reset({
      area_id: report.area?.id ?? '',
      report_date: report.report_date ? String(report.report_date).slice(0, 10) : todayString(),
      sub_area_id: detail.sub_area_id ?? NONE,
      direction: detail.direction ?? NONE,
      oil: detail.oil != null ? String(detail.oil) : '',
      water: detail.water != null ? String(detail.water) : '',
      green: detail.green != null ? String(detail.green) : '',
      acid: detail.acid != null ? String(detail.acid) : '',
      maturity: detail.maturity != null ? String(detail.maturity) : '',
      irrig_amount: detail.irrig_amount != null ? String(detail.irrig_amount) : '',
      notes: report.description ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSuccess(null);
    form.reset({ area_id: initialAreaId ?? '', ...EMPTY_FORM });
  };

  const handleDelete = async (reportAreaId: string) => {
    if (!confirm('למחוק את הבדיקה הזו?')) return;
    try {
      const response = await fetch(`/api/olive/nir?id=${reportAreaId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה במחיקה');
      }
      showToast.success('הבדיקה נמחקה');
      if (editingId === reportAreaId) cancelEdit();
      await loadData();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקה');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="olive-form-container mx-auto max-w-4xl">
        {/* Hero */}
        <div className="olive-form-hero px-6 py-5 md:px-8 md:py-6">
          <div className="olive-hero-pattern" />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <FlaskConical className="size-5 text-white" />
            </div>
            <h2 className="olive-hero-title text-2xl tracking-tight md:text-3xl">
              {editingId ? 'עריכת בדיקת NIR' : 'בדיקת NIR חדשה'}
            </h2>
          </div>
        </div>

        {/* Progress */}
        <div className="olive-steps">
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

        <div className="p-4 md:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                            // The plot is fixed once saved — moving a reading to
                            // another plot would make it a different reading.
                            disabled={editingId !== null}
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
                            {takts.map((takt: any) => (
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

              {/* Sticky submit */}
              <div className="olive-sticky-footer">
                <div className="flex items-center justify-between gap-4">
                  <div className="olive-muted flex items-center gap-2 text-xs">
                    <FlaskConical className="size-3.5" />
                    <span>
                      {reports.length} {reports.length === 1 ? 'בדיקה' : 'בדיקות'} בעונה
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId && (
                      <Button type="button" variant="ghost" onClick={cancelEdit}>
                        <X className="ml-1 size-4" />
                        בטל עריכה
                      </Button>
                    )}
                    <button type="submit" className="olive-submit px-6 py-2.5" disabled={saving}>
                      {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
                      {editingId ? 'עדכן בדיקה' : 'שמור בדיקה'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Log */}
      <section className="olive-card mx-auto max-w-4xl overflow-hidden">
        <h2 className="p-4 pb-2 font-bold">יומן בדיקות</h2>
        {reports.length === 0 ? (
          <p className="olive-muted p-4 pt-0 text-sm">אין בדיקות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2 text-start">תאריך</th>
                  <th className="p-2 text-start">חלקה</th>
                  <th className="p-2 text-start">שמן %</th>
                  <th className="p-2 text-start">מים %</th>
                  <th className="p-2 text-start">שמן בחו״י %</th>
                  <th className="p-2 text-start">סטטוס</th>
                  <th className="p-2 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const detail = report.detail || {};
                  const oilMatch = evaluateParameter(rules, 'oil', detail.oil);
                  return (
                    <tr
                      key={report.id}
                      className={`border-b last:border-0 ${
                        editingId === report.id ? 'bg-muted/40' : ''
                      }`}
                    >
                      <td className="p-2 whitespace-nowrap">
                        {report.report_date ? String(report.report_date).slice(0, 10) : '—'}
                        <span className="olive-muted block text-xs">
                          {daysSinceLabel(report.report_date, new Date()) ?? ''}
                        </span>
                      </td>
                      <td className="p-2">{report.area?.name || '—'}</td>
                      <td className="p-2">{detail.oil ?? '—'}</td>
                      <td className="p-2">{detail.water ?? '—'}</td>
                      <td className="p-2">{detail.dry ?? '—'}</td>
                      <td className="p-2">
                        {oilMatch && (
                          <span
                            className={`olive-pill ${PARAMETER_STATUS_CONFIG[oilMatch.status].pillClass}`}
                          >
                            {oilMatch.message}
                          </span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(report)}
                          aria-label="ערוך בדיקה"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                          aria-label="מחק בדיקה"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
