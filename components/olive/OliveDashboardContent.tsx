'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronDown, Settings2, Sprout } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useUser } from '@/components/providers/UserProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { OliveThresholdsDialog } from './OliveThresholdsDialog';
import { WeatherStrip } from './WeatherStrip';
import {
  computeUpcomingWeather,
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
const LEVEL_TITLES: Record<UrgencyLevel, string> = {
  urgent: 'דחוף',
  plan: 'מתוכנן',
  ok: 'ללא דחיפות מיוחדת',
};

export function OliveDashboardContent() {
  const { data, loading, error, refetch } = useApiData<DashboardPayload>('/api/olive/dashboard');
  const { user } = useUser();
  const [filter, setFilter] = useState<PlotCategory | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        };
      });

    const counts = { ...EMPTY_COUNTS };
    for (const row of rows) counts[row.category] += 1;

    const attention = rows
      .filter((r) => r.status.level !== 'ok')
      .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level])
      .slice(0, 5);

    return {
      rows,
      counts,
      weather,
      weatherBands,
      weatherFreshness,
      attention,
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">
                  {data.season.name}
                  {data.season.year_type && (
                    <span className="olive-muted mr-2 text-sm font-normal">
                      ({data.season.year_type === 'ON' ? 'שנה עמוסה' : 'שנה מועטה'})
                    </span>
                  )}
                </h2>
                <span className="olive-muted text-sm">
                  {model.harvestedCount} מתוך {totalPlots} חלקות נמסקו
                </span>
              </div>
              <div className="olive-progress-track mt-2">
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

          {/* The forecast, unconditionally — including when it is calm or absent.
              Not filtered with the list below it: weather is context for the whole
              grove, where "מבט על" is a view of the same rows the filter narrows. */}
          <WeatherStrip
            weather={model.weather}
            thresholds={model.weatherBands}
            freshness={model.weatherFreshness}
            now={now}
          />

          {/* מבט על — always visible, no clicking required */}
          {model.attention.length > 0 && !filter && (
            <section className="olive-overview p-4">
              <h2 className="mb-2 font-bold">מבט על — מה דחוף עכשיו</h2>
              {model.attention.map((row) => (
                <div key={row.plot.id} className="olive-overview-row flex items-start gap-2 py-2">
                  <span className={`olive-dot mt-1.5 olive-dot-${row.status.level}`} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{row.plot.name}</div>
                    <div className="olive-muted text-xs">{row.status.headline}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

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

          {/* Alerts grouped by grower type */}
          <div className="grid gap-3 md:grid-cols-3">
            {GROWER_GROUPS.map((group) => {
              const groupRows = visible
                .filter((r) => r.plot.details?.plot_type === group.type)
                .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level]);

              return (
                <details key={group.type} className="olive-card overflow-hidden" open={!!filter}>
                  <summary className="flex cursor-pointer items-center justify-between p-4 font-bold">
                    {group.label}
                    <span className="olive-muted text-sm font-semibold">({groupRows.length})</span>
                  </summary>
                  <div className="space-y-2 border-t p-3">
                    {groupRows.length === 0 ? (
                      <p className="olive-muted py-4 text-center text-sm">אין חלקות בקטגוריה זו</p>
                    ) : (
                      groupRows.map((row) => (
                        <details
                          key={row.plot.id}
                          className={`olive-alert olive-alert-${row.status.level}`}
                        >
                          <summary className="flex cursor-pointer items-start gap-2 p-3">
                            <span className={`olive-dot mt-1.5 olive-dot-${row.status.level}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">
                                {row.plot.name}
                              </span>
                              <span className="olive-muted block text-xs">
                                {row.status.headline}
                              </span>
                            </span>
                          </summary>
                          <div className="space-y-2 border-t p-3 text-xs">
                            {row.nir ? (
                              <>
                                <div className="olive-muted">
                                  נמדד {row.lastMeasured ?? '—'}
                                  {row.status.oilMatch && (
                                    <span
                                      className={`olive-pill ${
                                        PARAMETER_STATUS_CONFIG[row.status.oilMatch.status]
                                          .pillClass
                                      } mr-2`}
                                    >
                                      {row.status.oilMatch.message}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div className="olive-kpi">
                                    <span className="olive-kpi-label">שמן</span>
                                    <span className="olive-kpi-value">{row.nir.oil ?? '—'}%</span>
                                  </div>
                                  <div className="olive-kpi">
                                    <span className="olive-kpi-label">מים</span>
                                    <span className="olive-kpi-value">{row.nir.water ?? '—'}%</span>
                                  </div>
                                  <div className="olive-kpi">
                                    <span className="olive-kpi-label">שמן בחו״י</span>
                                    <span className="olive-kpi-value">{row.nir.dry ?? '—'}%</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="olive-muted">טרם בוצעה בדיקת NIR בחלקה זו</p>
                            )}
                            {row.status.windowLine && (
                              <p className="olive-muted">{row.status.windowLine}</p>
                            )}
                            <Link
                              href={`/olive/nir?areaId=${row.plot.id}`}
                              className="inline-block underline"
                            >
                              הוסף בדיקה
                            </Link>
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          <p className="olive-muted flex items-center gap-1 text-xs">
            <ChevronDown className="size-3" />
            מיון בכל קטגוריה: {LEVEL_TITLES.urgent} → {LEVEL_TITLES.plan} → {LEVEL_TITLES.ok}
          </p>
        </div>
      )}
    </div>
  );
}
