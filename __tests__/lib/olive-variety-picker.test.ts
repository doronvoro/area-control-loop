import { describe, it, expect } from 'vitest';
import {
  NEW_VARIETY,
  initialVarietySelection,
  varietyChanged,
  varietyPayload,
} from '@/components/olive/VarietyPicker';
import { NONE } from '@/lib/forms/none-sentinel';

/**
 * The picker's payload decides what PUT /api/olive/plots writes to `areas`, and
 * varietyChanged decides whether it writes at all — an untouched picker must
 * not rewrite a plot's variety on every drawer save.
 */
const LIST = [
  { id: 'v-arb', name: 'ארבקינה' },
  { id: 'v-kor', name: 'קורנייקי' },
];

describe('initialVarietySelection', () => {
  it('selects the list entry when the plot has a known variety', () => {
    expect(initialVarietySelection('v-arb', 'ארבקינה', LIST)).toEqual({
      varietyId: 'v-arb',
      varietyName: '',
    });
  });

  it('falls back to "new" with the stored name when the id is not in the list', () => {
    expect(initialVarietySelection('v-gone', 'ברנע', LIST)).toEqual({
      varietyId: NEW_VARIETY,
      varietyName: 'ברנע',
    });
    // The list has not loaded yet.
    expect(initialVarietySelection('v-arb', 'ארבקינה', [])).toEqual({
      varietyId: NEW_VARIETY,
      varietyName: 'ארבקינה',
    });
  });

  it('is "none" for a plot with no variety', () => {
    expect(initialVarietySelection(null, null, LIST)).toEqual({ varietyId: NONE, varietyName: '' });
  });
});

describe('varietyPayload', () => {
  it('sends only the id for a picked variety', () => {
    expect(varietyPayload({ varietyId: 'v-arb', varietyName: '' })).toEqual({
      variety_id: 'v-arb',
      variety: null,
    });
  });

  it('sends a trimmed name for a new one', () => {
    expect(varietyPayload({ varietyId: NEW_VARIETY, varietyName: ' סורי ' })).toEqual({
      variety_id: null,
      variety: 'סורי',
    });
  });

  it('sends nulls for none', () => {
    expect(varietyPayload({ varietyId: NONE, varietyName: '' })).toEqual({
      variety_id: null,
      variety: null,
    });
  });
});

describe('varietyChanged', () => {
  it('is false for an untouched picker', () => {
    expect(varietyChanged({ varietyId: 'v-arb', varietyName: '' }, 'v-arb', 'ארבקינה')).toBe(false);
    // Seeded as "new" before the list loaded, still untouched.
    expect(
      varietyChanged({ varietyId: NEW_VARIETY, varietyName: 'ארבקינה' }, 'v-arb', 'ארבקינה')
    ).toBe(false);
    expect(varietyChanged({ varietyId: NONE, varietyName: '' }, null, null)).toBe(false);
  });

  it('is true when another variety is picked, a new name typed, or it is cleared', () => {
    expect(varietyChanged({ varietyId: 'v-kor', varietyName: '' }, 'v-arb', 'ארבקינה')).toBe(true);
    expect(
      varietyChanged({ varietyId: NEW_VARIETY, varietyName: 'סורי' }, 'v-arb', 'ארבקינה')
    ).toBe(true);
    expect(varietyChanged({ varietyId: NONE, varietyName: '' }, 'v-arb', 'ארבקינה')).toBe(true);
  });
});
