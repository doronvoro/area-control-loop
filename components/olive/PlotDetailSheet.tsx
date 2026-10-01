'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  ChartLine,
  FileText,
  FlaskConical,
  List,
  Loader2,
  MailCheck,
  MapPin,
  Plus,
  Sprout,
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
import { NirGauge } from './NirGauge';
import { NONE, fromFormValue, toFormValue } from '@/lib/forms/none-sentinel';
import {
  GrowerPicker,
  growerPayload,
  initialGrowerSelection,
  type GrowerOption,
  type GrowerSelection,
} from './GrowerPicker';
import {
  NEW_VARIETY,
  VarietyPicker,
  initialVarietySelection,
  varietyChanged,
  varietyPayload,
  type VarietyOption,
  type VarietySelection,
} from './VarietyPicker';
import { plantYearForName, plotDisplayName } from '@/lib/olive/plot-name';
import {
  NIR_SAMPLE_TYPE_LABELS,
  PARAMETER_STATUS_CONFIG,
  WATER_TYPE_OPTIONS,
  type ParameterRule,
} from '@/types/database';
import { daysSinceLabel, evaluateParameter, yieldLoadInfo } from '@/lib/olive/logic';
import type { ApiPlot } from '@/lib/olive/adapt';
import { toNirRow, type NirRow } from '@/lib/olive/nir-rows';
import { toHarvestRow, type HarvestRow } from '@/lib/olive/harvest-rows';
import type { PlotRow } from '@/lib/olive/plot-rows';
import { parsePlantingDate } from '@/lib/olive/import-backup';
import { NirFormSheet, type NirEditorState } from './NirFormSheet';
import { HarvestFormSheet, type HarvestEditorState } from './HarvestFormSheet';
import { PlotReportDialog } from './report/PlotReportDialog';
import { NirTrendChart } from './report/NirTrendChart';

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
  planting_time: z.string().optional(),
  // areas.size is DECIMAL(10,2) with no CHECK — same guard as the create form.
  size: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: 'נדרש ערך חיובי',
    }),
  water_type: z.string().optional(),
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
  name: 'water_type';
  label: string;
  options: { value: string; label: string }[];
}[] = [{ name: 'water_type', label: 'סוג מים', options: WATER_TYPE_OPTIONS }];

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
  /** The shared variety list, for the picker. */
  varieties: VarietyOption[];
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
  varieties,
  onSaved,
}: PlotDetailSheetProps) {
  const [nirEditor, setNirEditor] = useState<NirEditorState | null>(null);
  const [harvestEditor, setHarvestEditor] = useState<HarvestEditorState | null>(null);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);
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
              varieties={varieties}
              historyNonce={historyNonce}
              onSaved={onSaved}
              onClose={close}
              onNewNir={() => setNirEditor({ mode: 'create', areaId: row.id })}
              onEditNir={(r) => setNirEditor({ mode: 'edit', row: r })}
              onNewHarvest={() => setHarvestEditor({ mode: 'create', areaId: row.id })}
              onEditHarvest={(r) => setHarvestEditor({ mode: 'edit', row: r })}
              onOpenReport={() => setReport({ id: row.id, name: row.name || row.region || '' })}
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
      <PlotReportDialog
        plotId={report?.id ?? null}
        plotName={report?.name ?? ''}
        onClose={() => setReport(null)}
      />
    </>
  );
}

