import { describe, it, expect } from 'vitest';
import {
  evaluateParameter,
  computeUpcomingWeather,
  computePlotStatus,
  classifyPlotCategory,
  yieldLoadInfo,
  parseYieldDraft,
  plotMatchesSearch,
  parseDM,
  isDateInWindow,
  daysSinceLabel,
  DEFAULT_WEATHER_THRESHOLDS,
  type PlotLike,
  type NirLike,
  type WeatherDayLike,
  type CategoryThresholds,
} from '@/lib/olive/logic';
import { toCategoryThresholds, toWeatherDayLike, toWeatherThresholds } from '@/lib/olive/adapt';
import { readAlertBounds, DEFAULT_ALERT_BOUNDS } from '@/lib/olive/thresholds';
import { DEFAULT_CATEGORY_THRESHOLDS } from '@/lib/olive/constants';
import { ParameterStatus, type ParameterRule } from '@/types/database';

/**
 * Golden tests for the olive harvest decision logic.
 *
 * Spec §7.2: this logic is months of tuning with the client and must not change
 * without approval. These tests exist to make drift LOUD — especially the
 * threshold boundaries, the branch order in computePlotStatus, and the
 * deliberate divergence between computePlotStatus and classifyPlotCategory.
 *
 * If a test here fails, the correct first assumption is that the change is
 * wrong, not the test.
 */

// ─── fixtures ────────────────────────────────────────────────────────────────

