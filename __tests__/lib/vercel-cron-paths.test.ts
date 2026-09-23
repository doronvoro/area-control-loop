import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every scheduled path in vercel.json must resolve to a route that exists.
 *
 * Vercel does not validate this, and the failure mode is quiet: a cron pointed
 * at a path that is not there still *runs* on schedule and simply 404s, so the
 * job looks alive in the dashboard while doing nothing. Renaming or moving
 * app/api/cron/weather/route.ts without editing vercel.json is the way that
 * happens, and nothing else in the toolchain would catch it.
 */

const ROOT = join(__dirname, '..', '..');

interface CronEntry {
  path: string;
  schedule: string;
}

function crons(): CronEntry[] {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  return config.crons ?? [];
}

describe('vercel.json crons', () => {
  it('schedules at least the forecast refresh', () => {
    expect(crons().map((entry) => entry.path)).toContain('/api/cron/weather');
  });

  it('points every schedule at a route handler that exists', () => {
    for (const { path } of crons()) {
      const routeFile = join(ROOT, 'app', path, 'route.ts');
      expect(
        existsSync(routeFile),
        `vercel.json schedules ${path}, but there is no handler at app${path}/route.ts. ` +
          'Either the route moved, or this is a cron on a dynamic route — Vercel allows ' +
          'those with a literal id in the path, and this check would need to resolve ' +
          '[param] segments to support one.'
      ).toBe(true);
    }
  });

  it('stays within the once-per-day limit that Vercel Hobby enforces', () => {
    // A sub-daily expression is rejected at DEPLOY time on a Hobby account,
    // taking the whole deployment down rather than just the cron. Pinning the
    // two leading fields to single values keeps that a test failure here.
    //
    // If this ever fails because a more frequent schedule is genuinely wanted:
    // confirm the Vercel account is on Pro first, then relax this test.
    for (const { schedule } of crons()) {
      const [minute, hour] = schedule.split(' ');
      const hint = `"${schedule}" runs more than once a day, which Hobby rejects at deploy time`;
      expect(minute, hint).toMatch(/^\d+$/);
      expect(hour, hint).toMatch(/^\d+$/);
    }
  });
});
