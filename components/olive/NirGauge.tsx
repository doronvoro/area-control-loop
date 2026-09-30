'use client';

import { evaluateParameter } from '@/lib/olive/logic';
import type { ParameterRule } from '@/types/database';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A reading placed on its parameter's scale: a track split into the rule
 * bands, a marker at the value, the band edges under it.
 *
 * The bands come from the same parameter_rules the status pills read, so the
 * gauge can never disagree with the pill beside it — tune a threshold in the
 * settings and both move together.
 *
 * `rules` empty (or `neutral`) draws a plain track: a pomace reading has no
 * verdict, and inventing bands for it would suggest one.
 *
 * `variant="field"` is for under an input: the input already shows the
 * figure and its label, so the label column goes and the verdict is printed
 * under the scale instead. With no value it still draws the bands — the
 * thresholds are worth seeing before typing.
 */
export function NirGauge({
  label,
  value,
  rules,
  parameterCode,
  neutral = false,
  variant = 'readout',
}: {
  label: string;
  value: number | null;
  rules: ParameterRule[];
  parameterCode: string;
  neutral?: boolean;
  variant?: 'readout' | 'field';
}) {
  const field = variant === 'field';
  // Readout: the label column sits on the right, so the right pad is tight.
  // Field: nothing beside it, so it pads evenly for the pointer at either end.
  const padStart = field ? 0.5 : 1;
  const padTotal = field ? 1 : 1.25;
  const applicable = neutral
    ? []
    : rules
        .filter((r) => r.parameter_code === parameterCode)
        .sort((a, b) => a.sort_order - b.sort_order);
  // upper_bound arrives from PostgREST as a string — see evaluateParameter.
  const bounds = applicable
    .map((r) => (r.upper_bound == null ? null : Number(r.upper_bound)))
    .filter((b): b is number => b !== null && Number.isFinite(b));

  // The scale frames the bands with some margin either side, then widens to
  // take in the value so the marker is never pinned to an edge.
  let min: number;
  let max: number;
  if (bounds.length > 0) {
    const first = bounds[0];
    const last = bounds[bounds.length - 1];
    const pad = Math.max((last - first) * 0.5, 3);
    min = first - pad;
    max = last + pad;
  } else {
    min = (value ?? 0) - 5;
    max = (value ?? 0) + 5;
  }
  if (value !== null) {
    min = Math.min(min, value - 1);
    max = Math.max(max, value + 1);
  }
  min = Math.floor(min);
  max = Math.ceil(max);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  // `range` is the rule's own span, not the clipped one drawn: the tooltip
  // says what the band means, and "7–17" would invent a floor the rule lacks.
  const segments: { from: number; to: number; status: string; message: string; range: string }[] =
    [];
  let lo = min;
  let prevBound: number | null = null;
  for (const rule of applicable) {
    const raw = rule.upper_bound == null ? null : Number(rule.upper_bound);
    const bound = raw !== null && Number.isFinite(raw) ? raw : null;
    const hi = bound === null ? max : Math.min(bound, max);
    const range =
      prevBound === null
        ? `עד ${bound}%`
        : bound === null
          ? `מעל ${prevBound}%`
          : `${prevBound}–${bound}%`;
    if (hi > lo)
      segments.push({ from: lo, to: hi, status: rule.status, message: rule.message, range });
    prevBound = bound;
    lo = Math.max(lo, hi);
    if (lo >= max) break;
  }

  const match = neutral ? null : evaluateParameter(rules, parameterCode, value);
  const position = value === null ? null : pct(value);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-valuetext={
        value === null ? 'אין ערך' : `${value.toFixed(1)}%${match ? `, ${match.message}` : ''}`
      }
      // Field: pulled up into the FormItem's row gap so it reads as part of the
      // input above, not a separate block.
      className={field ? '-mt-1 block' : 'flex items-start gap-2'}
    >
      {/* The figure lives here, beside the track, in its verdict's colour —
          a badge over the track covered the bands it was meant to be read
          against. Padded down by the pointer's headroom so it sits on the
          track's line rather than the block's centre. */}
      <div
        className={`${field ? 'hidden' : 'flex'} shrink-0 items-baseline gap-1.5 pt-2 leading-5 whitespace-nowrap`}
      >
        <span className="olive-muted text-xs font-semibold">{label}</span>
        {value === null ? (
          <span className="olive-muted text-sm">—</span>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`olive-gauge-${match?.status ?? 'neutral'} text-xs font-bold text-[var(--gauge-c)] tabular-nums`}
              >
                {value.toFixed(1)}%
              </span>
            </TooltipTrigger>
            {match && <TooltipContent>{match.message}</TooltipContent>}
          </Tooltip>
        )}
      </div>
      {/* Scales read left to right, low to high, as the trend chart does.
          The dir attribute alone loses to globals.css's `[dir="rtl"] *`, so
          the track also sets it in CSS — without that the bands drew
          reversed against the tick labels. */}
      <div
        dir="ltr"
        className={`relative min-w-0 flex-1 ${field ? 'px-2 pt-1 pb-3.5' : 'pt-2 pr-1 pb-4 pl-4'}`}
      >
        {position !== null && value !== null && (
          <div
            className={`absolute ${field ? 'top-[3px]' : 'top-[7px]'} flex -translate-x-1/2 flex-col items-center`}
            style={{
              left: `calc(${padStart}rem + (100% - ${padTotal}rem) * ${position / 100})`,
            }}
          >
            <span className={`olive-gauge-pointer olive-gauge-${match?.status ?? 'neutral'}`} />
          </div>
        )}
        <div className="olive-gauge-track">
          {segments.length > 0 ? (
            segments.map((s, i) => (
              <Tooltip key={i}>
                {/* The trigger is the full-height slot, the colour a thin bar
                    inside it: a 10px band is too small to find with a mouse. */}
                <TooltipTrigger asChild>
                  <span
                    className="olive-gauge-slot"
                    style={{ width: `${pct(s.to) - pct(s.from)}%` }}
                  >
                    <span className={`olive-gauge-band olive-gauge-band-${s.status}`} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {s.message} · {s.range}
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <span className="olive-gauge-slot w-full">
              <span className="olive-gauge-band olive-gauge-band-neutral" />
            </span>
          )}
        </div>
        {/* No bands and no value (an empty pomace field) leaves nothing to
            scale against — the -5..5 it would print is noise. */}
        <div
          className={`olive-muted relative h-3 text-[10px] tabular-nums ${bounds.length === 0 && value === null ? 'invisible' : ''}`}
        >
          <span className="absolute left-0">{min}</span>
          {bounds
            .filter((b) => b > min && b < max)
            .map((b) => (
              <span key={b} className="absolute -translate-x-1/2" style={{ left: `${pct(b)}%` }}>
                {b}
              </span>
            ))}
          <span className="absolute right-0">{max}</span>
        </div>
      </div>
      {field && match && (
        <p
          className={`olive-gauge-${match.status} px-2 text-xs font-semibold text-[var(--gauge-c)]`}
        >
          {match.message}
        </p>
      )}
    </div>
  );
}
