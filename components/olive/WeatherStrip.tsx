'use client';

import Link from 'next/link';
import { CloudSun, Droplets, Wind } from 'lucide-react';
import { daysSinceLabel, type UpcomingWeather, type WeatherThresholds } from '@/lib/olive/logic';
import { formatForecastDay, type ForecastFreshness } from '@/lib/olive/weather-view';

/**
 * The forecast, always on screen.
 *
 * This section used to render only when a day crossed a threshold, which made a
 * calm week and an empty weather_days table look identical — both blank. Since
 * the forecast feeds harvest urgency, "we have no forecast" is the one state
 * that most needs saying out loud, and that is still true now that a nightly
 * cron fills the table: an automated pull can fail, and it fails silently.
 * Do not make this conditional again.
 *
 * Presentational only. Every number here comes from computeUpcomingWeather, and
 * the flags are the ones it set while building weatherLines, so the days this
 * marks are by construction the days those lines name.
 */

const FORECAST_DAYS_SHOWN = 7;

interface WeatherStripProps {
  weather: UpcomingWeather;
  /** The live levels, so the calm sentence quotes what actually fires. */
  thresholds: WeatherThresholds;
  freshness: ForecastFreshness | null;
  /** The dashboard's memoised instant, so every chip is judged against one time. */
  now: Date;
}

export function WeatherStrip({ weather, thresholds, freshness, now }: WeatherStripProps) {
  const { upcoming, weatherLines } = weather;

  if (upcoming.length === 0) return <EmptyForecast />;

  const days = upcoming.slice(0, FORECAST_DAYS_SHOWN);
  const flagged = upcoming.filter((day) => day.rainFlagged || day.windFlagged).length;

  // Staleness outranks a flagged day: a forecast nobody refreshed is a reason to
  // distrust the flags, not a milder version of them.
  const pill = freshness?.stale
    ? { className: 'olive-pill-urgent', label: 'התחזית לא עודכנה' }
    : flagged > 0
      ? {
          className: 'olive-pill-plan',
          label: flagged === 1 ? 'יום אחד מסומן' : `${flagged} ימים מסומנים`,
        }
      : { className: 'olive-pill-ok', label: 'ללא גשם או רוח חריגים' };

  const scope =
    upcoming.length > FORECAST_DAYS_SHOWN
      ? `מוצגים ${days.length} מתוך ${upcoming.length} ימים`
      : days.length === 1
        ? 'תחזית ליום אחד'
        : `תחזית ל-${days.length} ימים`;

  // daysSinceLabel returns null only for a future timestamp, which forecastFreshness
  // has already clamped — 'היום' is the honest reading of that clamp.
  const updated = freshness
    ? `עודכנה ${daysSinceLabel(freshness.updatedAt, now) ?? 'היום'}`
    : 'מועד עדכון לא ידוע';

  return (
    <section className="olive-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <CloudSun className="size-4" />
          מזג אוויר — ימים קרובים
          <span className={`olive-pill ${pill.className}`}>{pill.label}</span>
        </h2>
        <Link href="/olive/weather" className="olive-muted text-xs underline">
          למסך מזג אוויר
        </Link>
      </div>

      <p className="olive-muted text-xs">
        {scope} · {updated}
      </p>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {days.map((day, index) => {
          const { label, date } = formatForecastDay(day.date, now);
          const isFlagged = day.rainFlagged || day.windFlagged;

          return (
            <div
              key={day.date}
              className={`olive-weather-day ${index === 0 ? 'olive-weather-day-today' : ''} ${
                isFlagged ? 'olive-weather-day-flagged' : ''
              }`}
            >
              <div className="olive-weather-label">{label}</div>
              <div className="olive-weather-date olive-ltr-num">{date}</div>

              <div className="olive-weather-value flex items-center justify-center gap-1">
                <Droplets className="size-3 shrink-0" />
                <span className={day.rainFlagged ? 'olive-weather-value-flagged' : ''}>
                  {day.rainMm ?? '—'}
                </span>
              </div>

              <div className="olive-weather-value flex items-center justify-center gap-1">
                <Wind className="size-3 shrink-0" />
                <span className={day.windFlagged ? 'olive-weather-value-flagged' : ''}>
                  {day.windKmh ?? '—'}
                </span>
              </div>

              {(day.tempMin !== null || day.tempMax !== null) && (
                /* olive-ltr-num, not a dir="ltr" attribute — see the rule in
                   olive.css for why the attribute alone does nothing here.
                   Without it this paints as 35.7°–20.3°, max first. */
                <div className="olive-weather-temp olive-ltr-num">
                  {day.tempMin ?? '—'}°–{day.tempMax ?? '—'}°
                </div>
              )}

              {day.isManual && (
                <span className="olive-weather-manual" title="עודכן ידנית">
                  ידני
                </span>
              )}
            </div>
          );
        })}
      </div>

      {weatherLines.length > 0 ? (
        <div className="space-y-1 border-t pt-3">
          <h3 className="text-sm font-bold">משפיע על דחיפות המסיק</h3>
          {weatherLines.map((line) => (
            <p key={line} className="flex items-center gap-2 text-sm">
              {line.startsWith('רוח') ? (
                <Wind className="size-3.5 shrink-0" />
              ) : (
                <Droplets className="size-3.5 shrink-0" />
              )}
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="olive-muted border-t pt-3 text-xs">
          אין גשם מעל {thresholds.rainAlertMm} מ״מ או רוח מעל {thresholds.windAlertKmh} קמ״ש בתחזית.
        </p>
      )}
    </section>
  );
}

/**
 * Nobody has pulled a forecast — or the last pull is old enough that every day
 * in it is already in the past, since the API only returns entry_date >= today.
 *
 * Says what the absence costs rather than leaving the space blank, which is the
 * whole reason this component stopped being conditional.
 */
function EmptyForecast() {
  return (
    <section className="olive-weather-empty flex flex-col items-center gap-1 p-6 text-center">
      <CloudSun className="text-muted-foreground/40 size-7" />
      <p className="text-sm font-bold">אין נתוני תחזית לימים הקרובים</p>
      <p className="olive-muted text-xs">
        דחיפות המסיק מחושבת כרגע ללא מזג אוויר. התחזית מתרעננת אוטומטית מדי בוקר, וניתן לרענן גם
        ידנית.
      </p>
      <Link href="/olive/weather" className="mt-1 text-sm underline">
        מעבר למסך מזג אוויר לרענון התחזית
      </Link>
    </section>
  );
}
