'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  FileText,
  FlaskConical,
  Loader2,
  MapPin,
  Plus,
  Tractor,
  X,
} from 'lucide-react';
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
import { NONE, fromFormValue, toFormValue } from '@/lib/forms/none-sentinel';
import {
  GrowerPicker,
  growerPayload,
  initialGrowerSelection,
  type GrowerOption,
  type GrowerSelection,
} from './GrowerPicker';
import {
  HARVESTER_OPTIONS,
  PARAMETER_STATUS_CONFIG,
  PLOT_TYPE_OPTIONS,
  WATER_TYPE_OPTIONS,
  type ParameterRule,
} from '@/types/database';
import { daysSinceLabel, evaluateParameter, yieldLoadInfo } from '@/lib/olive/logic';
import type { ApiPlot } from '@/lib/olive/adapt';
import { toNirRow, type NirRow } from '@/lib/olive/nir-rows';
import { toHarvestRow, type HarvestRow } from '@/lib/olive/harvest-rows';
import { categoryLabel, type PlotRow } from '@/lib/olive/plot-rows';
import { NirFormSheet, type NirEditorState } from './NirFormSheet';
import { HarvestFormSheet, type HarvestEditorState } from './HarvestFormSheet';

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

const detailsSchema = z.object({
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
  // yield_estimates.kg_per_dunam carries no CHECK constraint of any kind, so a
  // typo'd negative would be stored silently. This is the only guard there is.
  yield_kg_per_dunam: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: 'נדרש ערך חיובי',
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

function num(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

interface PlotDetailSheetProps {
  row: PlotRow | null;
  onOpenChange: (open: boolean) => void;
  rules: ParameterRule[];
  /** All plots, for the stacked NIR/harvest forms' (locked) plot picker. */
  plots: ApiPlot[];
  /** Per-area planned yield, for the stacked harvest form's live readout. */
  estimates: Record<string, { kg_per_dunam?: unknown }>;
  /** The active season. Null when none is active — the yield field needs one. */
  seasonId: string | null;
  /** The tenant's growers, for the picker. */
  growers: GrowerOption[];
  onSaved: () => void;
}

export function PlotDetailSheet({
  row,
  onOpenChange,
  rules,
  plots,
  estimates,
  seasonId,
  growers,
  onSaved,
}: PlotDetailSheetProps) {
  const [nirEditor, setNirEditor] = useState<NirEditorState | null>(null);
  const [harvestEditor, setHarvestEditor] = useState<HarvestEditorState | null>(null);
  // Bumped after a stacked save so the history lists below re-pull. The plots
  // table behind refreshes through onSaved instead.
  const [historyNonce, setHistoryNonce] = useState(0);

  const handleInnerSaved = useCallback(() => {
    setHistoryNonce((n) => n + 1);
    onSaved();
  }, [onSaved]);

  /** Closing the plot drawer takes the stack with it. */
  const close = useCallback(() => {
    setNirEditor(null);
    setHarvestEditor(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <Sheet open={row !== null} onOpenChange={(open) => !open && close()}>
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
            // Keyed on the id ONLY, deliberately. A refetch gives this row a new
            // identity but the same id, so the body does not remount and the
            // scroll position, the loaded history and any half-typed attribute
            // survive a save made from the drawer stacked on top. Do not add a
            // data version here, and do not "fix" staleness with a reset effect.
            <PlotDetailBody
              key={row.id}
              row={row}
              rules={rules}
              seasonId={seasonId}
              growers={growers}
              historyNonce={historyNonce}
              onSaved={onSaved}
              onClose={close}
              onNewNir={() => setNirEditor({ mode: 'create', areaId: row.id })}
              onEditNir={(r) => setNirEditor({ mode: 'edit', row: r })}
              onNewHarvest={() => setHarvestEditor({ mode: 'create', areaId: row.id })}
              onEditHarvest={(r) => setHarvestEditor({ mode: 'edit', row: r })}
            />
          )}
        </SheetContent>
      </Sheet>

      {/*
        Siblings of the plot drawer, not children of its SheetContent. Both
        portal to <body> either way, so the layering is identical — but out here
        they are not inside `{row && …}` or the key, so nothing can yank an open
        drawer out of the tree mid-animation and drop what was typed in it.
      */}
      <NirFormSheet
        editor={nirEditor}
        onOpenChange={(open) => !open && setNirEditor(null)}
        plots={plots}
        rules={rules}
        onSaved={handleInnerSaved}
        stacked
        lockPlot
      />
      <HarvestFormSheet
        editor={harvestEditor}
        onOpenChange={(open) => !open && setHarvestEditor(null)}
        plots={plots}
        estimates={estimates}
        onSaved={handleInnerSaved}
        stacked
        lockPlot
      />
    </>
  );
}

function PlotDetailBody({
  row,
  rules,
  seasonId,
  growers,
  historyNonce,
  onSaved,
  onClose,
  onNewNir,
  onEditNir,
  onNewHarvest,
  onEditHarvest,
}: {
  row: PlotRow;
  rules: ParameterRule[];
  seasonId: string | null;
  growers: GrowerOption[];
  historyNonce: number;
  onSaved: () => void;
  onClose: () => void;
  onNewNir: () => void;
  onEditNir: (r: NirRow) => void;
  onNewHarvest: () => void;
  onEditHarvest: (r: HarvestRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Outside the zod form, as in PlotCreateSheet: two coupled values with a
  // sentinel. Seeded once per mount, like defaultValues — the body is keyed on
  // row.id, so a refetch must not reset a half-typed new grower name.
  const [grower, setGrower] = useState<GrowerSelection>(() =>
    initialGrowerSelection(row.plot.details?.grower_id, row.growerName, growers)
  );

  const [nirRows, setNirRows] = useState<NirRow[] | null>(null);
  const [harvestRows, setHarvestRows] = useState<HarvestRow[] | null>(null);

  const now = useMemo(() => new Date(), []);
  const taktNameById = useMemo(
    () => new Map((row.plot.takts ?? []).map((t) => [t.id, t.name])),
    [row.plot.takts]
  );

  // Read through a ref rather than depended on: once the row is derived from
  // the table's data, every refetch gives row.plot a new identity and a new
  // takts array, and a Map in the deps would re-fire this on each one. Takt
  // names are labels on the fetched rows; they have no business gating a fetch.
  const taktNameRef = useRef(taktNameById);
  taktNameRef.current = taktNameById;

  // History for this plot only. Both routes already take areaId; seasonId=all
  // because a plot's own page should show what it did, not what it did inside
  // whichever window the log happens to be scoped to.
  const requestId = useRef(0);
  useEffect(() => {
    // A counter, not a boolean: a shared `cancelled` ref is reset to false by
    // the next effect run, so a slow first response would sail past it and
    // overwrite fresher data. Reachable now that a save re-fires this.
    const id = ++requestId.current;
    (async () => {
      try {
        const [nirRes, harvestRes] = await Promise.all([
          fetch(`/api/olive/nir?areaId=${row.id}&seasonId=all`),
          fetch(`/api/olive/harvest?areaId=${row.id}&seasonId=all`),
        ]);
        if (id !== requestId.current) return; // a newer request already won
        if (nirRes.ok) {
          const body = await nirRes.json();
          if (id !== requestId.current) return;
          setNirRows((body.reports ?? []).map((r: never) => toNirRow(r, taktNameRef.current)));
        } else setNirRows([]);
        if (harvestRes.ok) {
          const body = await harvestRes.json();
          if (id !== requestId.current) return;
          setHarvestRows(
            (body.reports ?? []).map((r: never) => toHarvestRow(r, taktNameRef.current))
          );
        } else setHarvestRows([]);
      } catch {
        if (id !== requestId.current) return;
        setNirRows([]);
        setHarvestRows([]);
      }
    })();
    return () => {
      // Bumping the LIVE counter is the point — it invalidates whatever is
      // still in flight. The lint rule guards refs that point at DOM nodes;
      // copying this one into a local would defeat the guard it implements.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
    };
  }, [row.id, historyNonce]);

  const form = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      region: row.region ?? '',
      plant_year_label: row.plot.details?.plant_year_label ?? '',
      plot_type: toFormValue(row.plotType),
      harvester: toFormValue(row.harvester),
      water_type: toFormValue(row.waterType),
      takt_count: row.plot.details?.takt_count != null ? String(row.plot.details.takt_count) : '',
      yield_kg_per_dunam: row.yieldKgPerDunam != null ? String(row.yieldKgPerDunam) : '',
    },
  });

  // The band pill beside the yield field, live off what has been typed.
  const yieldDraft = useWatch({ control: form.control, name: 'yield_kg_per_dunam' });
  const yieldLoad = useMemo(
    () => (yieldDraft ? yieldLoadInfo(Number(yieldDraft)) : null),
    [yieldDraft]
  );

  const onSubmit = async (values: DetailsFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/olive/plots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: row.id,
          ...growerPayload(grower),
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

      // The yield lives in another table, keyed by season, so it is a second
      // write — but only when it actually changed, which keeps the common case
      // at one request and lets a plot save its attributes with no active
      // season. Both writes are idempotent upserts, so a retry after a partial
      // failure is safe; the message says which half failed.
      const nextYield = values.yield_kg_per_dunam ? Number(values.yield_kg_per_dunam) : null;
      if (seasonId && nextYield !== row.yieldKgPerDunam) {
        const yieldResponse = await fetch('/api/olive/yield', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area_id: row.id,
            season_id: seasonId,
            kg_per_dunam: nextYield,
          }),
        });

        if (!yieldResponse.ok) {
          const body = await yieldResponse.json().catch(() => ({}));
          throw new Error(body.error || 'פרטי החלקה נשמרו, אך שמירת הערכת היבול נכשלה');
        }
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
        {/* Stats. Three across rather than four, to give the yield band room. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="גודל (דונם)" value={num(row.size, 1)} />
          <Stat label="טאקטים" value={String(row.taktCount)} />
          {/* The season's planned figure, not an actual — it is what the
              harvest form scores each pass against. */}
          <Stat
            label="יבול צפוי (ק״ג/דונם)"
            value={num(row.yieldKgPerDunam)}
            pill={
              row.yieldLoad
                ? {
                    label: row.yieldLoad.label,
                    className: PARAMETER_STATUS_CONFIG[row.yieldLoad.status].pillClass,
                  }
                : undefined
            }
          />
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mr-auto h-7 text-xs"
              onClick={onNewNir}
            >
              <Plus className="ml-1 size-3.5" />
              בדיקה חדשה
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
                    <li key={r.id}>
                      {/* text-start is load-bearing: a button centres its text. */}
                      <button
                        type="button"
                        onClick={() => onEditNir(r)}
                        aria-label={`ערוך בדיקה מתאריך ${r.reportDate ?? ''}`}
                        className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
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
                      </button>
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mr-auto h-7 text-xs"
              onClick={onNewHarvest}
            >
              <Plus className="ml-1 size-3.5" />
              מעבר חדש
            </Button>
          </div>

          {harvestRows === null ? (
            <Skeleton />
          ) : harvestRows.length === 0 ? (
            <p className="olive-muted text-sm">טרם נרשם מסיק בחלקה זו</p>
          ) : (
            <ul className="divide-y text-sm">
              {harvestRows.slice(0, HISTORY_LIMIT).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onEditHarvest(r)}
                    aria-label={`ערוך מעבר ${r.passNumber ?? ''} מתאריך ${r.reportDate ?? ''}`}
                    className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
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
                  </button>
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
                <div>
                  <label className="text-sm font-semibold" id="plot-detail-grower">
                    מגדל
                  </label>
                  <div className="mt-2" aria-labelledby="plot-detail-grower">
                    <GrowerPicker growers={growers} value={grower} onChange={setGrower} />
                  </div>
                </div>

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

                {/* Not an olive_plot_details column — it lives in
                    yield_estimates, keyed by season, and is saved by a second
                    request from the same submit. */}
                <FormField
                  control={form.control}
                  name="yield_kg_per_dunam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">יבול צפוי (ק״ג/דונם)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          type="number"
                          // step="any" and no min on purpose. Native constraint
                          // validation blocks submit BEFORE react-hook-form
                          // runs, silently and with an unstyled English
                          // tooltip — a step of 10 would have rejected 1234.
                          // The zod refine owns this, so the message is ours.
                          step="any"
                          inputMode="decimal"
                          disabled={!seasonId}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      {seasonId ? (
                        yieldLoad && (
                          <span
                            className={`olive-pill ${PARAMETER_STATUS_CONFIG[yieldLoad.status].pillClass} mt-1`}
                          >
                            {yieldLoad.label}
                          </span>
                        )
                      ) : (
                        <p className="olive-muted text-xs">אין עונה פעילה</p>
                      )}
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
          {/* The report reads the saved row, so unsaved edits would not appear
              on it. Disabled rather than silently stale — a printed report that
              contradicts the form on screen is worse than one you cannot open
              yet. Opens in a new tab: this is a document to keep, and the
              drawer behind it holds work in progress. */}
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isDirty}
            title={form.formState.isDirty ? 'שמור תחילה כדי לכלול את השינויים' : undefined}
            onClick={() => window.open(`/olive/report/plot/${row.id}`, '_blank', 'noopener')}
          >
            <FileText className="ml-1 size-4" />
            הפק דוח
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
  pill,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  /** A tinted band under the figure, e.g. the yield load. */
  pill?: { label: string; className: string };
  small?: boolean;
}) {
  return (
    <div className="olive-card p-3">
      <div className="olive-muted text-xs font-semibold">{label}</div>
      <div className={small ? 'text-sm font-bold' : 'text-lg font-bold tabular-nums'}>{value}</div>
      {pill && <span className={`olive-pill mt-1 ${pill.className}`}>{pill.label}</span>}
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
