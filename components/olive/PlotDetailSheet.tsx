'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, FlaskConical, Loader2, MapPin, Plus, Tractor, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { showToast } from '@/lib/toast';
import {
  HARVESTER_OPTIONS,
  PARAMETER_STATUS_CONFIG,
  PLOT_TYPE_OPTIONS,
  WATER_TYPE_OPTIONS,
  type ParameterRule,
} from '@/types/database';
import { daysSinceLabel, evaluateParameter } from '@/lib/olive/logic';
import { toNirRow, type NirRow } from '@/lib/olive/nir-rows';
import { toHarvestRow, type HarvestRow } from '@/lib/olive/harvest-rows';
import { categoryLabel, type PlotRow } from '@/lib/olive/plot-rows';

/**
 * Everything about one plot.
 *
 * A plot is the hub of this module — readings, passes and yield all hang off
 * it — but the only thing the app could ever show you about one was a form of
 * seven editable attributes, in a modal that nothing could open. This is the
 * plot's own screen: what it measured recently, what has been harvested off it,
 * and the attributes, in that order. The attributes come last on purpose; they
 * are the least of what someone opening a plot wants to know.
 *
 * History is fetched when the drawer opens rather than with the list, so the
 * page still costs one request for 45 plots.
 */

const NONE = '__none__'; // Radix Select rejects '' as an item value

const detailsSchema = z.object({
  grower_name: z.string().optional(),
  region: z.string().optional(),
  plant_year_label: z.string().optional(),
  plot_type: z.string().optional(),
  harvester: z.string().optional(),
  water_type: z.string().optional(),
  takt_count: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10), {
      message: 'מספר בין 1 ל-10',
    }),
});

type DetailsFormData = z.infer<typeof detailsSchema>;

const SELECTS: {
  name: 'plot_type' | 'harvester' | 'water_type';
  label: string;
  options: { value: string; label: string }[];
}[] = [
  { name: 'plot_type', label: 'סוג מגדל', options: PLOT_TYPE_OPTIONS },
  { name: 'harvester', label: 'סוג מוסקת', options: HARVESTER_OPTIONS },
  { name: 'water_type', label: 'סוג מים', options: WATER_TYPE_OPTIONS },
];

/** How many readings and passes to list before pointing at the full log. */
const HISTORY_LIMIT = 5;

function toFormValue(value: string | null | undefined): string {
  return value ?? NONE;
}

function fromFormValue(value: string | undefined): string | null {
  return !value || value === NONE ? null : value;
}

