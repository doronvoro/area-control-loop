-- Whether a NIR reading has been passed on to the client, and when.
--
-- The reading is recorded in the grove and then has to reach the grower. Nothing
-- tracked that last step, so "which readings still owe the grower an update?"
-- was a question only WhatsApp could answer.
--
-- ONE NULLABLE TIMESTAMP, NOT A BOOLEAN PAIR
-- Sent is `sent_to_client_at IS NOT NULL`. A separate boolean would admit two
-- states nobody can explain: flagged with no date, and dated with the flag off.
--
-- AN INSTANT, NOT A CALENDAR DAY
-- report_areas.report_date is a day a person CHOOSES; this is an EVENT. A
-- "שלח במייל" button is planned and will write this same column from an actual
-- send, which has a real instant. Storing a midnight day now would mean either
-- discarding that time later or running two conventions in one column. Readers
-- convert to the viewer's LOCAL day (lib/olive/logic.ts toDateString) rather
-- than slicing the ISO string: Israel is UTC+2/+3, so a 01:30 local send is
-- …T22:30:00Z the previous day and a slice would display yesterday.
--
-- sent_to_client_by REFERENCES auth.users, NOT workers
-- Three kinds of actor reach the NIR routes (requireWorkerAdminOrCustomer
-- admits all three) and only one has a workers row:
--
--   worker (inspector / action_worker)  -> workers row
--   customer owner                      -> customers row, NO workers row
--   platform admin                      -> possibly neither
--
-- ארץ גשור is a CUSTOMER (customers.customer_type = 'owner', added in
-- 20260922000000), so its owner has no workers row. A workers(id) FK would
-- store NULL for exactly the people most likely to be sending readings out.
-- report_areas.worker_id already has that hole — createNirReport falls back to
-- ctx.worker?.id, which is why the log's דוגם column can come up blank — and
-- this column deliberately does not inherit it. auth.users(id) is the only
-- identifier all three share, and customers.user_id / workers.user_id already
-- reference it, so the cross-schema FK is established practice here.
--
-- ON DELETE SET NULL, unlike customers' RESTRICT and workers' CASCADE: removing
-- a user should neither delete the reading nor be blocked by an audit field.
--
-- NO INDEX
-- The log filters client-side over one season's already-fetched rows, and the
-- dashboard counter is two head-only count queries. An index here would never be
-- consulted — idx_areas_area_type from 20260228000000 is exactly that shape and
-- no query has ever used it.
--
-- NO RLS CHANGE
-- nir_report's policy from 20260908120000 is
-- `FOR ALL USING (can_access_report_area(report_area_id, auth.uid()))`, which is
-- column-agnostic. Writes go through adminClient behind denyIfInaccessible.
--
-- WHEN THE SEND BUTTON LANDS, THIS STAYS
-- Real sending wants a LOG — retries, failures, bounces, more than one send per
-- reading — and that is a table, not more columns here. These two stay as the
-- denormalised "last sent", cheap to filter and sort on, written by that log
-- instead of by a person ticking a box. Do not add channel / recipient /
-- message-id columns to this table.

ALTER TABLE nir_report
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_client_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN nir_report.sent_to_client_at IS
  'The moment this reading was sent to the client. NULL = not sent. Recorded by hand today; the planned send-mail button will write the same column.';

COMMENT ON COLUMN nir_report.sent_to_client_by IS
  'auth.users.id of whoever marked it sent — a worker, a customer owner or an admin. NOT workers.id: see this migration header. NULL when not sent.';
