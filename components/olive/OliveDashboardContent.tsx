'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, Settings2, Sprout } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useUser } from '@/components/providers/UserProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { OliveThresholdsDialog } from './OliveThresholdsDialog';
import { WeatherStrip } from './WeatherStrip';
import { NirGauge } from './NirGauge';
import {
  computeUpcomingWeather,
  evaluateParameter,
  computePlotStatus,
  classifyPlotCategory,
  daysSinceLabel,
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
  const { user } = useUser();
  const [filter, setFilter] = useState<PlotCategory | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Grower type narrowing the plot list; null is every grower. */
  const [grower, setGrower] = useState<PlotType | null>(null);
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null);
  const [search, setSearch] = useState('');

  // Matches the RLS on plot_category_thresholds and parameter_rules, and the
  // requireAdminOrCustomerOwner guard both PUT routes run. A plain worker gets
  // no gear at all rather than a disabled one — nothing hints the settings are
  // there, because for them they are not.
  const canManageThresholds = !!user && (user.isAdmin || user.isCustomerOwner);

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
      weatherBands,
      weatherFreshness,
      harvestedCount: harvested.size,
    };
  }, [data, now]);

  /** The settings preview's only input. Memoised so typing in it does not rebuild the list. */
  const previewNirs = useMemo(() => (model?.rows ?? []).map((r) => r.nir), [model]);

  // The FIRST load only. refetch() flips `loading` back on, and returning the
  // spinner then would unmount the settings dialog the save came from — the
  // same reason NirPageContent guards its spinner with `&& !payload`.
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
  const byGrower = searched.filter((r) => !grower || r.plot.details?.plot_type === grower);
  const listed = byGrower
    .filter((r) => !urgency || r.status.level === urgency)
    .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level]);
  const totalPlots = model ? model.rows.length + model.harvestedCount : 0;

  return (
    <div className="space-y-5">
      <PageHeader icon={Sprout} title="מסיק" description="סטטוס הבשלה ודחיפות מסיק לכל החלקות">
        {canManageThresholds && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!data}
            onClick={() => setSettingsOpen(true)}
            aria-label="הגדרת ספי מסיק"
            title="הגדרת ספי מסיק"
          >
            <Settings2 className="size-4" />
          </Button>
        )}
      </PageHeader>

      {canManageThresholds && data && (
        <OliveThresholdsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          categoryThresholds={data.categoryThresholds}
          weatherThresholds={data.weatherThresholds}
          rules={data.parameterRules || []}
          nirs={previewNirs}
          weatherDays={data.weatherDays || []}
          currentCounts={model?.counts ?? EMPTY_COUNTS}
          onSaved={refetch}
        />
      )}

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
          {/* First on the page, and collapsed — the header alone carries the warning count.
              The forecast, unconditionally — including when it is calm or absent.
              Not filtered with the list below it: weather is context for the whole
              grove, where the list below is what the filters narrow. */}
          <WeatherStrip
            weather={model.weather}
            thresholds={model.weatherBands}
            freshness={model.weatherFreshness}
            now={now}
          />

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

          {/* Status cards — clicking one filters the list below */}
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PLOT_CATEGORY_CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                aria-pressed={filter === card.key}
                onClick={() => setFilter(filter === card.key ? null : card.key)}
                className={`olive-status-card ${card.className}`}
              >
                <div className="olive-status-count">{model.counts[card.key]}</div>
                <div className="olive-status-label">{card.label}</div>
              </button>
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
            {/* One toolbar line — search, grower, urgency — wrapping only when narrow. */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-56">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש חלקה"
                  aria-label="חיפוש חלקה"
                  className="pr-8"
                />
              </div>

              <FilterGroup
                label="מגדל"
                value={grower}
                onChange={setGrower}
                options={[
                  { value: null, label: 'הכל', count: searched.length },
                  ...GROWER_GROUPS.map((g) => ({
                    value: g.type,
                    label: g.label,
                    count: searched.filter((r) => r.plot.details?.plot_type === g.type).length,
                  })),
                ]}
              />

              <FilterGroup
                label="דחיפות"
                value={urgency}
                onChange={setUrgency}
                options={[
                  { value: null, label: 'הכל', count: byGrower.length },
                  ...URGENCY_OPTIONS.map((o) => ({
                    value: o.level,
                    label: o.label,
                    count: byGrower.filter((r) => r.status.level === o.level).length,
                    dot: o.level,
                  })),
                ]}
              />
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
                          {!grower && row.growerLabel && (
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
  value: T | null;
  label: string;
  count: number;
  dot?: UrgencyLevel;
}

/**
 * One filter dimension as a labelled segmented control. Each group owns its
 * "הכל", so which dimension a button narrows — and how to undo it — is on
 * screen rather than implied by a toggle-off click.
 */
function FilterGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: FilterOption<T>[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted/70 flex flex-wrap items-center gap-0.5 rounded-lg p-1"
    >
      <span className="olive-muted px-2 text-xs font-semibold">{label}</span>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value ?? 'all'}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 gap-1.5 rounded-md px-2.5 font-medium',
              active
                ? 'text-foreground bg-white font-semibold shadow-sm hover:bg-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
            )}
          >
            {option.dot && <span className={`olive-dot olive-dot-${option.dot}`} />}
            {option.label}
            <span className="olive-ltr-num opacity-70">{option.count}</span>
          </Button>
        );
      })}
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