function num(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

interface PlotDetailSheetProps {
  row: PlotRow | null;
  onOpenChange: (open: boolean) => void;
  rules: ParameterRule[];
  onSaved: () => void;
}

export function PlotDetailSheet({ row, onOpenChange, rules, onSaved }: PlotDetailSheetProps) {
  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent
        // side is physical, so it does not flip for RTL: "left" is the trailing
        // edge here, matching the NIR and harvest drawers.
        side="left"
        dir="rtl"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {row && (
          // Remount per plot so the form's defaultValues and the history state
          // are computed once, with no reset effect to double-fire.
          <PlotDetailBody
            key={row.id}
            row={row}
            rules={rules}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlotDetailBody({
  row,
  rules,
  onSaved,
  onClose,
}: {
  row: PlotRow;
  rules: ParameterRule[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nirRows, setNirRows] = useState<NirRow[] | null>(null);
  const [harvestRows, setHarvestRows] = useState<HarvestRow[] | null>(null);

  const now = useMemo(() => new Date(), []);
  const taktNameById = useMemo(
    () => new Map((row.plot.takts ?? []).map((t) => [t.id, t.name])),
    [row.plot.takts]
  );

  // History for this plot only. Both routes already take areaId; seasonId=all
  // because a plot's own page should show what it did, not what it did inside
  // whichever window the log happens to be scoped to.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        const [nirRes, harvestRes] = await Promise.all([
          fetch(`/api/olive/nir?areaId=${row.id}&seasonId=all`),
          fetch(`/api/olive/harvest?areaId=${row.id}&seasonId=all`),
        ]);
        if (cancelled.current) return;
        if (nirRes.ok) {
          const body = await nirRes.json();
          setNirRows((body.reports ?? []).map((r: never) => toNirRow(r, taktNameById)));
        } else setNirRows([]);
        if (harvestRes.ok) {
          const body = await harvestRes.json();
          setHarvestRows((body.reports ?? []).map((r: never) => toHarvestRow(r, taktNameById)));
        } else setHarvestRows([]);
      } catch {
        if (cancelled.current) return;
        setNirRows([]);
        setHarvestRows([]);
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [row.id, taktNameById]);

  const form = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      grower_name: row.growerName ?? '',
      region: row.region ?? '',
      plant_year_label: row.plot.details?.plant_year_label ?? '',
      plot_type: toFormValue(row.plotType),
      harvester: toFormValue(row.harvester),
      water_type: toFormValue(row.waterType),
      takt_count: row.plot.details?.takt_count != null ? String(row.plot.details.takt_count) : '',
    },
  });

  const onSubmit = async (values: DetailsFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/olive/plots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: row.id,
          grower_name: values.grower_name || null,
          region: values.region || null,
          plant_year_label: values.plant_year_label || null,
          plot_type: fromFormValue(values.plot_type),
          harvester: fromFormValue(values.harvester),
          water_type: fromFormValue(values.water_type),
          takt_count: values.takt_count ? Number(values.takt_count) : null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת פרטי החלקה');
      }

      showToast.success('פרטי החלקה נשמרו');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Identity */}
      <div className="olive-form-hero shrink-0 px-6 py-5">
        <div className="olive-hero-pattern" />
        <div className="relative z-10">
          <SheetTitle className="olive-hero-title text-xl tracking-tight md:text-2xl">
            {row.name || '—'}
          </SheetTitle>
          <p className="relative z-10 mt-1 text-sm text-white/75">
            {[row.variety, row.growerName, row.region].filter(Boolean).join(' · ') || ' '}
          </p>
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

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="גודל (דונם)" value={num(row.size, 1)} />
          <Stat label="טאקטים" value={String(row.taktCount)} />
          <Stat label="בדיקה אחרונה" value={row.lastMeasuredLabel ?? 'טרם נבדקה'} small />
          <Stat
            label="קטגוריה"
            value={categoryLabel(row.category)}
            small
            hint={row.harvested ? 'נמסק' : undefined}
          />
        </div>

        {/* NIR history */}
        <section className="olive-section olive-section-values px-5 py-4">
          <div className="olive-section-header">
            <div className="olive-section-icon olive-icon-values">
              <FlaskConical className="size-4" />
            </div>
            <h3 className="text-base font-bold">בדיקות NIR אחרונות</h3>
            <Button asChild size="sm" variant="ghost" className="mr-auto h-7 text-xs">
              <Link href={`/olive/nir?areaId=${row.id}`}>
                <Plus className="ml-1 size-3.5" />
                בדיקה חדשה
              </Link>
            </Button>
          </div>

          {nirRows === null ? (
            <Skeleton />
          ) : nirRows.length === 0 ? (
            <p className="olive-muted text-sm">טרם בוצעה בדיקה בחלקה זו</p>
          ) : (
            <>
              <ul className="divide-y text-sm">
                {nirRows.slice(0, HISTORY_LIMIT).map((r) => {
                  const match = evaluateParameter(rules, 'oil', r.oil);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="tabular-nums">{r.reportDate ?? '—'}</span>
                      <span className="olive-muted text-xs">
                        {daysSinceLabel(r.reportDate, now) ?? ''}
                      </span>
                      <span className="mr-auto flex items-center gap-3 tabular-nums">
                        <span>
                          <span className="olive-muted text-xs">שמן </span>
                          {num(r.oil, 1)}
                        </span>
                        <span>
                          <span className="olive-muted text-xs">מים </span>
                          {num(r.water, 1)}
                        </span>
                        {match && (
                          <span
                            className={`olive-pill ${PARAMETER_STATUS_CONFIG[match.status].pillClass}`}
                          >
                            {match.message}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {nirRows.length > HISTORY_LIMIT && (
                <Link
                  href={`/olive/nir?areaId=${row.id}`}
                  className="olive-muted mt-2 inline-block text-xs underline"
                >
                  עוד {nirRows.length - HISTORY_LIMIT} בדיקות ביומן
                </Link>
              )}
            </>
          )}
        </section>

        {/* Harvest history */}
        <section className="olive-section olive-section-sample px-5 py-4">
          <div className="olive-section-header">
            <div className="olive-section-icon olive-icon-sample">
              <Tractor className="size-4" />
            </div>
            <h3 className="text-base font-bold">מעברי מסיק</h3>
            <Button asChild size="sm" variant="ghost" className="mr-auto h-7 text-xs">
              <Link href={`/olive/harvest?areaId=${row.id}`}>
                <Plus className="ml-1 size-3.5" />
                מעבר חדש
              </Link>
            </Button>
          </div>

          {harvestRows === null ? (
            <Skeleton />
          ) : harvestRows.length === 0 ? (
            <p className="olive-muted text-sm">טרם נרשם מסיק בחלקה זו</p>
          ) : (
            <ul className="divide-y text-sm">
              {harvestRows.slice(0, HISTORY_LIMIT).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="tabular-nums">{r.reportDate ?? '—'}</span>
                  <span className="olive-pill olive-pill-idle">מעבר {r.passNumber ?? '—'}</span>
                  <span className="mr-auto flex items-center gap-3 tabular-nums">
                    <span>
                      <span className="olive-muted text-xs">פרי </span>
                      {num(r.fruitKg)}
                    </span>
                    <span>
                      <span className="olive-muted text-xs">שמן </span>
                      {num(r.oilKg)}
                    </span>
                    {r.isFinal && <span className="olive-pill olive-pill-ok">אחרון</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Attributes */}
        <Form {...form}>
          <form id="plot-details-form" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="olive-section olive-section-plot px-5 py-4">
              <div className="olive-section-header">
                <div className="olive-section-icon olive-icon-plot">
                  <MapPin className="size-4" />
                </div>
                <h3 className="text-base font-bold">פרטי חלקה</h3>
              </div>

              {error && (
                <div className="olive-error-banner mb-4 flex items-center gap-3 p-3">
                  <AlertTriangle className="size-4 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="grower_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">שם מגדל</FormLabel>
                      <FormControl>
                        <Input className="h-9" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">גוש</FormLabel>
                      <FormControl>
                        <Input className="h-9" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {SELECTS.map((s) => (
                  <FormField
                    key={s.name}
                    control={form.control}
                    name={s.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{s.label}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || NONE}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" sideOffset={4}>
                            <SelectItem value={NONE}>—</SelectItem>
                            {s.options.map((o) => (
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
                ))}

                <FormField
                  control={form.control}
                  name="plant_year_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">שנת נטיעה (תווית)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          placeholder="2006/7"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="takt_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">מספר טאקטים</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          type="number"
                          min={1}
                          max={10}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* The split of ownership is deliberate and documented on the
                  plots route: these columns live on `areas`, not here. */}
              <p className="olive-muted mt-3 text-xs">
                שם, זן, שנת נטיעה וגודל נערכים במסך השטחים.
              </p>
            </section>
          </form>
        </Form>
      </div>

      <div className="olive-sticky-footer olive-sticky-footer--flush shrink-0">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="ml-1 size-4" />
            סגור
          </Button>
          {/* Outside the <form>, so the submit is wired by id — the form lives
              in the scroll area and the footer does not. */}
          <button
            type="submit"
            form="plot-details-form"
            className="olive-submit px-6 py-2.5"
            disabled={saving}
          >
            {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
            שמור פרטים
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="olive-card p-3">
      <div className="olive-muted text-xs font-semibold">{label}</div>
      <div className={small ? 'text-sm font-bold' : 'text-lg font-bold tabular-nums'}>{value}</div>
      {hint && <div className="text-primary text-xs font-semibold">{hint}</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex items-center gap-2 py-2">
      <Loader2 className="text-muted-foreground size-4 animate-spin" />
      <span className="olive-muted text-sm">טוען...</span>
    </div>
  );
}
