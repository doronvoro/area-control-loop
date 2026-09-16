/**
 * Shape-tests for PostgREST errors, for the cases where an error is an
 * expected state rather than a failure.
 *
 * supabase-js returns these as plain objects, not Errors — `instanceof Error`
 * is false and handleApiError turns one into a 500 reading "Unknown error" —
 * so the only thing worth branching on is `code`.
 */

/**
 * Does this error mean the table simply is not there yet?
 *
 * Two codes, because two layers can answer that question and only one of them
 * usually gets the chance. PostgREST resolves a table name against its own
 * schema cache first and answers an unknown one with a 404 and PGRST205
 * ("Could not find the table ... in the schema cache") — the statement never
 * reaches Postgres, so Postgres never raises 42P01. 42P01 (undefined_table)
 * comes back only when something does reach the database with an unknown
 * relation: an RPC body, a view over a dropped table, an older PostgREST.
 *
 * Matching on 42P01 alone therefore looks right and never fires, which is
 * invisible until the one day it matters: this repo merges code to Vercel and
 * applies production schema by hand afterwards (docs/rollout/README.md), so
 * every table added that way has a window where reading it MUST degrade to its
 * defaults rather than 500 a whole payload over one config row.
 */
export function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code;
  return code === 'PGRST205' || code === '42P01';
}
