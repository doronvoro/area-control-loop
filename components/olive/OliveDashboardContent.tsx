'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlarmClock,
  FlaskConical,
  Loader2,
  RotateCcw,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { WeatherStrip } from './WeatherStrip';
import { NirGauge } from './NirGauge';
import {
  computeUpcomingWeather,
  evaluateParameter,
  computePlotStatus,
  classifyPlotCategory,
  daysSinceLabel,
  type CategoryThresholds,
  type PlotCategory,
  type UrgencyLevel,
} from '@/lib/olive/logic';
import {
  toPlotLike,
  toNirLike,
  toWeatherDayLike,
  toVarietyWindowLike,
  toCategoryThresholds,
  toWeatherThresholds,
  type ApiPlot,
} from '@/lib/olive/adapt';
import { forecastFreshness } from '@/lib/olive/weather-view';
import { PLOT_CATEGORY_CARDS } from '@/lib/olive/constants';
import {
  PARAMETER_STATUS_CONFIG,
  PLOT_TYPE_LABELS,
  ParameterStatus,
  PlotType,
  type ParameterRule,
} from '@/types/database';

interface DashboardPayload {
  plots: ApiPlot[];
  latestNir: Record<string, any>;
  yieldEstimates: Record<string, any>;
  harvestedAreaIds: string[];
  parameterRules: ParameterRule[];
  categoryThresholds: Record<string, unknown> | null;
  varietyWindows: Record<string, unknown>[];
  weatherDays: Record<string, unknown>[];
  weatherThresholds: Record<string, unknown> | null;
  season: { id: string; name: string; year_type: string | null } | null;
  /** Readings in the season, and how many have not reached the client. */
  nirCounts?: { total: number; unsent: number };
}

const GROWER_GROUPS: { type: PlotType; label: string }[] = [
  { type: PlotType.OWNER, label: PLOT_TYPE_LABELS[PlotType.OWNER] },
  { type: PlotType.PARTNER, label: PLOT_TYPE_LABELS[PlotType.PARTNER] },
  { type: PlotType.OCCASIONAL, label: PLOT_TYPE_LABELS[PlotType.OCCASIONAL] },
];

const EMPTY_COUNTS: Record<PlotCategory, number> = {
  testing: 0,
  normal: 0,
  anomaly: 0,
  ready: 0,
};

const LEVEL_ORDER: Record<UrgencyLevel, number> = { urgent: 0, plan: 1, ok: 2 };
const URGENCY_OPTIONS: { level: UrgencyLevel; label: string }[] = [
  { level: 'urgent', label: 'דחוף' },
  { level: 'plan', label: 'מתוכנן' },
  { level: 'ok', label: 'ללא דחיפות' },
];

