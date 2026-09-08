'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Trash2 } from 'lucide-react';
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
 * One flat form — 12 fields, no nesting. Deliberately NOT modelled on
 * MonitoringForm.tsx, which is 1,600 lines of customer → inspector → area →
 * sub-area → finding → treatment with nested field arrays. A ripeness reading
 * has none of that structure, and spec §3.1 wants it fast on a phone.
 */

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

function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** '' → undefined so a blank field is stored as NULL rather than 0. */
function optionalNumber(value?: string) {
  if (value === undefined || value.trim() === '') return null;
  return Number(value);
}

export function NirPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  const [plots, setPlots] = useState<ApiPlot[]>([]);
  const [rules, setRules] = useState<ParameterRule[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<NirFormData>({
    resolver: zodResolver(nirSchema),
    defaultValues: {
      area_id: initialAreaId ?? '',
      report_date: todayString(),
      sub_area_id: '',
      direction: '',
      oil: '',
      water: '',
      green: '',
      acid: '',
      maturity: '',
      irrig_amount: '',
      notes: '',
    },
  });

  const selectedAreaId = form.watch('area_id');

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

      if (dashRes.ok) {
        const dash = await dashRes.json();
        setRules(dash.parameterRules || []);
      }
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

  const takts = useMemo(() => {
    const plot = plots.find((p) => p.id === selectedAreaId);
    return plot?.takts ?? [];
  }, [plots, selectedAreaId]);

  const onSubmit = async (values: NirFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/olive/nir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: values.area_id,
          report_date: values.report_date,
          sub_area_id: values.sub_area_id || null,
          direction: values.direction || null,
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

      showToast.success('הבדיקה נשמרה');
      // Keep the plot and date — a sampler usually records several readings in a row.
      form.reset({
        ...form.getValues(),
        oil: '',
        water: '',
        green: '',
        acid: '',
        maturity: '',
        irrig_amount: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת הבדיקה');
    } finally {
      setSaving(false);
    }
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

  const measurementFields: { name: keyof NirFormData; label: string; step: string }[] = [
    { name: 'oil', label: 'אחוז שמן %', step: '0.1' },
    { name: 'water', label: 'אחוז מים %', step: '0.1' },
    { name: 'green', label: 'אחוז צבע ירוק %', step: '1' },
    { name: 'acid', label: 'חומציות %', step: '0.01' },
    { name: 'maturity', label: 'אינדקס הבשלה', step: '0.1' },
    { name: 'irrig_amount', label: 'השקיה (קוב/דונם/יום)', step: '0.25' },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="olive-card p-4">
        <h2 className="mb-3 font-bold">רישום בדיקה</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>חלקה</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={plotOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="בחר חלקה"
                        searchPlaceholder="חיפוש בדיקה לפי חלקה..."
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
                    <FormLabel>תאריך</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sub_area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>טאקט</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={takts.length ? 'בחר טאקט' : 'אין טאקטים'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
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
                    <FormLabel>כיוון דגימה</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="בחר כיוון" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {measurementFields.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={f.step}
                          inputMode="decimal"
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

            <p className="olive-muted text-xs">
              אחוז שמן בחומר יבש מחושב אוטומטית מהשמן והמים ואינו נרשם ידנית.
            </p>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="ml-2 size-4 animate-spin" />}
              שמור בדיקה
            </Button>
          </form>
        </Form>
      </section>

      <section className="olive-card overflow-hidden">
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
                    <tr key={report.id} className="border-b last:border-0">
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
                      <td className="p-2">
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
