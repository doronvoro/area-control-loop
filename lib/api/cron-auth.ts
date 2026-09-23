/**
 * Authenticating a Vercel cron invocation.
 *
 * Vercel invokes a cron with an anonymous GET — no cookie, no session, no user.
 * When the project has a CRON_SECRET environment variable, Vercel sends its
 * value as `Authorization: Bearer <CRON_SECRET>`, and the handler is expected to
 * compare the two itself.
 *
 * THIS STRING COMPARE IS THE ENTIRE AUTHORIZATION BOUNDARY FOR /api/cron/*.
 * There is no defence in depth behind it, because lib/supabase/middleware.ts
 * waves through *any* request under /api/ whose Authorization header begins with
 * "Bearer " — that bypass exists for the mobile app's Supabase JWTs and performs
 * no validation of its own. So every mobile token, and anything else shaped like
 * a bearer credential, reaches this function. None of them may open the route.
 *
 * Pure, and takes the secret as an argument rather than reading process.env, so
 * the fail-closed case can be tested without stubbing the environment. The route
 * supplies process.env.CRON_SECRET, matching how the rest of the repo reads env
 * at the consumer.
 */
export function isAuthorizedCronRequest(
  authorizationHeader: string | null | undefined,
  cronSecret: string | undefined
): boolean {
  // Fail closed. An unset OR EMPTY secret means the endpoint is unconfigured,
  // and an unconfigured endpoint must reject everything — Vercel stores empty
  // strings happily, and without this guard `Bearer ` would authenticate.
  if (!cronSecret) return false;
  if (!authorizationHeader) return false;

  // Exact match, including the capital B: Vercel sends "Bearer". Deliberately
  // not trimmed and not lowercased — a header that does not look exactly like
  // the one Vercel sends is not a cron invocation.
  return authorizationHeader === `Bearer ${cronSecret}`;
}
