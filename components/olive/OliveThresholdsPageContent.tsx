'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useUser } from '@/components/providers/UserProvider';
import { OliveThresholdsDialog } from './OliveThresholdsDialog';
import { classifyPlotCategory, type PlotCategory } from '@/lib/olive/logic';
import { toCategoryThresholds, toNirLike, type ApiPlot } from '@/lib/olive/adapt';
import type { ParameterRule } from '@/types/database';

/** The slice of the dashboard payload the editor reads. */
interface ThresholdsPayload {
  plots: ApiPlot[];
  latestNir: Record<string, unknown>;
  harvestedAreaIds: string[];
  parameterRules: ParameterRule[];
  categoryThresholds: Record<string, unknown> | null;
  weatherThresholds: Record<string, unknown> | null;
  weatherDays: Record<string, unknown>[];
}

const EMPTY_COUNTS: Record<PlotCategory, number> = {
  testing: 0,
  normal: 0,
  anomaly: 0,
  ready: 0,
};

/**
 * The thresholds editor as its own screen, where the dashboard used to open it
 * from a gear. It reads the dashboard payload because the preview needs the
 * same plots the cards count — unharvested ones, classified the same way —
 * so "before" here is exactly what /olive shows.
 */
export function OliveThresholdsPageContent() {
  const { data, loading, error, refetch } = useApiData<ThresholdsPayload>('/api/olive/dashboard');
  const { user } = useUser();

  // Matches the RLS on the threshold tables and the guard the PUT routes run.
  const canManage = !!user && (user.isAdmin || user.isCustomerOwner);

  const { nirs, counts } = useMemo(() => {
    if (!data) return { nirs: [], counts: EMPTY_COUNTS };
    const harvested = new Set(data.harvestedAreaIds || []);
    const bands = toCategoryThresholds(data.categoryThresholds);
    const rules = data.parameterRules || [];
    const nirs = (data.plots || [])
      .filter((plot) => !harvested.has(plot.id))
      .map((plot) => toNirLike(data.latestNir?.[plot.id] as never));
    const counts = { ...EMPTY_COUNTS };
    for (const nir of nirs) counts[classifyPlotCategory(nir, rules, bands)] += 1;
    return { nirs, counts };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <span className="text-muted-foreground mr-2">טוען נתונים...</span>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-destructive py-12 text-center">{error ?? 'שגיאה בטעינת הספים'}</p>;
  }

  if (!canManage) {
    return (
      <p className="olive-card olive-muted p-6 text-center text-sm">
        רק מנהל מערכת או בעל החשבון יכולים לערוך את הספים.
      </p>
    );
  }

  return (
    <section className="olive-card mx-auto max-w-3xl p-4 sm:p-6">
      <OliveThresholdsDialog
        inline
        open
        onOpenChange={() => {}}
        categoryThresholds={data.categoryThresholds}
        weatherThresholds={data.weatherThresholds}
        rules={data.parameterRules || []}
        nirs={nirs}
        weatherDays={data.weatherDays || []}
        currentCounts={counts}
        onSaved={refetch}
      />
    </section>
  );
}
