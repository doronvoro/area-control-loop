# Olive module — production schema rollout

## The situation

The PR is merged into `main` (`17279d7`), and the git→Vercel pipeline deploys
`main`. **The olive code is therefore already live**, while the database may not
yet have the schema it depends on.

That inverts the original plan, which assumed schema-then-code. It matters
because `report_areas.report_number` is not olive-only — it is selected by:

| Path | File |
| --- | --- |
| Reports list | `app/api/reports/route.ts:31` |
| Report detail | `lib/reports/fetch-report-detail.ts:57` |
| Monitoring submit | `lib/services/monitoring.service.ts:98` |
| Action tasks list | `app/api/action-tasks/route.ts:64` |
| Complete a task | `app/api/action-tasks/complete/route.ts:325` |

If that column is missing in production, those screens are erroring for the
existing tenant **right now**. `00-preflight.sql` step 1 answers that in one
query, and it is the first thing to run.

## Why not `supabase db push`

Three reasons, any one of which is sufficient:

1. `20260227000000_add_geometry_to_areas.sql` was committed empty and back-filled
   later. Its version may already be recorded as applied while its content never
   ran, so `db push` would skip it.
2. Production is a restored project; the migration ledger is not trustworthy
   until `00-preflight.sql` step 9 has been read.
3. `db push` gives no chance to stop between the RLS change and everything else.

Apply the SQL directly instead, and reconcile the ledger afterwards.

## Order

Run in Supabase Studio → SQL Editor, or psql against the pooler on **port 5432
(session mode)** — never 6543.

All four files are **pure SQL with no psql meta-commands**, so they paste into
Studio as-is. The read-only ones each return a **single result grid**, because
Studio shows only the last result set when a script has several statements —
`00-preflight` and `02-verify` are therefore one big `values` list rather than a
series of queries. `02-verify` carries an explicit `want=` on every row so you
are comparing, not interpreting.

| # | File | Writes? | Notes |
| --- | --- | --- | --- |
| 0 | `00-preflight.sql` | no | Keep the output. It is the before-picture and half the rollback. |
| 1 | *(backup)* | — | See below. Do not skip. |
| 2 | `01-migrations-in-order.sql` | **yes** | All 7, timestamp order, one transaction. |
| 3 | `02-verify.sql` | no | Then exercise the live site as the existing tenant. |
| 4 | *(ledger repair)* | yes | `supabase migration repair --status applied <version>` for each. |

`03-rollback.sql` is written in advance and fully commented out. Read its section
headers before running anything from it.

### Backup first

Both files in `backups/` are 0 bytes — whatever wrote them failed silently, so
never trust an exit code here. Host `pg_dump` is PG15 against a PG17 server and
will refuse; use the CLI's pinned Docker binary:

```bash
npx supabase db dump --db-url "$PROD_DB_URL" -f backups/pre-olive-schema-$(date +%Y%m%d-%H%M).sql
npx supabase db dump --db-url "$PROD_DB_URL" --data-only -f backups/pre-olive-data-$(date +%Y%m%d-%H%M).sql
ls -l backups/ && grep -c "CREATE TABLE" backups/pre-olive-schema-*.sql
```

Take a Dashboard snapshot too, so a restore point exists off the laptop. **If
neither is confirmed, stop.**

## What the migrations do

| File | Effect | Risk |
| --- | --- | --- |
| `20260227000000_add_geometry_to_areas` | geometry jsonb on areas/sub_areas | none, expect no-op |
| `20260907000000_fix_areas_report_areas_rls_recursion` | **drops** `"Users can view areas through report areas"` | **the only change that touches the live tenant** |
| `20260908000000_add_report_number_to_report_areas` | `report_number` identity column | unblocks the core screens |
| `20260908100000_create_olive_parameters` | `parameters`, `parameter_rules` + seed | additive |
| `20260908110000_create_olive_plot_tables` | 5 olive tables | additive |
| `20260908120000_create_olive_report_types` | `nir_report`, `harvest_report` | additive |
| `20260908140000_add_plant_year_label` | one text column | additive |

All are re-runnable (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`).
Verified: the bundle applies cleanly against a database that already has
everything, exiting 0 with only "already exists, skipping" notices.

The bundle is wrapped in a single transaction, so a mid-way failure rolls back
rather than leaving the schema half-applied. To go one file at a time instead,
run the files from `supabase/migrations/` directly in the order in the table
above and read the output before each next one.

## After the schema

The data import is a separate exercise — see the rollout plan. In short: create
the `זית` crop, create the קיבוץ גשור tenant through the live UI, then

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<prod service role key>" \
npm run import-olive -- "<backup>.html" --customer "<gashur-uuid>"
```

The importer **never reads `.env.local`** and defaults to local Docker, so the
env vars above are mandatory — otherwise it will happily import into Docker and
print a green summary.

Expected dry run: `45 new, 0 matched` · `yield: would write 41, 1 unmatched,
4 without an estimate` · `NIR 1 new` · **exactly 5 flags**. Any other flag line
is a stop condition.

**Never run `supabase/seed/olive_demo_seed.sql` on production.** It cross-joins
every customer into `customer_areas`.
