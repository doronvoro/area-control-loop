import { describe, it, expect } from 'vitest';
import { isAuthorizedCronRequest } from '@/lib/api/cron-auth';

/**
 * The whole of /api/cron/weather's authorization lives in this one function, and
 * it runs without any middleware protection behind it — lib/supabase/middleware.ts
 * lets every `Bearer …` request under /api/ reach the handler unvalidated.
 *
 * The two cases worth reading before changing anything here are "the secret is
 * unset" (a deploy that forgot the env var must not leave the route open) and
 * "a valid Supabase mobile JWT" (those arrive at this function for real).
 */

const SECRET = 'iE3k9vQ2mXr7pL0aZs5tYb8N';

describe('a genuine Vercel cron invocation', () => {
  it('is accepted', () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });
});

describe('fail-closed when the secret is not configured', () => {
  it('rejects everything when CRON_SECRET is unset', () => {
    // process.env.X is `undefined` when the var was never set. A deploy that
    // ships the route before the env var must be a loud no-op, not an open door.
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorizedCronRequest('Bearer anything', undefined)).toBe(false);
  });

  it('rejects everything when CRON_SECRET is an empty string', () => {
    // Vercel stores empty values happily. Without the falsy guard this would
    // compare against `Bearer ` and let a two-word header straight through.
    expect(isAuthorizedCronRequest('Bearer ', '')).toBe(false);
    expect(isAuthorizedCronRequest('Bearer', '')).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, '')).toBe(false);
  });
});

describe('the header', () => {
  it('rejects a missing or empty header', () => {
    // request.headers.get() returns null when the header is absent.
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(undefined, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest('', SECRET)).toBe(false);
  });

  it('rejects the bare secret without the Bearer prefix', () => {
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
  });

  it('rejects a lowercased scheme', () => {
    // Vercel sends "Bearer". Pinned so nobody "fixes" this by case-folding and
    // quietly widens what counts as a cron request.
    expect(isAuthorizedCronRequest(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`BEARER ${SECRET}`, SECRET)).toBe(false);
  });

  it('rejects a wrong secret, and a prefix of the right one', () => {
    expect(isAuthorizedCronRequest('Bearer wrong', SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
  });

  it('rejects surrounding whitespace', () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET} `, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(` Bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer  ${SECRET}`, SECRET)).toBe(false);
  });

  it('rejects a well-formed Supabase JWT', () => {
    // This is the threat model, not a hypothetical: middleware hands every
    // mobile bearer token to this route. A logged-in worker's token must not
    // trigger a service-role write any more than a stranger's would.
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9' +
      '.dGhpcy1pcy1ub3QtdGhlLWNyb24tc2VjcmV0';
    expect(isAuthorizedCronRequest(`Bearer ${jwt}`, SECRET)).toBe(false);
  });
});
