import { describe, it, expect } from 'vitest';

import { buildParameterRecommendations } from '@/lib/olive/report/recommendation';
import { ParameterStatus, type ParameterRule } from '@/types/database';

/**
 * The plot report's "המלצות" list.
 *
 * The client's sample report (2026-09-29) prints one line per measurement that
 * calls for action and nothing for the rest. These tests pin which readings
 * produce a line, the order, and the exact wording — which comes from the rule
 * row, so the report and the dashboard cannot disagree about a reading.
 */

let ruleSeq = 0;
function rule(
  parameter_code: string,
  upper_bound: number | null,
  upper_inclusive: boolean,
  status: ParameterStatus,
  message: string,
  sort_order: number
): ParameterRule {
  return {
    id: `r${++ruleSeq}`,
    parameter_code,
    upper_bound,
    upper_inclusive,
    status,
    severity: 0,
    message,
    sort_order,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

/** Mirrors the seed in 20260908100000_create_olive_parameters.sql. */
const RULES: ParameterRule[] = [
  rule('oil', 17, false, ParameterStatus.IDLE, 'לא מוכן למסיק', 1),
  rule('oil', 20, true, ParameterStatus.PLAN, 'תוכנן למסיק', 2),
  rule('oil', null, true, ParameterStatus.URGENT, 'מסיק מיידי', 3),

  rule('water', 50, false, ParameterStatus.URGENT, 'עקת מים', 1),
  rule('water', 54, true, ParameterStatus.OK, 'אופטימום', 2),
  rule('water', 60, true, ParameterStatus.PLAN, 'צמצום השקיה', 3),
  rule('water', null, true, ParameterStatus.URGENT, 'סגירת מים מיידית', 4),

  rule('dry', 40, false, ParameterStatus.IDLE, '—', 1),
  rule('dry', 45, true, ParameterStatus.PLAN, 'תשומת לב / החלטה', 2),
  rule('dry', null, true, ParameterStatus.URGENT, 'מסיק', 3),
];

describe('buildParameterRecommendations', () => {
  it('reproduces the sample: only water, which is the one reading to act on', () => {
    expect(buildParameterRecommendations(RULES, { oil: 11.8, water: 55.6, dry: 26.85 })).toEqual([
      'מים: צמצום השקיה (55.6%).',
    ]);
  });

  it('lists plan and urgent readings in tile order: oil, water, dry', () => {
    expect(buildParameterRecommendations(RULES, { oil: 21, water: 62, dry: 42.5 })).toEqual([
      'שמן: מסיק מיידי (21%).',
      'מים: סגירת מים מיידית (62%).',
      'שמן בחו"י: תשומת לב / החלטה (42.5%).',
    ]);
  });

  it('says nothing for a reading at optimum', () => {
    expect(buildParameterRecommendations(RULES, { oil: 10, water: 52, dry: 20 })).toEqual([]);
  });

  it('is empty with no latest reading', () => {
    expect(buildParameterRecommendations(RULES, null)).toEqual([]);
  });

  it('skips a missing value and a parameter with no rules', () => {
    expect(buildParameterRecommendations(RULES, { oil: null, water: 58, dry: 50 })).toEqual([
      'מים: צמצום השקיה (58%).',
      'שמן בחו"י: מסיק (50%).',
    ]);
    expect(buildParameterRecommendations([], { oil: 25, water: 70, dry: 50 })).toEqual([]);
  });
});