function PlotDetailBody({
  row,
  rules,
  seasonId,
  growers,
  varieties,
  historyNonce,
  onSaved,
  onClose,
  onNewNir,
  onEditNir,
  onNewHarvest,
  onEditHarvest,
  onOpenReport,
}: {
  row: PlotRow;
  rules: ParameterRule[];
  seasonId: string | null;
  growers: GrowerOption[];
  varieties: VarietyOption[];
  historyNonce: number;
  onSaved: () => void;
  onClose: () => void;
  onNewNir: () => void;
  onEditNir: (r: NirRow) => void;
  onNewHarvest: () => void;
  onEditHarvest: (r: HarvestRow) => void;
  onOpenReport: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Outside the zod form, as in PlotCreateSheet: two coupled values with a
  // sentinel. Seeded once per mount, like defaultValues — the body is keyed on
  // row.id, so a refetch must not reset a half-typed new grower name.
  const [grower, setGrower] = useState<GrowerSelection>(() =>
    initialGrowerSelection(row.plot.details?.grower_id, row.growerName, growers)
  );
  const [variety, setVariety] = useState<VarietySelection>(() =>
    initialVarietySelection(row.varietyId, row.variety, varieties)
  );
  // The variety list is a separate request and may land after the drawer
  // opened, which seeds an untouched picker as "new" with the stored name.
  // Once the plot's own variety appears in the list, show it as the list entry
  // — only while the user has not changed anything.
  useEffect(() => {
    setVariety((current) =>
      current.varietyId === NEW_VARIETY &&
      current.varietyName === (row.variety ?? '') &&
      row.varietyId &&
      varieties.some((v) => v.id === row.varietyId)
        ? { varietyId: row.varietyId, varietyName: '' }
        : current
    );
  }, [varieties, row.varietyId, row.variety]);

  const [nirRows, setNirRows] = useState<NirRow[] | null>(null);
  const [nirView, setNirView] = useState<'list' | 'chart'>('list');
  // The report's trend: fruit only (pomace oil is extraction loss, not the
  // plot's oil), oldest first as NirTrendChart expects.
  const nirTrend = useMemo(
    () => (nirRows ?? []).filter((r) => r.sampleType === 'fruit').reverse(),
    [nirRows]
  );
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

  // The picker edits areas.planting_time. A plot imported with only a label
  // ("2003", "2006/7") has no date yet, so the label seeds the picker.
  const plantYearLabel = row.plot.details?.plant_year_label ?? null;
  const initialPlantingTime =
    row.plot.planting_time?.slice(0, 10) ?? parsePlantingDate(plantYearLabel).date ?? '';

  const initialSize = row.size != null ? String(row.size) : '';

  const form = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      region: row.region ?? '',
      planting_time: initialPlantingTime,
      size: initialSize,
      water_type: toFormValue(row.waterType),
      yield_kg_per_dunam: row.yieldKgPerDunam != null ? String(row.yieldKgPerDunam) : '',
    },
  });

  // The band pill beside the yield field, live off what has been typed.
  const yieldDraft = useWatch({ control: form.control, name: 'yield_kg_per_dunam' });

  // "{שם} — {שנת נטיעה} — {זן}", live off the three fields above it.
  const nameDraft = useWatch({ control: form.control, name: 'region' });
  const plantingDraft = useWatch({ control: form.control, name: 'planting_time' });
  const composedName = useMemo(() => {
    const varietyName =
      variety.varietyId === NEW_VARIETY
        ? variety.varietyName
        : (varieties.find((v) => v.id === variety.varietyId)?.name ?? '');
    // Same rule as every other olive screen (plotDisplayName): with "שם" empty,
    // the plot's own stored name stands in for it.
    return plotDisplayName({
      name: row.plot.name,
      region: nameDraft,
      plantYearLabel: plantYearForName(plantingDraft, initialPlantingTime, plantYearLabel),
      variety: varietyName,
    });
  }, [
    nameDraft,
    plantingDraft,
    initialPlantingTime,
    plantYearLabel,
    variety,
    varieties,
    row.plot.name,
  ]);
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
          // Only when changed: the variety lives on `areas`, and an untouched
          // picker should not rewrite it.
          ...(varietyChanged(variety, row.varietyId, row.variety) && varietyPayload(variety)),
          region: values.region || null,
          // The label wins over the date wherever the year is shown, so a
          // picked date retires it — otherwise the change would not show.
          plant_year_label:
            (values.planting_time ?? '') === initialPlantingTime ? plantYearLabel : null,
          ...((values.planting_time ?? '') !== initialPlantingTime && {
            planting_time: values.planting_time || null,
          }),
          // Only when changed, like planting_time: it lives on `areas`.
          ...((values.size ?? '') !== initialSize && {
            size: values.size ? Number(values.size) : null,
          }),
          // No longer edited here, but the details write is a full-row
          // upsert — omitting them would null whatever is stored.
          plot_type: row.plotType,
          harvester: row.harvester,
          water_type: fromFormValue(values.water_type),
          takt_count: row.plot.details?.takt_count ?? null,
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

  const harvestEmpty = harvestRows?.length === 0;

  return (
    <>
      {/* Identity */}
      <div className="olive-form-hero flex shrink-0 items-start gap-4 px-6 py-5">
        <div className="olive-hero-pattern" />
        <div className="relative z-10 min-w-0 flex-1">
          {/* row.name is already "{שם} — {שנה} — {זן}" (plotDisplayName). */}
          <SheetTitle className="olive-hero-title text-xl tracking-tight md:text-2xl">
            {row.name || '—'}
          </SheetTitle>
          {row.growerName && <p className="mt-1 text-xs text-white/70">{row.growerName}</p>}
        </div>
        {/* In the flow rather than absolutely placed, so a long title wraps
            before it reaches the buttons instead of running under them. */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {/* Up here rather than in the footer: the report is about the plot as
              a whole, not about the attributes form the footer saves, and the
              footer put it next to שמור פרטים where it read as part of saving.
              While the form is dirty it does not open — the report renders the
              saved row, so unsaved edits would silently not appear on it. It
              stays clickable and says so in a toast: a disabled button's
              tooltip never shows on touch, and on desktop it read as broken. */}
          <button
            type="button"
            aria-label="הפק דוח חלקה"
            aria-disabled={form.formState.isDirty}
            onClick={() => {
              if (form.formState.isDirty) {
                showToast.info('שמור את השינויים כדי שייכללו בדוח');
                return;
              }
              onOpenReport();
            }}
            className="group inline-flex h-9 items-center gap-2 rounded-full border border-sidebar-primary/55 bg-sidebar-primary/14 ps-3.5 pe-3 text-sm font-semibold text-sidebar-accent-foreground shadow-sm transition-all hover:border-sidebar-primary/85 hover:bg-sidebar-primary/24 hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none active:scale-[0.97] aria-disabled:opacity-50 aria-disabled:hover:bg-sidebar-primary/14"
          >
            <FileText className="size-4" />
            <span className="hidden sm:inline">הפק דוח</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="flex size-9 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {/* NIR history */}
        <section className="olive-section olive-section-values px-5 py-4">
          <div className="olive-section-header">
            <div className="olive-section-icon olive-icon-values">
              <FlaskConical className="size-4" />
            </div>
            <h3 className="text-base font-bold">בדיקות NIR</h3>
            {nirRows !== null && nirRows.length > 0 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="mr-auto size-7"
                onClick={() => setNirView((v) => (v === 'list' ? 'chart' : 'list'))}
                aria-label={nirView === 'list' ? 'הצג כגרף' : 'הצג כרשימה'}
                title={nirView === 'list' ? 'הצג כגרף' : 'הצג כרשימה'}
              >
                {nirView === 'list' ? (
                  <ChartLine className="size-4" />
                ) : (
                  <List className="size-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 text-xs ${nirRows !== null && nirRows.length > 0 ? '' : 'mr-auto'}`}
              onClick={onNewNir}
            >
              <Plus className="ml-1 size-3.5" />
              בדיקה
            </Button>
          </div>

          {nirRows === null ? (
            <Skeleton />
          ) : nirRows.length === 0 ? (
            <p className="olive-muted text-sm">טרם בוצעה בדיקה בחלקה זו</p>
          ) : nirView === 'chart' ? (
            nirTrend.length < 2 ? (
              <p className="olive-muted text-sm">נדרשות לפחות 2 בדיקות פרי כדי להציג גרף מגמה</p>
            ) : (
              <NirTrendChart rows={nirTrend} />
            )
          ) : (
            <>
              {/* The latest reading on its scales; the rest as one-line
                  history. Gauges on every row turned five readings into a
                  wall — the question here is "where is it now". */}
              {(() => {
                const r = nirRows[0];
                const fruit = r.sampleType === 'fruit';
                // Fruit only — pomace oil is extraction loss and has no verdict.
                const match = fruit ? evaluateParameter(rules, 'oil', r.oil) : null;
                return (
                  <button
                    type="button"
                    onClick={() => onEditNir(r)}
                    aria-label={`ערוך בדיקה מתאריך ${r.reportDate ?? ''}`}
                    className="hover:bg-muted/40 -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold tabular-nums">{r.reportDate ?? '—'}</span>
                      <span className="olive-muted text-xs">
                        {daysSinceLabel(r.reportDate, now) ?? ''}
                      </span>
                      <NirRowMarks r={r} />
                      {match && (
                        <span
                          className={`olive-pill mr-auto ${PARAMETER_STATUS_CONFIG[match.status].pillClass}`}
                        >
                          {match.message}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                      <NirGauge
                        label="שמן"
                        value={r.oil}
                        rules={rules}
                        parameterCode="oil"
                        neutral={!fruit}
                      />
                      <NirGauge
                        label="מים"
                        value={r.water}
                        rules={rules}
                        parameterCode="water"
                        neutral={!fruit}
                      />
                    </div>
                  </button>
                );
              })()}

              {nirRows.length > 1 && (
                <ul className="mt-2 divide-y border-t text-sm">
                  {nirRows.slice(1, HISTORY_LIMIT).map((r) => {
                    const match =
                      r.sampleType === 'fruit' ? evaluateParameter(rules, 'oil', r.oil) : null;
                    return (
                      <li key={r.id}>
                        {/* text-start is load-bearing: a button centres its text. */}
                        <button
                          type="button"
                          onClick={() => onEditNir(r)}
                          aria-label={`ערוך בדיקה מתאריך ${r.reportDate ?? ''}`}
                          className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <span className="olive-muted tabular-nums">{r.reportDate ?? '—'}</span>
                          <NirRowMarks r={r} />
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
                                className={`inline-block size-2 rounded-full olive-gauge-${match.status} bg-[var(--gauge-c)]`}
                                title={match.message}
                                aria-label={match.message}
                              />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
        <section
          className={`olive-section olive-section-sample px-5 ${harvestEmpty ? 'py-3' : 'py-4'}`}
        >
          {/* Empty: one row, the note beside the title, no divider — there is
              nothing below for it to separate. The ! is needed because
              olive.css is unlayered and outranks Tailwind's utilities layer. */}
          <div className={`olive-section-header ${harvestEmpty ? 'mb-0! border-b-0! pb-0!' : ''}`}>
            <div className="olive-section-icon olive-icon-sample">
              <Tractor className="size-4" />
            </div>
            <h3 className="text-base font-bold">מעברי מסיק</h3>
            {harvestEmpty && <span className="olive-muted text-sm">טרם נרשם מסיק</span>}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mr-auto h-7 text-xs"
              onClick={onNewHarvest}
            >
              <Plus className="ml-1 size-3.5" />
              מעבר
            </Button>
          </div>

          {harvestRows === null ? (
            <Skeleton />
          ) : harvestEmpty ? null : (
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
          <form id="plot-details-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* One row, no body: a single figure does not need the header /
                divider / label stack the list sections use. */}
            <section className="olive-section olive-section-type px-5 py-3">
              {/* Not an olive_plot_details column — it lives in
                  yield_estimates, keyed by season, and is saved by a second
                  request from the same submit. */}
              <FormField
                control={form.control}
                name="yield_kg_per_dunam"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="olive-section-icon olive-icon-type">
                        <Sprout className="size-4" />
                      </div>
                      <FormLabel className="text-base font-bold">יבול צפוי</FormLabel>
                      {seasonId ? (
                        yieldLoad && (
                          <span
                            className={`olive-pill ${PARAMETER_STATUS_CONFIG[yieldLoad.status].pillClass}`}
                          >
                            {yieldLoad.label}
                          </span>
                        )
                      ) : (
                        <span className="olive-muted text-xs">אין עונה פעילה</span>
                      )}
                      <div className="mr-auto flex items-center gap-2">
                        <FormControl>
                          <Input
                            className="h-9 w-24 text-center tabular-nums"
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
                        <span className="olive-muted text-xs whitespace-nowrap">ק״ג/דונם</span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

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
                {/* Order follows the client's naming: שם (the block or nickname,
                    stored as region), planting date, variety — the three parts
                    of a plot name like "מיצר — 2003 — ארבקינה". */}
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">שם</FormLabel>
                      <FormControl>
                        <Input className="h-9" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="planting_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">תאריך נטיעה</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <label className="text-sm font-semibold" id="plot-detail-variety">
                    זן
                  </label>
                  <div className="mt-2" aria-labelledby="plot-detail-variety">
                    <VarietyPicker varieties={varieties} value={variety} onChange={setVariety} />
                  </div>
                </div>

                {/* Calculated, not stored — the client's naming convention made
                    visible, so a mistyped part shows up before saving. */}
                <div>
                  <label className="text-sm font-semibold" htmlFor="plot-detail-composed-name">
                    שם מלא (שם-שנת נטיעה-זן)
                  </label>
                  <Input
                    id="plot-detail-composed-name"
                    className="bg-muted/40 mt-2 h-9"
                    value={composedName}
                    readOnly
                    tabIndex={-1}
                    placeholder="—"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">גודל (דונם)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <label className="text-sm font-semibold" id="plot-detail-grower">
                    מגדל
                  </label>
                  <div className="mt-2" aria-labelledby="plot-detail-grower">
                    <GrowerPicker growers={growers} value={grower} onChange={setGrower} />
                  </div>
                </div>

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
                            {/* w-full: the trigger sizes to its content by
                                default, so an unset select collapsed to the
                                width of "—" and sat in a grid column beside
                                full-width text inputs. */}
                            <SelectTrigger className="h-9 w-full">
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
              </div>
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

/**
 * The sent glyph and the pomace tag, shared by the latest-reading card and the
 * history rows. This list has its own markup, so it does not inherit the log's
 * נשלח column; without the glyph, marking a reading sent in the log and then
 * opening the plot would look like it had not taken.
 */
function NirRowMarks({ r }: { r: NirRow }) {
  return (
    <>
      {r.sentToClientAt && (
        <span
          className="inline-flex"
          title={`נשלח ללקוח ב-${r.sentToClientAt}`}
          aria-label="נשלח ללקוח"
        >
          <MailCheck className="text-primary size-3.5" />
        </span>
      )}
      {r.sampleType === 'pomace' && (
        <span className="olive-pill olive-pill-sample">{NIR_SAMPLE_TYPE_LABELS.pomace}</span>
      )}
    </>
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
