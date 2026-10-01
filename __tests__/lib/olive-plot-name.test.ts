import { describe, it, expect } from 'vitest';
import { composePlotName, plantYearForName } from '@/lib/olive/plot-name';

describe('composePlotName', () => {
  it('joins name, year and variety the way the client names plots', () => {
    expect(composePlotName('זית בוגר (מיצר)', '2003', 'ארבקינה')).toBe(
      'זית בוגר (מיצר) — 2003 — ארבקינה'
    );
  });

  it('skips missing parts instead of leaving empty separators', () => {
    expect(composePlotName('זית מיצר', '', null)).toBe('זית מיצר');
    expect(composePlotName('', '2018', 'ארבקינה')).toBe('2018 — ארבקינה');
    expect(composePlotName(' ', null, undefined)).toBe('');
  });
});

describe('plantYearForName', () => {
  it("keeps the grower's label while the date is untouched", () => {
    expect(plantYearForName('2006-07-01', '2006-07-01', '2006/7')).toBe('2006/7');
  });

  it('uses the year of a newly picked date', () => {
    expect(plantYearForName('2008-03-15', '2006-07-01', '2006/7')).toBe('2008');
  });

  it('falls back to the date year when there is no label', () => {
    expect(plantYearForName('2004-01-01', '2004-01-01', null)).toBe('2004');
  });

  it('is empty when no date is set', () => {
    expect(plantYearForName('', '', null)).toBe('');
  });
});
