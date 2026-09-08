'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { showToast } from '@/lib/toast';
import { yieldLoadInfo } from '@/lib/olive/logic';
import { PARAMETER_STATUS_CONFIG } from '@/types/database';
import type { ApiPlot } from '@/lib/olive/adapt';

/**
 * Yield estimates for the active season, next to what was actually harvested.
 *
 * Total fruit is never stored: it is kg/dunam × areas.size, computed on read,
 * so the estimate and its total can never drift apart. Actuals are summed from
 * harvest passes for the same reason.
 */

interface YieldPayload {
  seasonId: string | null;
  estimates: Record<string, { kg_per_dunam: number | string | null }>;
  actuals: Record<string, { fruitKg: number; oilKg: number; passes: number }>;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function YieldPageContent() {
  const [plots, setPlots] = useState<ApiPlot[]>([]);
  const [payload, setPayload] = useState<YieldPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [plotsRes, yieldRes] = await Promise.all([
        fetch('/api/olive/plots'),
        fetch('/api/olive/yield'),
      ]);
      if (!plotsRes.ok) throw new Error('שגיאה בטעינת החלקות');
      if (!yieldRes.ok) throw new Error('שגיאה בטעינת הערכות היבול');

      const plotsData: ApiPlot[] = await plotsRes.json();
      const yieldData: YieldPayload = await yieldRes.json();
      setPlots(plotsData);
      setPayload(yieldData);
      setDrafts(
        Object.fromEntries(
          plotsData.map((p) => [p.id, String(yieldData.estimates?.[p.id]?.kg_per_dunam ?? '')])
        )
      );
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Saves on blur rather than per keystroke — one row, one request. */
  const saveEstimate = async (areaId: string) => {
    if (!payload?.seasonId) return;

    const raw = drafts[areaId] ?? '';
    const stored = payload.estimates?.[areaId]?.kg_per_dunam;
    if (String(stored ?? '') === raw) return; // unchanged

    try {
      const response = await fetch('/api/olive/yield', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: areaId,
          season_id: payload.seasonId,
          kg_per_dunam: raw === '' ? null : Number(raw),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירה');
      }
      showToast.success('הערכת היבול נשמרה');
      await loadData();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה בשמירה');
    }
  };

  const totals = useMemo(() => {
    let expectedFruit = 0;
    let actualFruit = 0;
    let actualOil = 0;
    for (const plot of plots) {
      const perDunam = num(drafts[plot.id]);
      const size = num(plot.size);
      if (perDunam !== null && size !== null) expectedFruit += perDunam * size;
      const actual = payload?.actuals?.[plot.id];
      if (actual) {
        actualFruit += actual.fruitKg;
        actualOil += actual.oilKg;
      }
    }
    return { expectedFruit, actualFruit, actualOil };
  }, [plots, drafts, payload]);

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

  if (!payload?.seasonId) {
    return (
      <div className="olive-card p-8 text-center">
        <p className="olive-muted">אין עונה פעילה. יש להגדיר עונה כדי להזין הערכות יבול.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="olive-card grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">
        <div className="olive-kpi">
          <span className="olive-kpi-label">צפי פרי לעונה (ק״ג)</span>
          <span className="olive-kpi-value">{Math.round(totals.expectedFruit).toLocaleString()}</span>
        </div>
        <div className="olive-kpi">
          <span className="olive-kpi-label">פרי שנמסק בפועל (ק״ג)</span>
          <span className="olive-kpi-value">{Math.round(totals.actualFruit).toLocaleString()}</span>
        </div>
        <div className="olive-kpi">
          <span className="olive-kpi-label">שמן בפועל (ק״ג)</span>
          <span className="olive-kpi-value">{Math.round(totals.actualOil).toLocaleString()}</span>
        </div>
      </section>

      <section className="olive-card overflow-hidden">
        <h2 className="p-4 pb-2 font-bold">הערכת יבול לפי חלקה</h2>
        <p className="olive-muted px-4 pb-3 text-xs">
          סה״כ הצפי מחושב מק״ג/דונם × גודל החלקה ואינו נשמר, כדי שלא ייווצר פער בין השניים.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="p-2 text-start">חלקה</th>
                <th className="p-2 text-start">גוש</th>
                <th className="p-2 text-start">דונם</th>
                <th className="p-2 text-start">ק״ג/דונם</th>
                <th className="p-2 text-start">עומס</th>
                <th className="p-2 text-start">צפי פרי</th>
                <th className="p-2 text-start">בפועל</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((plot) => {
                const perDunam = num(drafts[plot.id]);
                const size = num(plot.size);
                const expected = perDunam !== null && size !== null ? perDunam * size : null;
                const actual = payload.actuals?.[plot.id];
                const load = yieldLoadInfo(drafts[plot.id]);

                return (
                  <tr key={plot.id} className="border-b last:border-0">
                    <td className="p-2">{plot.name}</td>
                    <td className="p-2">{plot.details?.region || '—'}</td>
                    <td className="p-2">{plot.size ?? '—'}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="1"
                        inputMode="decimal"
                        className="h-8 w-28"
                        value={drafts[plot.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [plot.id]: e.target.value }))
                        }
                        onBlur={() => saveEstimate(plot.id)}
                      />
                    </td>
                    <td className="p-2">
                      {load && (
                        <span
                          className={`olive-pill ${PARAMETER_STATUS_CONFIG[load.status].pillClass}`}
                        >
                          {load.label.replace('עומס יבול: ', '')}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {expected !== null ? Math.round(expected).toLocaleString() : '—'}
                    </td>
                    <td className="p-2">
                      {actual
                        ? `${Math.round(actual.fruitKg).toLocaleString()} (${actual.passes} מעברים)`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
