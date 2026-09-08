'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, RefreshCw, Trash2, CloudRain, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { showToast } from '@/lib/toast';
import { computeUpcomingWeather } from '@/lib/olive/logic';
import { toWeatherDayLike } from '@/lib/olive/adapt';

/**
 * Regional forecast for the harvest decision.
 *
 * Two rows can exist per date — the fetched forecast and a manual override —
 * and the manual one wins, which is why both are shown side by side rather than
 * the override silently replacing the forecast.
 */

const RAIN_ALERT_MM = 5;
const WIND_ALERT_KMH = 25;

const numericField = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'נדרש מספר' });

const overrideSchema = z.object({
  entry_date: z.string().min(1, 'נדרש תאריך'),
  rain_mm: numericField,
  wind_kmh: numericField,
  temp_min: numericField,
  temp_max: numericField,
});

type OverrideFormData = z.infer<typeof overrideSchema>;

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

export function WeatherPageContent() {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OverrideFormData>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { entry_date: todayString(), rain_mm: '', wind_kmh: '', temp_min: '', temp_max: '' },
  });

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/olive/weather');
      if (!res.ok) throw new Error('שגיאה בטעינת מזג האוויר');
      setDays(await res.json());
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await fetch('/api/olive/weather/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה ברענון התחזית');
      }
      showToast.success('התחזית עודכנה');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'שגיאה ברענון');
      showToast.error(err.message || 'שגיאה ברענון');
    } finally {
      setRefreshing(false);
    }
  };

  const onSubmit = async (values: OverrideFormData) => {
    try {
      const res = await fetch('/api/olive/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: values.entry_date,
          rain_mm: optionalNumber(values.rain_mm),
          wind_kmh: optionalNumber(values.wind_kmh),
          temp_min: optionalNumber(values.temp_min),
          temp_max: optionalNumber(values.temp_max),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירה');
      }
      showToast.success('העדכון הידני נשמר');
      form.reset({ ...form.getValues(), rain_mm: '', wind_kmh: '', temp_min: '', temp_max: '' });
      await loadData();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה בשמירה');
    }
  };

  const handleDeleteOverride = async (entryDate: string) => {
    if (!confirm('למחוק את העדכון הידני ולחזור לתחזית?')) return;
    try {
      const res = await fetch(`/api/olive/weather?date=${entryDate}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקה');
      showToast.success('העדכון הידני נמחק');
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

  const effective = computeUpcomingWeather(days.map(toWeatherDayLike), new Date());
  const manualDates = new Set(days.filter((d) => d.is_manual).map((d) => d.entry_date));

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="olive-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-bold">תחזית 7 ימים — דרום רמת הגולן</h2>
          <p className="olive-muted text-xs">
            מקור: Open-Meteo · התראה על גשם מעל {RAIN_ALERT_MM} מ״מ או רוח מעל {WIND_ALERT_KMH} קמ״ש
          </p>
        </div>
        <Button type="button" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="ml-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="ml-2 size-4" />
          )}
          רענן תחזית
        </Button>
      </section>

      {effective.weatherLines.length > 0 && (
        <section className="olive-card space-y-1 p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <CloudRain className="size-4" /> ימים שמשפיעים על דחיפות המסיק
          </h2>
          {effective.weatherLines.map((line) => (
            <p key={line} className="flex items-center gap-2 text-sm">
              {line.startsWith('רוח') ? (
                <Wind className="size-3.5 shrink-0" />
              ) : (
                <CloudRain className="size-3.5 shrink-0" />
              )}
              {line}
            </p>
          ))}
        </section>
      )}

      <section className="olive-card overflow-hidden">
        <h2 className="p-4 pb-2 font-bold">ימים קרובים</h2>
        {days.length === 0 ? (
          <p className="olive-muted p-4 pt-0 text-sm">
            אין נתוני מזג אוויר. לחץ &quot;רענן תחזית&quot; כדי למשוך מ-Open-Meteo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2 text-start">תאריך</th>
                  <th className="p-2 text-start">מקור</th>
                  <th className="p-2 text-start">טמפ׳</th>
                  <th className="p-2 text-start">גשם (מ״מ)</th>
                  <th className="p-2 text-start">רוח (קמ״ש)</th>
                  <th className="p-2 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const overridden = !day.is_manual && manualDates.has(day.entry_date);
                  const rain = Number(day.rain_mm);
                  const wind = Number(day.wind_kmh);
                  return (
                    <tr
                      key={`${day.entry_date}-${day.is_manual}`}
                      className={`border-b last:border-0 ${overridden ? 'opacity-45' : ''}`}
                    >
                      <td className="p-2 whitespace-nowrap">{day.entry_date}</td>
                      <td className="p-2">
                        <span
                          className={`olive-pill ${day.is_manual ? 'olive-pill-plan' : 'olive-pill-idle'}`}
                        >
                          {day.is_manual ? 'ידני' : 'תחזית'}
                        </span>
                        {overridden && <span className="olive-muted mr-2 text-xs">גובר עליו ידני</span>}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {day.temp_min ?? '—'}°–{day.temp_max ?? '—'}°
                      </td>
                      <td className={`p-2 ${rain > RAIN_ALERT_MM ? 'font-bold' : ''}`}>
                        {day.rain_mm ?? '—'}
                      </td>
                      <td className={`p-2 ${wind > WIND_ALERT_KMH ? 'font-bold' : ''}`}>
                        {day.wind_kmh ?? '—'}
                      </td>
                      <td className="p-2">
                        {day.is_manual && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOverride(day.entry_date)}
                            aria-label="מחק עדכון ידני"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="olive-card p-4">
        <h2 className="mb-1 font-bold">עדכון ידני</h2>
        <p className="olive-muted mb-3 text-xs">
          גובר על התחזית לאותו תאריך. שימושי כשהתחזית שגויה או כשאין חיבור לספק.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FormField
                control={form.control}
                name="entry_date"
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
              {(
                [
                  { name: 'rain_mm', label: 'גשם (מ״מ)', step: '0.1' },
                  { name: 'wind_kmh', label: 'רוח (קמ״ש)', step: '1' },
                  { name: 'temp_min', label: 'טמפ׳ מינ׳', step: '1' },
                  { name: 'temp_max', label: 'טמפ׳ מקס׳', step: '1' },
                ] as const
              ).map((f) => (
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
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <Button type="submit">שמור עדכון ידני</Button>
          </form>
        </Form>
      </section>
    </div>
  );
}
