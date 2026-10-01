import { describe, it, expect } from 'vitest';
import { composePlotName, plantYearForName, plotDisplayName } from '@/lib/olive/plot-name';

describe('composePlotName', () => {
  it('joins name, year and variety the way the client names plots', () => {
    expect(composePlotName('זית בוגר (מיצר)', '2003', 'ארבקינה')).toBe(
      'זית בוגר (מיצר) — 2003 — ארבקינה'
    );
  });

  it('does not repeat a variety that is also the name', () => {
    expect(composePlotName('ארבקינה', '', 'ארבקינה')).toBe('ארבקינה');
    expect(composePlotName('ארבקינה צעיר', '2022', 'ארבקינה')).toBe(
      'ארבקינה צעיר — 2022 — ארבקינה'
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

describe('plotDisplayName', () => {
  it('builds the name from block, year label and variety', () => {
    expect(
      plotDisplayName({
        name: 'whatever',
        region: 'זית בוגר (מיצר)',
        plantYearLabel: '2006/7',
        plantingTime: '2006-07-01',
        variety: 'קורנייקי',
      })
    ).toBe('זית בוגר (מיצר) — 2006/7 — קורנייקי');
  });

  it('uses the plot name when there is no block', () => {
    expect(plotDisplayName({ name: 'דרום', plantingTime: '2018-01-01', variety: 'ארבקינה' })).toBe(
      'דרום — 2018 — ארבקינה'
    );
    expect(plotDisplayName({ name: 'בוגר', variety: 'ארבקינה' })).toBe('בוגר — ארבקינה');
    expect(plotDisplayName({ name: 'זית מיצר' })).toBe('זית מיצר');
  });

  it('does not repeat year and variety of a stored name already in the format', () => {
    expect(
      plotDisplayName({
        name: 'זית בוגר (מיצר) — 2007 — ארבקינה',
        plantYearLabel: '2007',
        variety: 'ארבקינה',
      })
    ).toBe('זית בוגר (מיצר) — 2007 — ארבקינה');
  });

  it('matches what the import stored for a table-generated plot', () => {
    expect(
      plotDisplayName({
        name: 'זית בית — 2014 — סורי',
        region: 'זית בית',
        plantYearLabel: '2014',
        variety: 'סורי',
      })
    ).toBe('זית בית — 2014 — סורי');
  });
});
