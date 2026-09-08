'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useApiData } from '@/hooks/useApiData';
import {
  plotMatchesSearch,
  yieldLoadInfo,
  daysSinceLabel,
  classifyPlotCategory,
} from '@/lib/olive/logic';
import { toPlotLike, toNirLike, type ApiPlot } from '@/lib/olive/adapt';
import {
  PARAMETER_STATUS_CONFIG,
  PLOT_TYPE_LABELS,
  HARVESTER_LABELS,
  WATER_TYPE_LABELS,
  PlotType,
  type ParameterRule,
} from '@/types/database';

interface DashboardPayload {
  plots: ApiPlot[];
  latestNir: Record<string, any>;
  yieldEstimates: Record<string, any>;
  harvestedAreaIds: string[];
  parameterRules: ParameterRule[];
}

const CATEGORY_LABELS: Record<string, string> = {
  testing: 'בבדיקות',
  normal: 'תקין',
  anomaly: 'חריגה',
  ready: 'מוכן למסיק',
};

const GROUPS: { type: PlotType; label: string }[] = [
  { type: PlotType.OWNER, label: PLOT_TYPE_LABELS[PlotType.OWNER] },
  { type: PlotType.PARTNER, label: PLOT_TYPE_LABELS[PlotType.PARTNER] },
  { type: PlotType.OCCASIONAL, label: PLOT_TYPE_LABELS[PlotType.OCCASIONAL] },
];

export function OlivePlotsContent() {
  const { data, loading, error } = useApiData<DashboardPayload>('/api/olive/dashboard');
  const [term, setTerm] = useState('');

  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    if (!data) return [];
    const harvested = new Set(data.harvestedAreaIds || []);

    return (data.plots || []).map((plot) => {
      const nir = toNirLike(data.latestNir?.[plot.id]);
      return {
        plot,
        plotLike: toPlotLike(plot),
        nir,
        harvested: harvested.has(plot.id),
        category: classifyPlotCategory(nir, data.parameterRules || []),
        lastMeasured: daysSinceLabel(nir?.report_date ?? null, now),
        yieldLoad: yieldLoadInfo(data.yieldEstimates?.[plot.id]?.kg_per_dunam),
      };
    });
  }, [data, now]);

  const visible = useMemo(
    () => rows.filter((row) => plotMatchesSearch(row.plotLike, term.trim())),
    [rows, term]
  );

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

  return (
    <div className="space-y-4">
      <div className="olive-card flex items-center gap-2 p-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="חיפוש לפי שם, גוש, זן, מגדל — או ראשי תיבות"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <span className="olive-muted shrink-0 text-sm">{visible.length}</span>
      </div>

      {GROUPS.map((group) => {
        const groupRows = visible.filter((r) => r.plot.details?.plot_type === group.type);
        if (groupRows.length === 0) return null;

        return (
          <details key={group.type} className="olive-card overflow-hidden" open>
            <summary className="flex cursor-pointer items-center justify-between p-4 font-bold">
              {group.label}
              <span className="olive-muted text-sm font-semibold">({groupRows.length})</span>
            </summary>

            <div className="space-y-2 border-t p-3">
              {groupRows.map((row) => (
                <details key={row.plot.id} className="olive-alert">
                  <summary className="flex cursor-pointer items-baseline justify-between gap-2 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {row.plot.name}
                        {row.plot.variety && (
                          <span className="olive-muted font-normal"> · {row.plot.variety}</span>
                        )}
                      </span>
                      <span className="olive-muted block text-xs">
                        {row.plot.details?.region || '—'}
                        {row.harvested && ' · נמסק'}
                      </span>
                    </span>
                    <span className={`olive-pill olive-pill-idle shrink-0`}>
                      {CATEGORY_LABELS[row.category]}
                    </span>
                  </summary>

                  <div className="space-y-2 border-t p-3 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {row.plot.details?.grower_name && (
                        <span className="olive-pill olive-pill-idle">
                          {row.plot.details.grower_name}
                        </span>
                      )}
                      {row.plot.planting_time && (
                        <span className="olive-pill olive-pill-idle">
                          נטיעה {row.plot.planting_time}
                        </span>
                      )}
                      {row.plot.size != null && (
                        <span className="olive-pill olive-pill-idle">{row.plot.size} דונם</span>
                      )}
                      {row.plot.details?.water_type && (
                        <span className="olive-pill olive-pill-idle">
                          מים:{' '}
                          {WATER_TYPE_LABELS[
                            row.plot.details.water_type as keyof typeof WATER_TYPE_LABELS
                          ] ?? row.plot.details.water_type}
                        </span>
                      )}
                      {row.plot.details?.harvester && (
                        <span className="olive-pill olive-pill-idle">
                          {HARVESTER_LABELS[
                            row.plot.details.harvester as keyof typeof HARVESTER_LABELS
                          ] ?? row.plot.details.harvester}
                        </span>
                      )}
                      {row.yieldLoad && (
                        <span
                          className={`olive-pill ${PARAMETER_STATUS_CONFIG[row.yieldLoad.status].pillClass}`}
                        >
                          {row.yieldLoad.label}
                        </span>
                      )}
                    </div>

                    <p className="olive-muted">
                      {row.nir
                        ? `בדיקת NIR אחרונה: ${row.lastMeasured ?? '—'}`
                        : 'טרם בוצעה בדיקת NIR בחלקה זו'}
                    </p>

                    {row.plot.takts && row.plot.takts.length > 0 && (
                      <p className="olive-muted">מספר טאקטים: {row.plot.takts.length}</p>
                    )}

                    <Link
                      href={`/olive/nir?areaId=${row.plot.id}`}
                      className="inline-block underline"
                    >
                      הוסף בדיקה
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          </details>
        );
      })}

      {visible.length === 0 && (
        <div className="olive-card p-8 text-center">
          <p className="olive-muted">לא נמצאו חלקות התואמות לחיפוש.</p>
        </div>
      )}
    </div>
  );
}