let ruleSeq = 0;
function rule(
  parameter_code: string,
  upper_bound: number | null,
  upper_inclusive: boolean,
  status: ParameterStatus,
  severity: number,
  message: string,
  sort_order: number
): ParameterRule {
  return {
    id: `r${++ruleSeq}`,
    parameter_code,
    upper_bound,
    upper_inclusive,
    status,
    severity,
    message,
    sort_order,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

/** Mirrors the seed in 20260908100000_create_olive_parameters.sql exactly. */
const RULES: ParameterRule[] = [
  rule('oil', 17, false, ParameterStatus.IDLE, 0, 'לא מוכן למסיק', 1),
  rule('oil', 20, true, ParameterStatus.PLAN, 2, 'תוכנן למסיק', 2),
  rule('oil', null, true, ParameterStatus.URGENT, 3, 'מסיק מיידי', 3),

  rule('water', 50, false, ParameterStatus.URGENT, 3, 'עקת מים', 1),
  rule('water', 54, true, ParameterStatus.OK, 1, 'אופטימום', 2),
  rule('water', 60, true, ParameterStatus.PLAN, 2, 'צמצום השקיה', 3),
  rule('water', null, true, ParameterStatus.URGENT, 3, 'סגירת מים מיידית', 4),

  rule('dry', 40, false, ParameterStatus.IDLE, 0, '—', 1),
  rule('dry', 45, true, ParameterStatus.PLAN, 2, 'תשומת לב / החלטה', 2),
  rule('dry', null, true, ParameterStatus.URGENT, 3, 'מסיק', 3),
];

/** Mirrors the seed in 20260915100000_create_olive_category_thresholds.sql exactly. */
const BANDS: CategoryThresholds = {
  readyOilMin: 18,
  readyOilMax: 24,
  readyWaterMin: 51,
  readyWaterMax: 54,
  anomalyWaterLow: 50,
  anomalyWaterHigh: 60,
  normalOilMax: 17,
  normalWaterMax: 60,
};

const PLOT: PlotLike = {
  id: 'p1',
  name: 'מיצר — 2003 — ארבקינה',
  variety: 'ארבקינה',
  region: 'מיצר אגוזי',
  grower_name: 'קיבוץ גשור',
};

function nir(partial: Partial<NirLike>): NirLike {
  return {
    report_date: '2026-10-12',
    oil: null,
    water: null,
    dry: null,
    green: null,
    acid: null,
    maturity: null,
    ...partial,
  };
}

const NOW = new Date(2026, 9, 15); // 15 Oct 2026, local time
const CALM = computeUpcomingWeather([], NOW);

/** The seeded weather levels, as 20260915110000 writes them. */
const WEATHER = { rainAlertMm: 5, windAlertKmh: 25 };

function weather(days: Partial<WeatherDayLike>[]) {
  return computeUpcomingWeather(
    days.map((d) => ({
      entry_date: '2026-10-16',
      rain_mm: null,
      wind_kmh: null,
      is_manual: false,
      ...d,
    })),
    NOW
  );
}

// ─── evaluateParameter ───────────────────────────────────────────────────────

describe('evaluateParameter', () => {
  // The prototype uses `<` on the lower band but `<=` on the upper. These exact
  // values are where a refactor would silently change a harvest decision.
  it.each([
    ['oil', 16.9, ParameterStatus.IDLE],
    ['oil', 17.0, ParameterStatus.PLAN],
    ['oil', 20.0, ParameterStatus.PLAN],
    ['oil', 20.1, ParameterStatus.URGENT],
    ['water', 49.9, ParameterStatus.URGENT],
    ['water', 50.0, ParameterStatus.OK],
    ['water', 54.0, ParameterStatus.OK],
    ['water', 54.1, ParameterStatus.PLAN],
    ['water', 60.0, ParameterStatus.PLAN],
    ['water', 60.1, ParameterStatus.URGENT],
    ['dry', 39.9, ParameterStatus.IDLE],
    ['dry', 40.0, ParameterStatus.PLAN],
    ['dry', 45.0, ParameterStatus.PLAN],
    ['dry', 45.1, ParameterStatus.URGENT],
  ])('%s at %s resolves to %s', (code, value, expected) => {
    expect(evaluateParameter(RULES, code as string, value as number)?.status).toBe(expected);
  });

  it('carries the rule message and severity', () => {
    expect(evaluateParameter(RULES, 'oil', 21)).toEqual({
      status: ParameterStatus.URGENT,
      severity: 3,
      message: 'מסיק מיידי',
    });
  });

  it('returns null for missing values rather than guessing a band', () => {
    expect(evaluateParameter(RULES, 'oil', null)).toBeNull();
    expect(evaluateParameter(RULES, 'oil', undefined)).toBeNull();
    expect(evaluateParameter(RULES, 'oil', NaN)).toBeNull();
  });

  it('returns null for a parameter with no rules (green and acid are informational)', () => {
    expect(evaluateParameter(RULES, 'green', 35)).toBeNull();
    expect(evaluateParameter(RULES, 'acid', 0.32)).toBeNull();
  });

  it('respects sort_order rather than array order', () => {
    const shuffled = [...RULES].reverse();
    expect(evaluateParameter(shuffled, 'oil', 18)?.status).toBe(ParameterStatus.PLAN);
  });
});

// ─── computeUpcomingWeather ──────────────────────────────────────────────────

describe('computeUpcomingWeather', () => {
  it('flags rain only above 5mm', () => {
    expect(weather([{ rain_mm: 5 }]).rainSoon).toBe(false);
    expect(weather([{ rain_mm: 5.1 }]).rainSoon).toBe(true);
  });

  it('flags wind only above 25km/h', () => {
    expect(weather([{ wind_kmh: 25 }]).windSoon).toBe(false);
    expect(weather([{ wind_kmh: 25.1 }]).windSoon).toBe(true);
  });

  it('ignores days before today', () => {
    expect(weather([{ entry_date: '2026-10-14', rain_mm: 40 }]).rainSoon).toBe(false);
  });

  it('includes today', () => {
    expect(weather([{ entry_date: '2026-10-15', rain_mm: 40 }]).rainSoon).toBe(true);
  });

  it('lets a manual entry override the forecast for the same date', () => {
    const result = computeUpcomingWeather(
      [
        { entry_date: '2026-10-16', rain_mm: 40, wind_kmh: null, is_manual: false, temp_max: 30 },
        { entry_date: '2026-10-16', rain_mm: 0, wind_kmh: null, is_manual: true, temp_max: 21 },
      ],
      NOW
    );
    expect(result.rainSoon).toBe(false);
    expect(result.upcoming).toHaveLength(1);

    // The whole merged day comes from the manual row, not just the rain that
    // won the comparison — the strip badges that day "ידני" and shows its
    // temperature, and both must describe the numbers actually in force.
    expect(result.upcoming[0].isManual).toBe(true);
    expect(result.upcoming[0].tempMax).toBe(21);
  });

  it('carries temperature and source through to the per-day list', () => {
    const result = weather([{ rain_mm: 2, wind_kmh: 9, temp_min: 8, temp_max: 21 }]);

    expect(result.upcoming[0]).toEqual({
      date: '2026-10-16',
      rainMm: 2,
      windKmh: 9,
      tempMin: 8,
      tempMax: 21,
      isManual: false,
      rainFlagged: false,
      windFlagged: false,
    });
  });

  /**
   * The invariant the dashboard strip depends on. It marks days from `upcoming`
   * and lists the reasons from `weatherLines`; if those two could disagree, the
   * strip would highlight a day the text below it does not mention.
   */
  it('flags exactly the days weatherLines names', () => {
    const result = weather([
      { entry_date: '2026-10-16', rain_mm: 12 },
      { entry_date: '2026-10-17', wind_kmh: 31 },
      { entry_date: '2026-10-18', rain_mm: 1, wind_kmh: 4 },
    ]);

    expect(result.upcoming.map((d) => d.rainFlagged || d.windFlagged)).toEqual([true, true, false]);
    expect(result.weatherLines).toHaveLength(2);
  });

  it('does not flag a day sitting exactly on either threshold', () => {
    const result = weather([{ rain_mm: 5, wind_kmh: 25 }]);

    expect(result.upcoming[0].rainFlagged).toBe(false);
    expect(result.upcoming[0].windFlagged).toBe(false);
  });

  /**
   * The levels are a row in weather_alert_thresholds now. Same 4mm day, two
   * different answers — which is the entire point of making them editable.
   */
  it('flags against the thresholds it is given', () => {
    const day = [{ rain_mm: 4 }];

    expect(weather(day).rainSoon).toBe(false);
    expect(
      computeUpcomingWeather(
        [{ entry_date: '2026-10-16', rain_mm: 4, wind_kmh: null, is_manual: false }],
        NOW,
        { rainAlertMm: 3, windAlertKmh: 25 }
      ).rainSoon
    ).toBe(true);
  });

  it('orders the day list ascending regardless of input order', () => {
    const result = weather([
      { entry_date: '2026-10-18' },
      { entry_date: '2026-10-16' },
      { entry_date: '2026-10-17' },
    ]);

    expect(result.upcoming.map((d) => d.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
});

// ─── computePlotStatus ───────────────────────────────────────────────────────

describe('computePlotStatus', () => {
  const noWindows: never[] = [];

  it('is quiet with no NIR data at all', () => {
    const s = computePlotStatus(PLOT, null, RULES, CALM, noWindows, NOW);
    expect(s.level).toBe('ok');
    expect(s.headline).toBe('ללא דחיפות מיוחדת');
  });

  it('escalates to urgent on oil alone', () => {
    const s = computePlotStatus(PLOT, nir({ oil: 21 }), RULES, CALM, noWindows, NOW);
    expect(s.level).toBe('urgent');
    expect(s.headline).toBe('מסיק מיידי לפי NIR');
  });

  it('sharpens the urgent headline when rain is coming', () => {
    const s = computePlotStatus(
      PLOT,
      nir({ oil: 21 }),
      RULES,
      weather([{ rain_mm: 12 }]),
      noWindows,
      NOW
    );
    expect(s.level).toBe('urgent');
    expect(s.headline).toBe('מסיק דחוף — שמן בטווח מיידי וגשם בדרך');
  });

  it('plans on oil alone', () => {
    const s = computePlotStatus(PLOT, nir({ oil: 18 }), RULES, CALM, noWindows, NOW);
    expect(s.level).toBe('plan');
    expect(s.headline).toBe('מתוכנן למסיק בקרוב');
  });

  it('names both hazards when rain and wind coincide', () => {
    const s = computePlotStatus(
      PLOT,
      nir({ oil: 18 }),
      RULES,
      weather([{ rain_mm: 12, wind_kmh: 30 }]),
      noWindows,
      NOW
    );
    expect(s.headline).toBe('שקול הקדמת מסיק — גשם ורוח חזקה צפויים');
  });

  it('prefers the rain headline over the wind headline', () => {
    const s = computePlotStatus(
      PLOT,
      nir({ oil: 18 }),
      RULES,
      weather([{ rain_mm: 12 }]),
      noWindows,
      NOW
    );
    expect(s.headline).toBe('שקול הקדמת מסיק — גשם צפוי');
  });

  // The client is explicit: wind matters once you are already deciding.
  it('does NOT escalate on wind alone when oil is not ready', () => {
    const windy = weather([{ wind_kmh: 40 }]);
    const s = computePlotStatus(PLOT, nir({ oil: 12 }), RULES, windy, noWindows, NOW);
    expect(s.level).toBe('ok');
    expect(s.headline).toBe('ללא דחיפות מיוחדת');
  });

  it('does escalate the headline on wind once oil is already planned', () => {
    const windy = weather([{ wind_kmh: 40 }]);
    const s = computePlotStatus(PLOT, nir({ oil: 18 }), RULES, windy, noWindows, NOW);
    expect(s.level).toBe('plan');
    expect(s.headline).toBe('שקול הקדמת מסיק — רוח חזקה צפויה');
  });

  it('lifts a quiet plot to plan when inside its variety harvest window', () => {
    const windows = [{ variety: 'ארבקינה', start_dm: '01/10', end_dm: '30/11' }];
    const s = computePlotStatus(PLOT, nir({ oil: 12 }), RULES, CALM, windows, NOW);
    expect(s.level).toBe('plan');
    expect(s.headline).toBe('בתוך חלון הקטיף העונתי לזן');
    expect(s.windowLine).toContain('בתוך חלון הקטיף');
  });

  it('never lets a harvest window downgrade an urgent plot', () => {
    const windows = [{ variety: 'ארבקינה', start_dm: '01/10', end_dm: '30/11' }];
    const s = computePlotStatus(PLOT, nir({ oil: 21 }), RULES, CALM, windows, NOW);
    expect(s.level).toBe('urgent');
    expect(s.headline).toBe('מסיק מיידי לפי NIR');
  });

  it('reports being outside the window without changing urgency', () => {
    const windows = [{ variety: 'ארבקינה', start_dm: '01/01', end_dm: '28/02' }];
    const s = computePlotStatus(PLOT, nir({ oil: 12 }), RULES, CALM, windows, NOW);
    expect(s.level).toBe('ok');
    expect(s.windowLine).toContain('מחוץ לחלון הקטיף');
  });
});

// ─── classifyPlotCategory ────────────────────────────────────────────────────

describe('classifyPlotCategory', () => {
  it('is testing with no measurement', () => {
    expect(classifyPlotCategory(null, RULES, BANDS)).toBe('testing');
  });

  it('is ready when oil and water are both inside the ready box', () => {
    expect(classifyPlotCategory(nir({ oil: 18, water: 52 }), RULES, BANDS)).toBe('ready');
    expect(classifyPlotCategory(nir({ oil: 24, water: 54 }), RULES, BANDS)).toBe('ready');
  });

  // Both ends are inclusive — readyOilMin 18 and readyOilMax 24 are IN.
  it('is not ready one step outside either end of the oil box', () => {
    expect(classifyPlotCategory(nir({ oil: 17.9, water: 52 }), RULES, BANDS)).not.toBe('ready');
    expect(classifyPlotCategory(nir({ oil: 24.1, water: 52 }), RULES, BANDS)).not.toBe('ready');
  });

  /**
   * CHANGED DELIBERATELY — was 'ready' when the card read the oil alert band.
   *
   * The prototype's categoryThresholds require water 51..54 for מוכן למסיק, so
   * high oil alone is not enough and a plot whose water is out of range cannot
   * be ready at all. This is why the old "oil-urgent wins over water-urgent"
   * precedence no longer decides anything: the two can no longer both hold.
   */
  it('is anomaly, not ready, when oil is high but water is out of range', () => {
    expect(classifyPlotCategory(nir({ oil: 21, water: 70 }), RULES, BANDS)).toBe('anomaly');
  });

  it('is anomaly on water stress', () => {
    expect(classifyPlotCategory(nir({ oil: 12, water: 45 }), RULES, BANDS)).toBe('anomaly');
  });

  // The one band still sourced from parameter_rules — categoryThresholds has no
  // dry key, and dropping the signal outright is the client's call, not ours.
  it('is anomaly on high dry-matter oil', () => {
    expect(classifyPlotCategory(nir({ oil: 12, dry: 46 }), RULES, BANDS)).toBe('anomaly');
  });

  /**
   * THE REGRESSION THIS SUITE EXISTS FOR.
   *
   * The first port read תקינה as "oil in the PLAN band" (17..20) and sent every
   * early-season sample to בבדיקות instead — the bucket for plots nobody has
   * sampled. The prototype means oil at or BELOW normalOilMax.
   */
  it('is normal when oil is still below the ready range and water is in range', () => {
    expect(classifyPlotCategory(nir({ oil: 12, water: 52 }), RULES, BANDS)).toBe('normal');
    expect(classifyPlotCategory(nir({ oil: 17, water: 60 }), RULES, BANDS)).toBe('normal');
  });

  // Between normalOilMax and readyOilMin, with water outside the ready box, a
  // plot belongs to no card but בבדיקות — it is mid-climb and not yet a call.
  it('is testing when oil has passed normal but the ready box is not met', () => {
    expect(classifyPlotCategory(nir({ oil: 17.5, water: 58 }), RULES, BANDS)).toBe('testing');
  });

  // A band cannot be judged on a value that is not there.
  it('is testing when the measurement is missing the value a band needs', () => {
    expect(classifyPlotCategory(nir({ oil: 21 }), RULES, BANDS)).toBe('testing');
    expect(classifyPlotCategory(nir({ water: 52 }), RULES, BANDS)).toBe('testing');
  });
});

// ─── the גשור 2026 backup, end to end ───────────────────────────────────────

describe('status-card counts for the גשור 2026 backup', () => {
  /**
   * Every NIR sample in "גיבוי חיזוי מסיק ונתונים - 2026", as [oil, water, dry].
   *
   * The prototype's own status cards read 37 / 6 / 7 / 0 for this file against
   * 50 plots. The app read 43 / 0 / 7 / 0 — the six תקינות plots collapsed into
   * בבדיקות. This pins the file, not a fixture, so the two cannot drift again.
   */
  const SAMPLES: [number, number, number][] = [
    [10.7, 57, 24.82],
    [10.2, 58, 24.32],
    [9.2, 56, 20.84],
    [8.2, 61.7, 21.45],
    [8, 60.7, 20.26],
    [6, 66.6, 18.02],
    [9, 60.2, 22.72],
    [9.3, 51.1, 21.25],
    [11.8, 57.9, 28.12],
    [5.2, 63.5, 14.17],
    [5.7, 64.9, 16.13],
    [10.3, 60.6, 26.22],
    [10.5, 54.4, 22.91],
  ];

  /** 50 plots in the file, 13 of them sampled. */
  const UNSAMPLED = 37;

  it('matches the prototype card for card', () => {
    const counts = { testing: UNSAMPLED, normal: 0, anomaly: 0, ready: 0 };
    for (const [oil, water, dry] of SAMPLES) {
      counts[classifyPlotCategory(nir({ oil, water, dry }), RULES, BANDS)] += 1;
    }

    expect(counts).toEqual({ testing: 37, normal: 6, anomaly: 7, ready: 0 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(50);
  });

  it('flags exactly the seven samples whose water is over the band', () => {
    const anomalies = SAMPLES.filter(
      ([oil, water, dry]) =>
        classifyPlotCategory(nir({ oil, water, dry }), RULES, BANDS) === 'anomaly'
    );
    expect(anomalies.map(([, water]) => water)).toEqual([61.7, 60.7, 66.6, 60.2, 63.5, 64.9, 60.6]);
  });

  /**
   * The settings dialog's live preview claims that retuning a band moves these
   * counts. This is that claim as a test, on the one dataset the repo already
   * trusts — so the preview is covered without a DOM.
   *
   * Widening the water bands to 67 puts every sample inside the normal range:
   * the seven water anomalies (61.7 .. 66.6) stop being anomalies, and all 13
   * sampled plots land in תקינות.
   */
  it('moves as the preview predicts when the water bands are widened', () => {
    const widened = { ...BANDS, anomalyWaterHigh: 67, normalWaterMax: 67 };
    const counts = { testing: UNSAMPLED, normal: 0, anomaly: 0, ready: 0 };
    for (const [oil, water, dry] of SAMPLES) {
      counts[classifyPlotCategory(nir({ oil, water, dry }), RULES, widened)] += 1;
    }

    expect(counts).toEqual({ testing: 37, normal: 13, anomaly: 0, ready: 0 });
  });

  /**
   * The same, driven from the OTHER threshold set — proof that the alert bands
   * on tab 2 reach the status cards. Dropping the dry-matter bands to 10/20
   * puts every sample above 20% dry into "מסיק", which classifyPlotCategory
   * reads as חריגה: the 7 water anomalies plus all 6 previously-normal plots.
   */
  it('moves when the dry-matter alert bounds change, not just the card bands', () => {
    const retuned = RULES.map((r) =>
      r.parameter_code === 'dry' && r.upper_bound !== null
        ? { ...r, upper_bound: r.sort_order === 1 ? 10 : 20 }
        : r
    );
    const counts = { testing: UNSAMPLED, normal: 0, anomaly: 0, ready: 0 };
    for (const [oil, water, dry] of SAMPLES) {
      counts[classifyPlotCategory(nir({ oil, water, dry }), retuned, BANDS)] += 1;
    }

    expect(counts).toEqual({ testing: 37, normal: 0, anomaly: 13, ready: 0 });
  });
});

// ─── the constants that back "restore defaults" ──────────────────────────────

describe('threshold defaults', () => {
  /**
   * DEFAULT_CATEGORY_THRESHOLDS and DEFAULT_ALERT_BOUNDS are what the settings
   * dialog writes into the form when someone presses "שחזר ברירות מחדל". Both
   * are documented as mirrors of their migration seeds, and the RULES / BANDS
   * fixtures above are this file's copy of those same seeds.
   *
   * Pin the constants to the fixtures rather than deriving the fixtures from
   * the constants: a wrong edit to a constant must fail here, not pass by
   * definition.
   */
  it('match the seeded fixtures, so restoring defaults restores the seed', () => {
    expect(BANDS).toEqual(DEFAULT_CATEGORY_THRESHOLDS);
    expect(readAlertBounds(RULES)).toEqual(DEFAULT_ALERT_BOUNDS);
    expect(WEATHER).toEqual(DEFAULT_WEATHER_THRESHOLDS);
  });
});

// ─── toCategoryThresholds ────────────────────────────────────────────────────

describe('toCategoryThresholds', () => {
  // NUMERIC arrives as a string over PostgREST. Left as strings, "9" > "17"
  // lexically and every band would misfire on real data.
  it('coerces the NUMERIC strings a PostgREST row actually carries', () => {
    const bands = toCategoryThresholds({
      ready_oil_min: '18.00',
      ready_oil_max: '24.00',
      ready_water_min: '51.00',
      ready_water_max: '54.00',
      anomaly_water_low: '50.00',
      anomaly_water_high: '60.00',
      normal_oil_max: '17.00',
      normal_water_max: '60.00',
    });

    expect(bands).toEqual(BANDS);
    expect(classifyPlotCategory(nir({ oil: 9, water: 52 }), RULES, bands)).toBe('normal');
  });

  it('falls back to the prototype defaults when the row is missing', () => {
    expect(toCategoryThresholds(null)).toEqual(BANDS);
  });

  it('coerces the weather row the same way, and falls back the same way', () => {
    expect(toWeatherThresholds({ rain_alert_mm: '5.00', wind_alert_kmh: '25.00' })).toEqual(
      WEATHER
    );
    expect(toWeatherThresholds(null)).toEqual(WEATHER);
  });
});

// ─── toWeatherDayLike ────────────────────────────────────────────────────────

describe('toWeatherDayLike', () => {
  it('coerces the NUMERIC strings a PostgREST weather row actually carries', () => {
    const day = toWeatherDayLike({
      entry_date: '2026-10-16',
      rain_mm: '12.50',
      wind_kmh: '31.00',
      temp_min: '8.40',
      temp_max: '21.10',
      is_manual: false,
    });

    expect(day).toEqual({
      entry_date: '2026-10-16',
      rain_mm: 12.5,
      wind_kmh: 31,
      temp_min: 8.4,
      temp_max: 21.1,
      is_manual: false,
    });

    // Left as strings the flags would compare lexically, where "9" > "12.50".
    expect(computeUpcomingWeather([day], NOW).rainSoon).toBe(true);
  });

  /**
   * A chip reading `0 מ"מ` asserts that no rain is expected. `—` admits there is
   * no data. That distinction is the reason the strip can be trusted, so the
   * adapter must not turn an absent column into a zero.
   */
  it('treats a missing column as null rather than zero', () => {
    expect(toWeatherDayLike({ entry_date: '2026-10-16' })).toEqual({
      entry_date: '2026-10-16',
      rain_mm: null,
      wind_kmh: null,
      temp_min: null,
      temp_max: null,
      is_manual: false,
    });
  });
});

// ─── the preserved divergence ────────────────────────────────────────────────

describe('computePlotStatus vs classifyPlotCategory divergence', () => {
  /**
   * DO NOT "FIX" THIS.
   *
   * computePlotStatus reads only oil; classifyPlotCategory also reads water and
   * dry-matter. So this sample reads "planned" in the alerts list while counting
   * as "anomaly" on the status card. That is the prototype's shipped behaviour.
   *
   * Spec §7.2 forbids changing tuned logic without client approval, and the
   * client's design doc lists this as open decision #1. If the client later
   * decides the two should agree, change BOTH functions deliberately and update
   * this test — do not quietly align one to the other.
   *
   * dry is a generated column: 19.4 / (100 - 57.2) * 100 = 45.33, just over the
   * 45 threshold, which is what makes the split visible at all.
   */
  const sample = nir({ oil: 19.4, water: 57.2, dry: 45.33 });

  it('shows the plot as planned in the alerts list', () => {
    const s = computePlotStatus(PLOT, sample, RULES, CALM, [], NOW);
    expect(s.level).toBe('plan');
    expect(s.headline).toBe('מתוכנן למסיק בקרוב');
  });

  it('counts the same plot as an anomaly on the status card', () => {
    expect(classifyPlotCategory(sample, RULES, BANDS)).toBe('anomaly');
  });

  it('confirms each input band individually', () => {
    expect(evaluateParameter(RULES, 'oil', 19.4)?.status).toBe(ParameterStatus.PLAN);
    expect(evaluateParameter(RULES, 'water', 57.2)?.status).toBe(ParameterStatus.PLAN);
    expect(evaluateParameter(RULES, 'dry', 45.33)?.status).toBe(ParameterStatus.URGENT);
  });
});

// ─── yieldLoadInfo ───────────────────────────────────────────────────────────

describe('yieldLoadInfo', () => {
  it.each([
    [1301, 'עומס יבול: גבוה'],
    [1300, 'עומס יבול: בינוני'],
    [900, 'עומס יבול: בינוני'],
    [899, 'עומס יבול: נמוך'],
  ])('%s is %s', (value, label) => {
    expect(yieldLoadInfo(value as number)?.label).toBe(label);
  });

  it('returns null when no estimate exists', () => {
    expect(yieldLoadInfo(null)).toBeNull();
    expect(yieldLoadInfo(undefined)).toBeNull();
  });

  it('carries the band without the prefix, for a column already headed עומס יבול', () => {
    // The plot list and the yield screen both render this in such a column.
    // They used to get there by label.replace('עומס יבול: ', '').
    expect(yieldLoadInfo(1400)?.short).toBe('גבוה');
    expect(yieldLoadInfo(1000)?.short).toBe('בינוני');
    expect(yieldLoadInfo(500)?.short).toBe('נמוך');
    for (const value of [1400, 1000, 500]) {
      expect(yieldLoadInfo(value)?.label).toBe(`עומס יבול: ${yieldLoadInfo(value)?.short}`);
    }
  });

  it('describes each band in words, for the tooltip on the pill', () => {
    expect(yieldLoadInfo(1400)?.range).toBe('מעל 1300 ק״ג/דונם');
    expect(yieldLoadInfo(1000)?.range).toBe('בין 900 ל-1300 ק״ג/דונם');
    expect(yieldLoadInfo(500)?.range).toBe('מתחת ל-900 ק״ג/דונם');
    // Never "900–1300": a dash between two digit runs is bidi-neutral and
    // paints reversed in this RTL page.
    expect(yieldLoadInfo(1000)?.range).not.toMatch(/\d\s*[–-]\s*\d/);
  });
});

// ─── plotMatchesSearch ───────────────────────────────────────────────────────

describe('plotMatchesSearch', () => {
  it('matches everything on an empty term', () => {
    expect(plotMatchesSearch(PLOT, '')).toBe(true);
  });

  it('matches a substring of the name', () => {
    expect(plotMatchesSearch(PLOT, 'ארבקינה')).toBe(true);
  });

  it('matches on region and grower too', () => {
    expect(plotMatchesSearch(PLOT, 'אגוזי')).toBe(true);
    expect(plotMatchesSearch(PLOT, 'גשור')).toBe(true);
  });

  it('matches the initials of the plot name', () => {
    // 'מיצר — 2003 — ארבקינה' → initials 'מ2א'
    expect(plotMatchesSearch(PLOT, 'מ2א')).toBe(true);
  });

  it('rejects a term that appears nowhere', () => {
    expect(plotMatchesSearch(PLOT, 'קורנייקי')).toBe(false);
  });
});

// ─── date helpers ────────────────────────────────────────────────────────────

describe('parseDM', () => {
  it('parses DD/MM with and without spaces', () => {
    expect(parseDM('15/09')).toEqual({ d: 15, m: 9 });
    expect(parseDM('5 / 9')).toEqual({ d: 5, m: 9 });
  });

  it('returns null on malformed input', () => {
    expect(parseDM('15-09')).toBeNull();
    expect(parseDM('')).toBeNull();
  });
});

describe('isDateInWindow', () => {
  it('handles a window inside one year', () => {
    expect(isDateInWindow('01/10', '30/11', NOW)).toBe(true);
    expect(isDateInWindow('01/01', '28/02', NOW)).toBe(false);
  });

  it('handles a window that wraps the turn of the year', () => {
    const january = new Date(2027, 0, 10);
    expect(isDateInWindow('15/11', '20/01', january)).toBe(true);
    expect(isDateInWindow('15/11', '20/01', NOW)).toBe(false);
  });

  it('is false when either bound is malformed', () => {
    expect(isDateInWindow('bad', '30/11', NOW)).toBe(false);
  });
});

describe('daysSinceLabel', () => {
  it.each([
    ['2026-10-15', 'היום'],
    ['2026-10-14', 'אתמול'],
    ['2026-10-10', 'לפני 5 ימים'],
  ])('%s reads as %s', (date, label) => {
    expect(daysSinceLabel(date as string, NOW)).toBe(label);
  });

  it('returns null for a missing or future date', () => {
    expect(daysSinceLabel(null, NOW)).toBeNull();
    expect(daysSinceLabel('2026-10-20', NOW)).toBeNull();
  });
});

// ─── PostgREST numeric coercion ──────────────────────────────────────────────

describe('numeric values arriving as PostgREST strings', () => {
  /**
   * Postgres NUMERIC is serialised as a STRING over PostgREST, so a rule's
   * upper_bound reaches the browser as "17.00" and a measurement as "9.00".
   *
   * Comparing two strings is lexical: "9" > "17" is true. Without coercion an
   * oil reading of 9% would fall past every band and land on the catch-all,
   * telling the grower to harvest IMMEDIATELY on fruit that is nowhere near
   * ready. Every fixture-based test above would still have passed, because
   * those fixtures use real numbers.
   */
  const pgRules: ParameterRule[] = RULES.map((r) => ({
    ...r,
    upper_bound: (r.upper_bound === null ? null : r.upper_bound.toFixed(2)) as never,
  }));

  it('confirms the trap that makes this necessary', () => {
    expect('9' > '17').toBe(true);
  });

  it.each([
    ['9.00', ParameterStatus.IDLE],
    ['16.90', ParameterStatus.IDLE],
    ['17.00', ParameterStatus.PLAN],
    ['20.00', ParameterStatus.PLAN],
    ['20.10', ParameterStatus.URGENT],
  ])('oil "%s" still resolves to %s', (value, expected) => {
    expect(evaluateParameter(pgRules, 'oil', value as string)?.status).toBe(expected);
  });

  it('handles a string measurement against numeric rules', () => {
    expect(evaluateParameter(RULES, 'water', '57.20')?.status).toBe(ParameterStatus.PLAN);
  });

  it('treats empty string as no measurement rather than zero', () => {
    expect(evaluateParameter(RULES, 'oil', '')).toBeNull();
  });

  it('coerces the yield estimate too', () => {
    expect(yieldLoadInfo('1500.00')?.label).toBe('עומס יבול: גבוה');
    expect(yieldLoadInfo('850.00')?.label).toBe('עומס יבול: נמוך');
    expect(yieldLoadInfo('')).toBeNull();
  });
});

// ─── timestamptz date handling ───────────────────────────────────────────────

describe('daysSinceLabel with timestamptz input', () => {
  /**
   * report_areas.report_date is timestamptz, not date, so PostgREST returns
   * "2026-10-14T00:00:00+00:00". Appending "T00:00:00" to that yields an
   * Invalid Date, which returned null and made every plot report that no
   * measurement had ever been taken — while the measurement was right there.
   */
  it('accepts a full ISO timestamp, not just YYYY-MM-DD', () => {
    expect(daysSinceLabel('2026-10-15T00:00:00+00:00', NOW)).toBe('היום');
    expect(daysSinceLabel('2026-10-14T00:00:00+00:00', NOW)).toBe('אתמול');
    expect(daysSinceLabel('2026-10-10T21:30:00+00:00', NOW)).toBe('לפני 5 ימים');
  });

  it('still accepts a plain date', () => {
    expect(daysSinceLabel('2026-10-14', NOW)).toBe('אתמול');
  });

  it('is still null for genuinely unparseable input', () => {
    expect(daysSinceLabel('not-a-date', NOW)).toBeNull();
  });
});

describe('parseYieldDraft', () => {
  it('reads a plain figure', () => {
    expect(parseYieldDraft('1400')).toEqual({ ok: true, value: 1400 });
    expect(parseYieldDraft('0')).toEqual({ ok: true, value: 0 });
    expect(parseYieldDraft(' 1234.5 ')).toEqual({ ok: true, value: 1234.5 });
  });

  it('treats an emptied field as a deliberate clear', () => {
    expect(parseYieldDraft('')).toEqual({ ok: true, value: null });
    expect(parseYieldDraft('   ')).toEqual({ ok: true, value: null });
  });

  it('refuses what would otherwise be saved as a silent clear', () => {
    // The route coerces with a bare Number() and JSON.stringify(NaN) is null,
    // so a typo reaching it does not fail — it wipes the estimate.
    expect(parseYieldDraft('12a').ok).toBe(false);
    expect(parseYieldDraft('abc').ok).toBe(false);
  });

  it('refuses a negative, which the column has no CHECK against', () => {
    expect(parseYieldDraft('-1').ok).toBe(false);
  });

  it('refuses more than NUMERIC(10,2) can hold', () => {
    expect(parseYieldDraft('99999999.99').ok).toBe(true);
    expect(parseYieldDraft('100000000').ok).toBe(false);
    expect(parseYieldDraft('1e999').ok).toBe(false);
  });
});
