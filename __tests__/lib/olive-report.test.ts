import { describe, it, expect } from 'vitest';

import { panelDomain, MIN_SPAN } from '@/lib/olive/report/chart-scale';
import { buildRecommendation } from '@/lib/olive/report/recommendation';

/**
 * The report's two pure pieces.
 *
 * The chart scale matters more than it looks. The prototype drew every series on
 * a fixed 0..100 axis, which on real Gashur data rendered the whole season as
 * three flat lines — the trend the report exists to communicate was invisible.
 * These tests pin the two properties that fix it without overcorrecting: the
 * axis follows the data, and it refuses to zoom past MIN_SPAN so that sampling
 * noise cannot be mistaken for a rise.
 */

describe('panelDomain', () => {
  it('returns null when there is nothing to scale', () => {
    expect(panelDomain([])).toBeNull();
    expect(panelDomain([null, undefined])).toBeNull();
    expect(panelDomain([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it('ignores gaps and scales to the readings that exist', () => {
    const domain = panelDomain([null, 12, undefined, 18]);
    expect(domain).not.toBeNull();
    expect(domain!.min).toBeLessThanOrEqual(12);
    expect(domain!.max).toBeGreaterThanOrEqual(18);
  });

  it('keeps a nearly flat series readable without inventing a slope', () => {
    // שדות — 2023 — פיקואל: 4.8 on 09-07, 5.3 on 09-18. A real but small rise.
    const domain = panelDomain([4.8, 5.3])!;

    expect(domain.max - domain.min).toBeGreaterThanOrEqual(MIN_SPAN);
    expect(domain.min).toBeLessThanOrEqual(4.8);
    expect(domain.max).toBeGreaterThanOrEqual(5.3);

    // The point of the fix: on the old 0..100 axis these two sat 0.5% of the
    // panel apart. They must now be far enough apart to read as a rise.
    const fraction = (5.3 - 4.8) / (domain.max - domain.min);
    expect(fraction).toBeGreaterThan(0.1);
  });

  it('does not amplify a series that did not move at all', () => {
    const domain = panelDomain([60, 60])!;
    expect(domain.max - domain.min).toBeGreaterThanOrEqual(MIN_SPAN);
    expect(domain.min).toBeLessThanOrEqual(60);
    expect(domain.max).toBeGreaterThanOrEqual(60);
  });

  it('spans both series on the shared oil / dry panel', () => {
    // oil 4.8→5.3 plotted against dry 14.93→16.26.
    const domain = panelDomain([4.8, 5.3, 14.93, 16.26])!;
    expect(domain.min).toBeLessThanOrEqual(4.8);
    expect(domain.max).toBeGreaterThanOrEqual(16.26);
  });

  it('keeps the water panel tight around its own range', () => {
    // Water lives 50 points above oil; on a shared axis it pinned the ceiling.
    const domain = panelDomain([68.1, 67.3])!;
    expect(domain.min).toBeGreaterThan(50);
    expect(domain.max).toBeLessThan(80);
  });

  it('never drops below zero, whatever the padding', () => {
    expect(panelDomain([0.2, 0.4])!.min).toBe(0);
    expect(panelDomain([0])!.min).toBe(0);
  });

  it('puts ticks on round numbers, ascending, inside the domain', () => {
    const domain = panelDomain([8.2, 12.1])!;

    expect(domain.ticks.length).toBeGreaterThanOrEqual(2);
    for (const tick of domain.ticks) {
      expect(tick).toBeGreaterThanOrEqual(domain.min);
      expect(tick).toBeLessThanOrEqual(domain.max);
    }
    for (let i = 1; i < domain.ticks.length; i += 1) {
      expect(domain.ticks[i]).toBeGreaterThan(domain.ticks[i - 1]);
    }

    // A gridline a grower cannot read off the paper is not a gridline.
    const step = domain.ticks[1] - domain.ticks[0];
    expect(Number.isInteger(step * 2)).toBe(true);
  });

  it('does not round the domain out to whole gridline steps', () => {
    // A wide season — oil 12..22 against dry 12.4..44.7. Snapping the domain to
    // the step would push it out to 0..60 and waste half the panel, which is the
    // fixed-axis bug in a new costume.
    const domain = panelDomain([22.1, 12, 44.65, 12.37])!;

    expect(domain.min).toBeGreaterThan(0);
    expect(domain.max).toBeLessThan(55);
    // The readings must occupy most of the height they are given.
    expect((44.65 - 12) / (domain.max - domain.min)).toBeGreaterThan(0.6);
  });

  it('handles a single reading', () => {
    const domain = panelDomain([9.3])!;
    expect(domain.max - domain.min).toBeGreaterThanOrEqual(MIN_SPAN);
  });
});

describe('buildRecommendation', () => {
  const base = {
    headline: 'ללא דחיפות מיוחדת',
    windowLine: '',
    weatherLines: [] as string[],
    harvesterLabel: null,
  };

  it('is just the headline when nothing else applies', () => {
    expect(buildRecommendation(base)).toBe('ללא דחיפות מיוחדת.');
  });

  it('reproduces the prototype ordering: action, window, weather, harvester', () => {
    expect(
      buildRecommendation({
        headline: 'מסיק דחוף — שמן בטווח מיידי וגשם בדרך',
        windowLine: 'בתוך חלון הקטיף המוגדר לזן ארבקינה',
        weatherLines: ['גשם צפוי 2026-09-23: 12 מ"מ', 'גשם צפוי 2026-09-24: 12 מ"מ'],
        harvesterLabel: 'ניו הולנד 9090X',
      })
    ).toBe(
      'מסיק דחוף — שמן בטווח מיידי וגשם בדרך. בתוך חלון הקטיף המוגדר לזן ארבקינה. ' +
        'גשם צפוי 2026-09-23: 12 מ"מ · גשם צפוי 2026-09-24: 12 מ"מ. מוסקת משובצת: ניו הולנד 9090X.'
    );
  });

  it('joins several weather alerts into one sentence', () => {
    expect(buildRecommendation({ ...base, weatherLines: ['גשם צפוי 2026-09-23: 12 מ"מ'] })).toBe(
      'ללא דחיפות מיוחדת. גשם צפוי 2026-09-23: 12 מ"מ.'
    );
  });

  it('omits the harvester clause when no machine is assigned', () => {
    expect(buildRecommendation({ ...base, harvesterLabel: null })).not.toContain('מוסקת משובצת');
  });
});