export function OliveDashboardContent() {
  const { data, loading, error, refetch } = useApiData<DashboardPayload>('/api/olive/dashboard');
  const [filter, setFilter] = useState<PlotCategory | null>(null);
  // Each filter holds the options the reader has UNchecked, so "nothing
  // hidden" — every box checked — is the empty default.
  const [hiddenGrowers, setHiddenGrowers] = useState<Set<PlotType>>(new Set());
  const [hiddenTested, setHiddenTested] = useState<Set<'with' | 'without'>>(new Set());
  const [hiddenUrgency, setHiddenUrgency] = useState<Set<UrgencyLevel>>(new Set());
  const [search, setSearch] = useState('');
  /** The search box is an icon until asked for, and folds back when left empty. */
  const [searchOpen, setSearchOpen] = useState(false);

  // `now` is fixed for the render so every plot is judged against one instant.
  const now = useMemo(() => new Date(), []);

  const model = useMemo(() => {
    if (!data) return null;

    const rules = data.parameterRules || [];
    const bands = toCategoryThresholds(data.categoryThresholds);
    const windows = (data.varietyWindows || []).map(toVarietyWindowLike);
    const weatherBands = toWeatherThresholds(data.weatherThresholds);
    const weather = computeUpcomingWeather(
      (data.weatherDays || []).map(toWeatherDayLike),
      now,
      weatherBands
    );
    const weatherFreshness = forecastFreshness(data.weatherDays || [], now);
    const harvested = new Set(data.harvestedAreaIds || []);

    const rows = (data.plots || [])
      .filter((plot) => !harvested.has(plot.id))
      .map((plot) => {
        const nir = toNirLike(data.latestNir?.[plot.id]);
        const plotLike = toPlotLike(plot);
        return {
          plot,
          plotLike,
          nir,
          status: computePlotStatus(plotLike, nir, rules, weather, windows, now),
          category: classifyPlotCategory(nir, rules, bands),
          lastMeasured: daysSinceLabel(nir?.report_date ?? null, now),
          growerLabel: GROWER_GROUPS.find((g) => g.type === plot.details?.plot_type)?.label,
        };
      });

    const counts = { ...EMPTY_COUNTS };
    for (const row of rows) counts[row.category] += 1;

    return {
      rows,
      counts,
      weather,
      bands,
      weatherBands,
      weatherFreshness,
      harvestedCount: harvested.size,
    };
  }, [data, now]);

  // The FIRST load only. refetch() flips `loading` back on, and swapping the
  // whole page for a spinner then would throw away the reader's filters and
  // scroll — the list dims instead (aria-busy below).
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  const visible = filter ? (model?.rows ?? []).filter((r) => r.category === filter) : model?.rows;
  const empty = !model || model.rows.length === 0;
  const rules = data?.parameterRules ?? [];
  // Each filter narrows what the ones after it count, so the number on a
  // button is always what clicking it would show.
  const query = search.trim().toLowerCase();
  const searched = (visible ?? []).filter(
    (r) => !query || (r.plot.name ?? '').toLowerCase().includes(query)
  );
  const byGrower = searched.filter(
    (r) => !hiddenGrowers.has(r.plot.details?.plot_type as PlotType)
  );
  // A report with no oil, water or dry figure (a pomace sample, say) has
  // nothing to read on this screen, so it counts as untested here.
  const hasReading = (r: (typeof byGrower)[number]) =>
    !!r.nir && (r.nir.oil !== null || r.nir.water !== null || r.nir.dry !== null);
  const byTested = byGrower.filter((r) => !hiddenTested.has(hasReading(r) ? 'with' : 'without'));
  const singleGrower = GROWER_GROUPS.length - hiddenGrowers.size === 1;
  const listed = byTested
    .filter((r) => !hiddenUrgency.has(r.status.level))
    .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level]);
  const totalPlots = model ? model.rows.length + model.harvestedCount : 0;

  return (
    <div className="space-y-5">
      {error && (
        <div className="py-12 text-center text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={refetch}>
            נסה שוב
          </Button>
        </div>
      )}

      {!error && empty && (
        <div className="olive-card p-8 text-center">
          <p className="olive-muted">אין חלקות פעילות להצגה.</p>
          <Link href="/olive/plots" className="mt-2 inline-block text-sm underline">
            מעבר לניהול חלקות
          </Link>
        </div>
      )}

      {!error && !empty && model && visible && (
        <div
          aria-busy={loading}
          className={`space-y-5 ${loading ? 'opacity-60 transition-opacity' : ''}`}
        >
          {/* Season + harvest progress */}
          {data?.season && (
            <section className="olive-card p-4">
              {/* One line: season, its NIR readings, harvest count. */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h2 className="font-bold">
                    {data.season.name}
                    {data.season.year_type && (
                      <span className="olive-muted mr-2 text-sm font-normal">
                        ({data.season.year_type === 'ON' ? 'שנה עמוסה' : 'שנה מועטה'})
                      </span>
                    )}
                  </h2>
                  {/* Deliberately here and not a fifth status card: those four are
                      toggle-filters that narrow the list in place, so a card that
                      navigated away would look identical and behave differently on
                      click. They also count plots, where this counts readings. This
                      card already carries the season's other headline number. */}
                  {data?.nirCounts && (
                    <span className="olive-muted flex flex-wrap items-center gap-2 text-sm">
                      <span>סה״כ {data.nirCounts.total} בדיקות NIR בעונה</span>
                      {data.nirCounts.unsent > 0 ? (
                        <>
                          <span aria-hidden>·</span>
                          <Link
                            href="/olive/nir?sent=unsent"
                            className="olive-pill olive-pill-plan hover:opacity-80"
                          >
                            {data.nirCounts.unsent} טרם נשלחו ללקוח
                          </Link>
                        </>
                      ) : (
                        data.nirCounts.total > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            {/* Zero reads as done, not as a call to action, so it is
                                not a link to an empty list. */}
                            <span>הכול נשלח ללקוח</span>
                          </>
                        )
                      )}
                    </span>
                  )}
                </div>
                <span className="olive-muted text-sm">
                  {model.harvestedCount} מתוך {totalPlots} חלקות נמסקו
                </span>
              </div>
              <div className="olive-progress-track mt-3">
                <div
                  className="olive-progress-fill"
                  style={{
                    width: totalPlots
                      ? `${Math.round((model.harvestedCount / totalPlots) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
            </section>
          )}

          {/* Under the season card, and collapsed — the header alone carries the warning count.
              The forecast, unconditionally — including when it is calm or absent.
              Not filtered with the list below it: weather is context for the whole
              grove, where the list below is what the filters narrow. */}
          <WeatherStrip
            weather={model.weather}
            thresholds={model.weatherBands}
            freshness={model.weatherFreshness}
            now={now}
            onRefreshed={refetch}
          />

          {/* Status cards — clicking one filters the list below */}
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PLOT_CATEGORY_CARDS.map((card) => (
              <Tooltip key={card.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={filter === card.key}
                    onClick={() => setFilter(filter === card.key ? null : card.key)}
                    className={`olive-status-card ${card.className}`}
                  >
                    <div className="olive-status-count">{model.counts[card.key]}</div>
                    <div className="olive-status-label">{card.label}</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-center">
                  {categoryRule(card.key, model.bands, rules)}
                </TooltipContent>
              </Tooltip>
            ))}
          </section>

          {filter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="olive-muted">
                מסונן: <b>{PLOT_CATEGORY_CARDS.find((c) => c.key === filter)?.label}</b>
              </span>
              <button type="button" onClick={() => setFilter(null)} className="underline">
                נקה סינון
              </button>
            </div>
          )}

          {/* Plot filters — one list, narrowed, instead of a column per grower. */}
          <section className="space-y-3">
            {/* One toolbar line — search, grower, tests, urgency — wrapping only when narrow. */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              {searchOpen || search ? (
                <div className="relative w-full sm:w-44">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onBlur={() => !search && setSearchOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearch('');
                        setSearchOpen(false);
                      }
                    }}
                    placeholder="חיפוש חלקה"
                    aria-label="חיפוש חלקה"
                    className="h-8 pr-8 pl-7 text-sm"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSearchOpen(false);
                      }}
                      aria-label="נקה חיפוש"
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 left-2 -translate-y-1/2"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  aria-label="חיפוש חלקה"
                  title="חיפוש חלקה"
                  className="bg-muted/70 hover:bg-muted size-8 rounded-lg"
                >
                  <Search className="size-4" />
                </Button>
              )}

              <FilterGroup
                label="סוג מגדל"
                icon={Users}
                hidden={hiddenGrowers}
                onChange={setHiddenGrowers}
                options={GROWER_GROUPS.map((g) => ({
                  value: g.type,
                  label: g.label,
                  count: searched.filter((r) => r.plot.details?.plot_type === g.type).length,
                }))}
              />

              <FilterGroup
                label="בדיקת NIR"
                icon={FlaskConical}
                hidden={hiddenTested}
                onChange={setHiddenTested}
                options={[
                  { value: 'with', label: 'נבדקו', count: byGrower.filter(hasReading).length },
                  {
                    value: 'without',
                    label: 'לא נבדקו',
                    count: byGrower.filter((r) => !hasReading(r)).length,
                  },
                ]}
              />

              <FilterGroup
                label="דחיפות מסיק"
                icon={AlarmClock}
                hidden={hiddenUrgency}
                onChange={setHiddenUrgency}
                options={URGENCY_OPTIONS.map((o) => ({
                  value: o.level,
                  label: o.label,
                  count: byTested.filter((r) => r.status.level === o.level).length,
                  dot: o.level,
                }))}
              />

              {(search ||
                hiddenGrowers.size > 0 ||
                hiddenTested.size > 0 ||
                hiddenUrgency.size > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                    setHiddenGrowers(new Set());
                    setHiddenTested(new Set());
                    setHiddenUrgency(new Set());
                  }}
                  className="text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  איפוס
                </Button>
              )}
            </div>

            {/* Sorted דחוף → מתוכנן → ללא דחיפות מיוחדת */}
            {listed.length === 0 ? (
              <p className="olive-card olive-muted p-6 text-center text-sm">אין חלקות בסינון זה</p>
            ) : (
              <div className="space-y-2">
                {listed.map((row) => (
                  // One line per plot: who and what on the right, the three
                  // readings on their bands beside it. Nothing to expand — the
                  // row already holds everything the old details panel did.
                  <div
                    key={row.plot.id}
                    className={`olive-alert olive-alert-${row.status.level} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-6`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className={`olive-dot mt-1.5 olive-dot-${row.status.level}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-bold">{row.plot.name}</span>
                          {/* Which grower, when the list is not already narrowed to one. */}
                          {!singleGrower && row.growerLabel && (
                            <span className="olive-pill olive-pill-idle shrink-0">
                              {row.growerLabel}
                            </span>
                          )}
                          {row.status.oilMatch && (
                            <span
                              className={`olive-pill shrink-0 ${
                                PARAMETER_STATUS_CONFIG[row.status.oilMatch.status].pillClass
                              }`}
                            >
                              {row.status.oilMatch.message}
                            </span>
                          )}
                        </div>
                        <p className="olive-muted mt-0.5 text-xs">
                          {row.nir && row.lastMeasured
                            ? `נמדד ${row.lastMeasured}, ${row.status.headline}`
                            : row.status.headline}
                        </p>
                        {row.status.windowLine && (
                          <p className="olive-muted text-xs">{row.status.windowLine}</p>
                        )}
                      </div>
                    </div>

                    {/* The three readings as figures; each opens its band chart on hover. */}
                    {row.nir ? (
                      <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:w-80">
                        <NirReading label="שמן" value={row.nir.oil} code="oil" rules={rules} />
                        <NirReading label="מים" value={row.nir.water} code="water" rules={rules} />
                        <NirReading
                          label="שמן בחו״י"
                          value={row.nir.dry}
                          code="dry"
                          rules={rules}
                        />
                      </div>
                    ) : (
                      <p className="olive-muted shrink-0 text-xs sm:w-80 sm:text-center">
                        טרם בוצעה בדיקת NIR
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <Link href="/olive/classic" className="olive-muted inline-block text-xs underline">
            לתצוגה הקודמת
          </Link>
        </div>
      )}
    </div>
  );
}

interface FilterOption<T> {
  value: T;
  label: string;
  count: number;
  dot?: UrgencyLevel;
}

/**
 * One filter dimension as a row of checkable chips, all checked by default.
 * A click toggles one option; the last checked option cannot be cleared, since
 * an empty group would hide every plot and look like missing data.
 */
function FilterGroup<T extends string>({
  label,
  icon: Icon,
  hidden,
  onChange,
  options,
}: {
  label: string;
  icon: LucideIcon;
  hidden: Set<T>;
  onChange: (hidden: Set<T>) => void;
  options: FilterOption<T>[];
}) {
  const toggle = (value: T) => {
    const next = new Set(hidden);
    if (next.has(value)) next.delete(value);
    else if (options.some((o) => o.value !== value && !next.has(o.value))) next.add(value);
    onChange(next);
  };

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      {/* The dimension's name as a caption over its track, so the track holds
          only choices. */}
      <span className="olive-muted flex items-center gap-1 ps-1 text-[11px] font-semibold">
        <Icon className="size-3 opacity-70" aria-hidden />
        {label}
      </span>
      <div className="bg-muted/70 flex h-8 items-center gap-0.5 rounded-lg p-0.5 whitespace-nowrap">
        {options.map((option) => {
          const checked = !hidden.has(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={checked}
              onClick={() => toggle(option.value)}
              className={cn(
                'h-7 gap-1 rounded-md px-2 text-xs font-medium',
                checked
                  ? 'text-foreground bg-white shadow-sm hover:bg-white'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-transparent'
              )}
            >
              {option.dot && (
                <span
                  className={cn(`olive-dot olive-dot-${option.dot}`, !checked && 'opacity-40')}
                />
              )}
              {option.label}
              <span className="olive-ltr-num opacity-70">{option.count}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One NIR figure, coloured by its verdict, that shows its band chart on hover.
 *
 * A Popover rather than a HoverCard so a tap opens it too — the field team is
 * on phones. The close is delayed so the pointer can cross the gap into the
 * chart without it vanishing, and the chart's band tooltips stay reachable.
 */
function NirReading({
  label,
  value,
  code,
  rules,
}: {
  label: string;
  value: number | null;
  code: string;
  rules: ParameterRule[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const match = value === null ? null : evaluateParameter(rules, code, value);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={show}
          onMouseLeave={hide}
          className={`olive-kpi olive-kpi-reading olive-gauge-${match?.status ?? 'neutral'}`}
          aria-label={`${label}: ${value === null ? 'אין ערך' : `${value}%`}${match ? `, ${match.message}` : ''}`}
        >
          <span className="olive-kpi-label">{label}</span>
          <span className="olive-kpi-value olive-ltr-num">
            {value === null ? '—' : `${value}%`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-80 p-3"
        onMouseEnter={show}
        onMouseLeave={hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <NirGauge label={label} value={value} rules={rules} parameterCode={code} />
        {match && (
          <p
            className={`olive-gauge-${match.status} -mt-1 text-xs font-semibold text-[var(--gauge-c)]`}
          >
            {match.message}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * What puts a plot in a category, in the live thresholds — the same checks,
 * in the same order, as classifyPlotCategory. Built from the settings rather
 * than written out, so tuning a threshold changes the tooltip with the counts.
 */
function categoryRule(
  category: PlotCategory,
  t: CategoryThresholds,
  rules: ParameterRule[]
): string {
  switch (category) {
    case 'ready':
      return `שמן ${t.readyOilMin}–${t.readyOilMax}% ומים ${t.readyWaterMin}–${t.readyWaterMax}% בבדיקה האחרונה`;
    case 'anomaly': {
      const dryUrgentFrom = dryUrgentLowerBound(rules);
      const dry = dryUrgentFrom === null ? '' : `, או שמן בחו״י מעל ${dryUrgentFrom}%`;
      return `מים מתחת ל-${t.anomalyWaterLow}% או מעל ${t.anomalyWaterHigh}%${dry}`;
    }
    case 'normal':
      return `שמן עד ${t.normalOilMax}% ומים עד ${t.normalWaterMax}% — עדיין לא בשל`;
    case 'testing':
      return 'אין עדיין בדיקת NIR, או שהבדיקה האחרונה לא נופלת באף קטגוריה אחרת';
  }
}

/** Where the dry-matter urgent band starts: the upper bound of the rule before it. */
function dryUrgentLowerBound(rules: ParameterRule[]): number | null {
  const dry = rules
    .filter((r) => r.parameter_code === 'dry')
    .sort((a, b) => a.sort_order - b.sort_order);
  const i = dry.findIndex((r) => r.status === ParameterStatus.URGENT);
  if (i <= 0 || dry[i - 1].upper_bound == null) return null;
  const bound = Number(dry[i - 1].upper_bound);
  return Number.isFinite(bound) ? bound : null;
}
