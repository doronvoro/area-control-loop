/**
 * The report's NIR trend chart: inline SVG, no chart library.
 *
 * SVG rather than a charting package because this has to survive a print
 * dialog and a headless Chromium with no client JavaScript running. A canvas
 * chart renders blank in both.
 *
 * TWO PANELS, NOT ONE. The prototype drew oil, water and dry on a single 0..100
 * axis, which flattened all three (see lib/olive/report/chart-scale.ts). Oil and
 * dry-matter share a range and belong together — dry is derived from oil, so
 * their lines moving in step is meaningful. Water lives 50 points higher and
 * gets its own panel; forcing it onto the same axis is what squashed the others.
 */

import { panelDomain } from '@/lib/olive/report/chart-scale';
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

const WIDTH = 640;
const PANEL_HEIGHT = 150;
const PAD_LEFT = 38;
const PAD_RIGHT = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

interface Series {
  key: 'oil' | 'water' | 'dry';
  label: string;
  color: string;
}

const OIL_PANEL: Series[] = [
  { key: 'oil', label: 'שמן%', color: COLOR_OIL },
  { key: 'dry', label: 'שמן בחו"י%', color: COLOR_DRY },
];

const WATER_PANEL: Series[] = [{ key: 'water', label: 'מים%', color: COLOR_WATER }];

interface PanelProps {
  title: string;
  series: Series[];
  rows: NirRow[];
}

function Panel({ title, series, rows }: PanelProps) {
  const domain = panelDomain(series.flatMap((s) => rows.map((r) => r[s.key])));
  if (!domain) return null;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = PANEL_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const span = domain.max - domain.min || 1;

  const xAt = (index: number) =>
    PAD_LEFT + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const yAt = (value: number) => PAD_TOP + plotHeight - ((value - domain.min) / span) * plotHeight;

  return (
    <div className="rpt-chart-panel">
      <p className="rpt-chart-title">{title}</p>
      <svg viewBox={`0 0 ${WIDTH} ${PANEL_HEIGHT}`} style={{ width: '100%', height: 'auto' }}>
        {domain.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              y1={yAt(tick)}
              x2={WIDTH - PAD_RIGHT}
              y2={yAt(tick)}
              stroke="#E7DCBF"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 5} y={yAt(tick) + 3} textAnchor="end" fontSize={9} fill="#837962">
              {tick}
            </text>
          </g>
        ))}

        {series.map((s) => {
          const points = rows
            .map((row, index) => ({ value: row[s.key], index }))
            .filter((p): p is { value: number; index: number } => typeof p.value === 'number');
          if (points.length < 2) return null;

          return (
            <g key={s.key}>
              <polyline
                points={points
                  .map((p) => `${xAt(p.index).toFixed(1)},${yAt(p.value).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
              />
              {points.map((p) => (
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

        {rows.map((row, index) => (
          <text
            key={row.id}
            x={xAt(index).toFixed(1)}
            y={PANEL_HEIGHT - 8}
            textAnchor="middle"
            fontSize={9}
            fill="#837962"
          >
            {(row.reportDate ?? '').slice(5)}
          </text>
        ))}
      </svg>
      <div className="rpt-legend">
        {series.map((s) => (
          <span key={s.key}>
            <span style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
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

  return (
    <>
      <Panel title="שמן / שמן בחומר יבש" series={OIL_PANEL} rows={points} />
      <Panel title="מים" series={WATER_PANEL} rows={points} />
    </>
  );
}
