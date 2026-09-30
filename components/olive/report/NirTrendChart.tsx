/**
 * The report's NIR trend chart: inline SVG, no chart library.
 *
 * SVG rather than a charting package because this has to survive a print
 * dialog and a headless Chromium with no client JavaScript running. A canvas
 * chart renders blank in both.
 *
 * ONE SHARED 0..100% AXIS, BY CLIENT REQUEST. Commit 2dbca95 split this into a
 * panel per series because on a shared axis oil's movement is a few percent of
 * the height and reads as flat. The client's sample report (2026-09-29) asks
 * for the single chart back, with a legend, and that is what this draws. The
 * cost is recorded in docs/OLIVE_PLOT_REPORT_SAMPLE_ISSUES.md; if the trend
 * becomes unreadable, per-series axes are the fix to revisit.
 */

import type { NirRow } from '@/lib/olive/nir-rows';

/** The prototype's series colours (docs/code.html:5915-5917), unchanged. */
const COLOR_OIL = '#A87A1E';
const COLOR_WATER = '#47542F';
const COLOR_DRY = '#BD5A3F';

/**
 * Readings to plot. The prototype capped at 8; two rounds a season at the
 * current sampling rate makes that tight, and twelve still fits the width.
 */
const MAX_POINTS = 12;

const WIDTH = 700;
const HEIGHT = 145;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;
const TICKS = [0, 25, 50, 75, 100];

interface Series {
  key: 'oil' | 'water' | 'dry';
  label: string;
  color: string;
}

/** Legend order follows the sample: oil, water, dry. */
const SERIES: Series[] = [
  { key: 'oil', label: 'שמן%', color: COLOR_OIL },
  { key: 'water', label: 'מים%', color: COLOR_WATER },
  { key: 'dry', label: 'שמן בחו"י%', color: COLOR_DRY },
];

/** First, middle and last — enough to place the season without crowding twelve dates. */
function labelledIndexes(count: number): Set<number> {
  return new Set([0, Math.floor((count - 1) / 2), count - 1]);
}

/**
 * `rows` must be oldest first. Returns null below two readings — the caller
 * prints the prototype's "נדרשות לפחות 2 בדיקות" note in its place.
 */
export function NirTrendChart({ rows }: { rows: NirRow[] }) {
  const points = rows
    .filter((r) => r.oil !== null || r.water !== null || r.dry !== null)
    .slice(-MAX_POINTS);

  if (points.length < 2) return null;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xAt = (index: number) => PAD_LEFT + (index / (points.length - 1)) * plotWidth;
  const yAt = (value: number) =>
    PAD_TOP + plotHeight - (Math.min(Math.max(value, 0), 100) / 100) * plotHeight;
  const labelled = labelledIndexes(points.length);

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto' }}>
        {TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              y1={yAt(tick)}
              x2={WIDTH - PAD_RIGHT}
              y2={yAt(tick)}
              stroke="#E7DCBF"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 6} y={yAt(tick) + 3} textAnchor="end" fontSize={9} fill="#837962">
              {tick}%
            </text>
          </g>
        ))}

        {SERIES.map((s) => {
          const series = points
            .map((row, index) => ({ value: row[s.key], index }))
            .filter((p): p is { value: number; index: number } => typeof p.value === 'number');
          if (series.length < 2) return null;

          return (
            <g key={s.key}>
              <polyline
                points={series
                  .map((p) => `${xAt(p.index).toFixed(1)},${yAt(p.value).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
              />
              {series.map((p) => (
                <circle
                  key={p.index}
                  cx={xAt(p.index).toFixed(1)}
                  cy={yAt(p.value).toFixed(1)}
                  r={3.2}
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}

        {points.map((row, index) =>
          labelled.has(index) ? (
            <text
              key={row.id}
              x={xAt(index).toFixed(1)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={9}
              fill="#837962"
            >
              {(row.reportDate ?? '').slice(5)}
            </text>
          ) : null
        )}
      </svg>

      {/* Inline layout as well as the rpt- classes: the plot drawer renders
          this chart too, outside the report's stylesheet. */}
      <div
        className="rpt-legend"
        style={{ display: 'flex', justifyContent: 'center', gap: 22, fontSize: '.72rem' }}
      >
        {SERIES.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              className="rpt-chart-swatch"
              style={{ background: s.color, width: 9, height: 9, borderRadius: '50%' }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
