-- Olive rollout — NIR "SENT TO CLIENT". Adds two columns to one table.
--
-- Mirrors supabase/migrations/20260923140000_add_nir_sent_to_client.sql. It is a
-- separate file for the same reason every other step here is: the ledger does
-- not describe this database (docs/rollout/README.md), so schema reaches
-- production by being pasted, not pushed.
--
-- WHY IT IS NEEDED
-- A NIR reading is taken in the grove and then has to reach the grower. Nothing
-- recorded that last step, so "which readings still owe the grower an update?"
-- was a question only WhatsApp could answer. The log now carries a נשלח column,
-- a one-click toggle per row, a טרם נשלח filter, and a season counter on /olive.
--
-- ORDERING — THIS ONE IS *NOT* SAFE EITHER WAY. Read this before merging.
-- Steps 09 and 10 were explicitly safe to run whenever, because the code fell
-- back to compiled defaults. This one is asymmetric:
--
--   READS degrade gracefully. detail:nir_report(*) simply returns rows without
--   the keys, every reading shows —, the filter treats everything as unsent and
--   the dashboard counter reads 0. Nothing breaks and nothing lies.
--
--   WRITES FAIL. Any PUT carrying sent_to_client_at hits PostgREST PGRST204
--   ("column not found in schema cache"), which handleApiError surfaces as a
--   generic Hebrew save error. Marking a reading sent is the only thing that
--   fails: NirFormSheet omits the key entirely unless the checkbox was touched,
--   so ordinary NIR entry and editing keep working in the gap.
--
-- So: run this BEFORE the deploy, or accept that the toggle errors until it has.
--
-- WHY sent_to_client_by POINTS AT auth.users AND NOT workers
-- Three kinds of actor reach the NIR routes and only one has a workers row: a
-- worker does, a customer owner does not, an admin may have neither. ארץ גשור is
-- a CUSTOMER (customers.customer_type = 'owner'), so its owner has no workers
-- row — a workers(id) FK would store NULL for exactly the people most likely to
-- be sending readings out. report_areas.worker_id already has that hole, which
-- is why the log's דוגם column can come up blank; this does not inherit it.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS twice is a no-op, and this never writes
-- a row, so it cannot overwrite marks already made.
--
-- No RLS change. nir_report's policy from 20260908120000 is
-- `FOR ALL USING (can_access_report_area(report_area_id, auth.uid()))`, which is
-- column-agnostic and needs no edit for a new column.

BEGIN;

ALTER TABLE public.nir_report
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_client_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nir_report.sent_to_client_at IS
  'The moment this reading was sent to the client. NULL = not sent. Recorded by hand today; the planned send-mail button will write the same column.';

COMMENT ON COLUMN public.nir_report.sent_to_client_by IS
  'auth.users.id of whoever marked it sent — a worker, a customer owner or an admin. NOT workers.id.';

COMMIT;

-- Verify (expects two rows):
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'nir_report'
--      and column_name in ('sent_to_client_at', 'sent_to_client_by');
