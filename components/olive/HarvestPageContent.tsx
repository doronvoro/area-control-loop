'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Loader2,
  Trash2,
  Check,
  X,
  MapPin,
  Tractor,
  Scale,
  AlertTriangle,
  Flag,
} from 'lucide-react';
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
import { showToast } from '@/lib/toast';
import { HARVESTER_OPTIONS, HARVESTER_LABELS } from '@/types/database';
import type { ApiPlot } from '@/lib/olive/adapt';

/**
 * Harvest passes (מסיק).
 *
 * Same treatment as the NIR form — hero, steps, sectioned cards, sticky
 * submit — over a flat record.
 *
 * pass_number is absent from the form on purpose: the server derives it from
 * the highest pass already recorded, so a second pass cannot reuse number 1 and
 * corrupt the season total. It is shown read-only so the number is not a
 * surprise after saving.
 */

const NONE = '__none__';

const numericField = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'נדרש מספר' });

const harvestSchema = z.object({
  area_id: z.string().min(1, 'נדרש לבחור חלקה'),
  report_date: z.string().min(1, 'נדרש תאריך'),
  sub_area_id: z.string().optional(),
  harvester_type: z.string().optional(),
  operator: z.string().optional(),
  area_done_dunam: numericField,
  fruit_kg: numericField,
  oil_kg: numericField,
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

export function HarvestPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  const [plots, setPlots] = useState<ApiPlot[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<Set<number>>(new Set());
  const prevStep = useRef(0);

  const form = useForm<HarvestFormData>({
    resolver: zodResolver(harvestSchema),
    defaultValues: { area_id: initialAreaId ?? '', ...EMPTY_FORM },
  });

  const watched = form.watch();
  const areaId = watched.area_id;

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [plotsRes, harvestRes, yieldRes] = await Promise.all([
        fetch('/api/olive/plots'),
        fetch('/api/olive/harvest'),
        fetch('/api/olive/yield'),
      ]);
      if (!plotsRes.ok) throw new Error('שגיאה בטעינת החלקות');
      setPlots(await plotsRes.json());
      if (harvestRes.ok) setReports(await harvestRes.json());
      if (yieldRes.ok) setEstimates((await yieldRes.json()).estimates || {});
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

  const selectedPlot = useMemo(() => plots.find((p) => p.id === areaId), [plots, areaId]);
  const takts = selectedPlot?.takts ?? [];

  /** Mirrors the server's derivation so the number is not a surprise after saving. */
  const nextPass = useMemo(() => {
    if (!areaId) return 1;
    const highest = reports
      .filter((r) => r.area?.id === areaId)
      .reduce((max, r) => Math.max(max, Number(r.detail?.pass_number) || 0), 0);
    return highest + 1;
  }, [reports, areaId]);

  const hasEquipment =
    (!!watched.harvester_type && watched.harvester_type !== NONE) || !!watched.operator?.trim();
  const hasResult = RESULTS.some((f) => {
    const value = watched[f.name] as string | undefined;
    return !!value && value.trim() !== '';
  });

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
    const dunam = optionalNumber(watched.area_done_dunam);
    const fruit = optionalNumber(watched.fruit_kg);
    const oil = optionalNumber(watched.oil_kg);
    const rows: { label: string; value: string; hint?: string; tone?: string }[] = [];

    if (fruit !== null && dunam !== null && dunam > 0) {
      const perDunam = fruit / dunam;
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

    if (fruit !== null && fruit > 0 && oil !== null) {
      rows.push({ label: 'אחוז שמן מהפרי', value: `${((oil / fruit) * 100).toFixed(1)}%` });
    }

    return rows;
  }, [watched.area_done_dunam, watched.fruit_kg, watched.oil_kg, estimates, areaId]);

  const onSubmit = async (values: HarvestFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/olive/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: values.area_id,
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

      const plotName = selectedPlot?.name ?? '';
      setSuccess(
        values.is_final
          ? `מעבר ${nextPass} נשמר — ${plotName} סומנה כנמסקה`
          : `מעבר ${nextPass} נשמר — ${plotName}`
      );
      showToast.success('דוח המסיק נשמר');

      form.reset({ ...form.getValues(), ...EMPTY_FORM, report_date: values.report_date });
      prevStep.current = 1;
      await loadData();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reportAreaId: string) => {
    if (!confirm('למחוק את דוח המסיק הזה?')) return;
    try {
      const response = await fetch(`/api/olive/harvest?id=${reportAreaId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה במחיקה');
      }
      showToast.success('הדוח נמחק');
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
              <Tractor className="size-5 text-white" />
            </div>
            <h2 className="olive-hero-title text-2xl tracking-tight md:text-3xl">רישום מעבר מסיק</h2>
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

              {/* 1 — plot, date, pass */}
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
                  {areaId && (
                    <span className="olive-pill olive-pill-idle mr-auto">מעבר {nextPass}</span>
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
                  מספר המעבר נקבע אוטומטית מהמעברים שכבר נרשמו בחלקה.
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

              {/* Sticky submit */}
              <div className="olive-sticky-footer">
                <div className="flex items-center justify-between gap-4">
                  <div className="olive-muted flex items-center gap-2 text-xs">
                    <Tractor className="size-3.5" />
                    <span>
                      {reports.length} {reports.length === 1 ? 'מעבר' : 'מעברים'} בעונה
                    </span>
                  </div>
                  <button type="submit" className="olive-submit px-6 py-2.5" disabled={saving}>
                    {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
                    שמור דוח מסיק
                  </button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Log */}
      <section className="olive-card mx-auto max-w-4xl overflow-hidden">
        <h2 className="p-4 pb-2 font-bold">מעברי מסיק</h2>
        {reports.length === 0 ? (
          <p className="olive-muted p-4 pt-0 text-sm">טרם נרשמו מעברי מסיק</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2 text-start">תאריך</th>
                  <th className="p-2 text-start">חלקה</th>
                  <th className="p-2 text-start">מעבר</th>
                  <th className="p-2 text-start">מוסקת</th>
                  <th className="p-2 text-start">פרי (ק״ג)</th>
                  <th className="p-2 text-start">שמן (ק״ג)</th>
                  <th className="p-2 text-start">אחרון</th>
                  <th className="p-2 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const d = report.detail || {};
                  return (
                    <tr key={report.id} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">
                        {report.report_date ? String(report.report_date).slice(0, 10) : '—'}
                      </td>
                      <td className="p-2">{report.area?.name || '—'}</td>
                      <td className="p-2">{d.pass_number ?? '—'}</td>
                      <td className="p-2">
                        {d.harvester_type
                          ? (HARVESTER_LABELS[d.harvester_type as keyof typeof HARVESTER_LABELS] ??
                            d.harvester_type)
                          : '—'}
                      </td>
                      <td className="p-2">{d.fruit_kg ?? '—'}</td>
                      <td className="p-2">{d.oil_kg ?? '—'}</td>
                      <td className="p-2">
                        {d.is_final ? <span className="olive-pill olive-pill-ok">כן</span> : '—'}
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                          aria-label="מחק דוח מסיק"
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
