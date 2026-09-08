import { describe, it, expect } from 'vitest';
import {
  evaluateParameter,
  computeUpcomingWeather,
  computePlotStatus,
  classifyPlotCategory,
  yieldLoadInfo,
  plotMatchesSearch,
  parseDM,
  isDateInWindow,
  daysSinceLabel,
  type PlotLike,
  type NirLike,
  type WeatherDayLike,
} from '@/lib/olive/logic';
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
        { entry_date: '2026-10-16', rain_mm: 40, wind_kmh: null, is_manual: false },
        { entry_date: '2026-10-16', rain_mm: 0, wind_kmh: null, is_manual: true },
      ],
      NOW
    );
    expect(result.rainSoon).toBe(false);
    expect(result.upcoming).toHaveLength(1);
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
    expect(classifyPlotCategory(null, RULES)).toBe('testing');
  });

  it('is ready when oil is urgent', () => {
    expect(classifyPlotCategory(nir({ oil: 21 }), RULES)).toBe('ready');
  });

  it('is anomaly on water stress', () => {
    expect(classifyPlotCategory(nir({ oil: 12, water: 45 }), RULES)).toBe('anomaly');
  });

  it('is anomaly on high dry-matter oil', () => {
    expect(classifyPlotCategory(nir({ oil: 12, dry: 46 }), RULES)).toBe('anomaly');
  });

  it('is normal when oil is planned and nothing is out of range', () => {
    expect(classifyPlotCategory(nir({ oil: 18, water: 52 }), RULES)).toBe('normal');
  });

  it('is testing when oil is below range and nothing is out of range', () => {
    expect(classifyPlotCategory(nir({ oil: 12, water: 52 }), RULES)).toBe('testing');
  });

  // Order matters: oil-urgent is checked BEFORE water/dry-urgent.
  it('reports ready, not anomaly, when oil is urgent AND water is out of range', () => {
    expect(classifyPlotCategory(nir({ oil: 21, water: 70 }), RULES)).toBe('ready');
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
    expect(classifyPlotCategory(sample, RULES)).toBe('anomaly');
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
