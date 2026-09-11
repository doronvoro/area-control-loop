'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronDown, Droplets, Wind, CloudRain } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
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
  type ApiPlot,
} from '@/lib/olive/adapt';
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
  varietyWindows: Record<string, unknown>[];
  weatherDays: Record<string, unknown>[];
  season: { id: string; name: string; year_type: string | null } | null;
}

const CATEGORY_CARDS: { key: PlotCategory; label: string; className: string }[] = [
  { key: 'testing', label: 'בבדיקות', className: 'olive-sc-testing' },
  { key: 'normal', label: 'חלקות תקינות', className: 'olive-sc-normal' },
  { key: 'anomaly', label: 'חריגות', className: 'olive-sc-anomaly' },
  { key: 'ready', label: 'מוכן למסיק', className: 'olive-sc-ready' },
];

const GROWER_GROUPS: { type: PlotType; label: string }[] = [
  { type: PlotType.OWNER, label: PLOT_TYPE_LABELS[PlotType.OWNER] },
  { type: PlotType.PARTNER, label: PLOT_TYPE_LABELS[PlotType.PARTNER] },
  { type: PlotType.OCCASIONAL, label: PLOT_TYPE_LABELS[PlotType.OCCASIONAL] },
];

const LEVEL_ORDER: Record<UrgencyLevel, number> = { urgent: 0, plan: 1, ok: 2 };
const LEVEL_TITLES: Record<UrgencyLevel, string> = {
  urgent: 'דחוף',
  plan: 'מתוכנן',
  ok: 'ללא דחיפות מיוחדת',
};

export function OliveDashboardContent() {
  const { data, loading, error } = useApiData<DashboardPayload>('/api/olive/dashboard');
  const [filter, setFilter] = useState<PlotCategory | null>(null);

  // `now` is fixed for the render so every plot is judged against one instant.
  const now = useMemo(() => new Date(), []);

  const model = useMemo(() => {
    if (!data) return null;

    const rules = data.parameterRules || [];
    const windows = (data.varietyWindows || []).map(toVarietyWindowLike);
    const weather = computeUpcomingWeather((data.weatherDays || []).map(toWeatherDayLike), now);
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
          category: classifyPlotCategory(nir, rules),
          lastMeasured: daysSinceLabel(nir?.report_date ?? null, now),
        };
      });

    const counts: Record<PlotCategory, number> = {
      testing: 0,
      normal: 0,
      anomaly: 0,
      ready: 0,
    };
    for (const row of rows) counts[row.category] += 1;

    const attention = rows
      .filter((r) => r.status.level !== 'ok')
      .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level])
      .slice(0, 5);

    return { rows, counts, weather, attention, harvestedCount: harvested.size };
  }, [data, now]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (!model || model.rows.length === 0) {
    return (
      <div className="olive-card p-8 text-center">
        <p className="olive-muted">אין חלקות פעילות להצגה.</p>
        <Link href="/olive/plots" className="mt-2 inline-block text-sm underline">
          מעבר לניהול חלקות
        </Link>
      </div>
    );
  }

  const visible = filter ? model.rows.filter((r) => r.category === filter) : model.rows;
  const totalPlots = model.rows.length + model.harvestedCount;

  return (
    <div className="space-y-5">
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
        {CATEGORY_CARDS.map((card) => (
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

      {/* Weather flags that are currently affecting urgency */}
      {model.weather.weatherLines.length > 0 && (
        <section className="olive-card space-y-1 p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <CloudRain className="size-4" /> מזג אוויר משפיע
          </h2>
          {model.weather.weatherLines.map((line) => (
            <p key={line} className="flex items-center gap-2 text-sm">
              {line.startsWith('רוח') ? (
                <Wind className="size-3.5 shrink-0" />
              ) : (
                <Droplets className="size-3.5 shrink-0" />
              )}
              {line}
            </p>
          ))}
        </section>
      )}

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
            מסונן: <b>{CATEGORY_CARDS.find((c) => c.key === filter)?.label}</b>
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
                          <span className="block truncate text-sm font-bold">{row.plot.name}</span>
                          <span className="olive-muted block text-xs">{row.status.headline}</span>
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
                                    PARAMETER_STATUS_CONFIG[row.status.oilMatch.status].pillClass
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
  );
}
