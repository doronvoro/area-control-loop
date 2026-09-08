'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Trash2 } from 'lucide-react';
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
 * pass_number is deliberately absent from the form — the server derives it from
 * the highest pass already recorded for the plot, so a second pass cannot reuse
 * number 1 and corrupt the season total. Marking a pass `is_final` retires the
 * plot from the active dashboard list.
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

export function HarvestPageContent({ initialAreaId }: { initialAreaId: string | null }) {
  const [plots, setPlots] = useState<ApiPlot[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<HarvestFormData>({
    resolver: zodResolver(harvestSchema),
    defaultValues: {
      area_id: initialAreaId ?? '',
      report_date: todayString(),
      sub_area_id: NONE,
      harvester_type: NONE,
      operator: '',
      area_done_dunam: '',
      fruit_kg: '',
      oil_kg: '',
      is_final: false,
      notes: '',
    },
  });

  const selectedAreaId = form.watch('area_id');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [plotsRes, harvestRes] = await Promise.all([
        fetch('/api/olive/plots'),
        fetch('/api/olive/harvest'),
      ]);
      if (!plotsRes.ok) throw new Error('שגיאה בטעינת החלקות');
      setPlots(await plotsRes.json());
      if (harvestRes.ok) setReports(await harvestRes.json());
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

  const takts = useMemo(
    () => plots.find((p) => p.id === selectedAreaId)?.takts ?? [],
    [plots, selectedAreaId]
  );

  const onSubmit = async (values: HarvestFormData) => {
    try {
      setSaving(true);
      setError(null);

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

      showToast.success('דוח המסיק נשמר');
      form.reset({ ...form.getValues(), area_done_dunam: '', fruit_kg: '', oil_kg: '', notes: '', is_final: false });
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

  const amountFields: { name: keyof HarvestFormData; label: string; step: string }[] = [
    { name: 'area_done_dunam', label: 'שטח שנמסק (דונם)', step: '0.1' },
    { name: 'fruit_kg', label: 'סה״כ פרי (ק״ג)', step: '1' },
    { name: 'oil_kg', label: 'סה״כ שמן (ק״ג)', step: '1' },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="olive-card p-4">
        <h2 className="mb-3 font-bold">רישום מעבר מסיק</h2>
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
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={takts.length ? 'כל החלקה' : 'אין טאקטים'} />
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
                    <FormLabel>סוג מוסקת</FormLabel>
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
                    <FormLabel>מפעיל</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {amountFields.map((f) => (
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

            <FormField
              control={form.control}
              name="is_final"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    מעבר אחרון — מסמן את החלקה כנמסקה ומוציא אותה מרשימת הפעילות
                  </FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="olive-muted text-xs">
              מספר המעבר נקבע אוטומטית לפי המעברים שכבר נרשמו בחלקה.
            </p>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="ml-2 size-4 animate-spin" />}
              שמור דוח מסיק
            </Button>
          </form>
        </Form>
      </section>

      <section className="olive-card overflow-hidden">
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
