import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  groupIssues,
  ISSUE_CATEGORIES,
  type ImportIssue,
  type IssueCategory,
} from '@/lib/olive/import-issues';

/**
 * The labels are a contract between the importer and the two things that show
 * its output — the admin page and the CLI. TypeScript already forces every
 * category to have an entry; what it cannot check is that the entry says
 * anything useful, or that a label is still reachable after a flag is removed.
 */

const CATEGORIES = Object.keys(ISSUE_CATEGORIES) as IssueCategory[];

describe('ISSUE_CATEGORIES', () => {
  it('gives every label all three parts of the explanation', () => {
    for (const category of CATEGORIES) {
      const info = ISSUE_CATEGORIES[category];
      expect(info.label, category).toBeTruthy();
      // An explanation that fits on one line is a restatement of the message,
      // which is exactly what the label exists to avoid.
      expect(info.what.length, `${category}.what`).toBeGreaterThan(40);
      expect(info.effect.length, `${category}.effect`).toBeGreaterThan(40);
      expect(info.action.length, `${category}.action`).toBeGreaterThan(40);
    }
  });

  it('keeps the labels distinct, since the badge is all the operator reads', () => {
    const labels = CATEGORIES.map((c) => ISSUE_CATEGORIES[c].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // A label nobody raises is a promise the preview never keeps: the operator
  // reads it in no import and cannot tell whether it is unreachable or simply
  // did not happen this time.
  it('has no label the importer cannot raise', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../lib/olive/import-backup.ts'),
      'utf8'
    );
    for (const category of CATEGORIES) {
      expect(source, category).toContain(`'${category}'`);
    }
  });
});

describe('groupIssues', () => {
  const issues: ImportIssue[] = [
    { category: 'plantYear', message: 'א' },
    { category: 'nirTakt', message: 'ב' },
    { category: 'plantYear', message: 'ג' },
    { category: 'nirDry', message: 'ד' },
    { category: 'nirTakt', message: 'ה' },
  ];

  it('collects each label once, keeping the messages in file order', () => {
    const groups = groupIssues(issues);
    expect(groups.map((g) => g.category)).toEqual(['plantYear', 'nirTakt', 'nirDry']);
    expect(groups[0].messages).toEqual(['א', 'ג']);
    expect(groups[1].messages).toEqual(['ב', 'ה']);
  });

  // File order, not category order: the list is read alongside the export.
  it('orders groups by first appearance, not by the category list', () => {
    const groups = groupIssues([
      { category: 'alertThresholds', message: 'א' },
      { category: 'plotSkipped', message: 'ב' },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['alertThresholds', 'plotSkipped']);
  });

  it('carries the explanation alongside the messages', () => {
    const [group] = groupIssues([{ category: 'nirDry', message: 'א' }]);
    expect(group.info).toBe(ISSUE_CATEGORIES.nirDry);
  });

  it('returns nothing for a clean import', () => {
    expect(groupIssues([])).toEqual([]);
  });
});
