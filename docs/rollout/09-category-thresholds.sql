-- Olive rollout — STATUS-CARD THRESHOLDS. Creates one table, writes one row.
--
-- Mirrors supabase/migrations/20260915100000_create_olive_category_thresholds.sql.
-- It is a separate file for the same reason every other step here is: the
-- ledger does not describe this database (docs/rollout/README.md), so schema
-- reaches production by being pasted, not pushed.
--
-- WHY IT IS NEEDED
-- The dashboard's four cards were classifying against the alert bands in
-- parameter_rules, which made תקינה unreachable: the card wanted oil at or
-- below 17 and got "oil between 17 and 20". On the גשור 2026 data the live
-- site read 43 / 0 / 7 / 0 where the prototype reads 37 / 6 / 7 / 0, the six
-- early-season plots landing in בבדיקות next to the 37 nobody had sampled.
--
-- ORDERING — this one is safe either way
-- Merging deploys the code through Vercel before this runs, which is how the
-- module's first rollout went out of order. getCategoryThresholds() treats a
-- missing table as "no row" and falls back to the same numbers
-- seeded below, so the dashboard keeps working in the window between the two.
-- The cards read correctly from the deploy; this file only makes the values
-- editable in the database rather than fixed in the client bundle.
--
-- Re-runnable: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING, and the
-- policies are dropped before they are created. Running it twice is a no-op,
-- and running it after a row has been tuned does NOT overwrite that row.

BEGIN;

CREATE TABLE IF NOT EXISTS public.plot_category_thresholds (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

  ready_oil_min NUMERIC NOT NULL,
  ready_oil_max NUMERIC NOT NULL,
  ready_water_min NUMERIC NOT NULL,
  ready_water_max NUMERIC NOT NULL,

  anomaly_water_low NUMERIC NOT NULL,
  anomaly_water_high NUMERIC NOT NULL,

  normal_oil_max NUMERIC NOT NULL,
  normal_water_max NUMERIC NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ready_oil_band CHECK (ready_oil_min <= ready_oil_max),
  CONSTRAINT ready_water_band CHECK (ready_water_min <= ready_water_max),
  CONSTRAINT anomaly_water_band CHECK (anomaly_water_low <= anomaly_water_high)
);

COMMENT ON TABLE public.plot_category_thresholds IS
  'Status-card bands for classifyPlotCategory(). Distinct from parameter_rules, which drives alert urgency.';

INSERT INTO public.plot_category_thresholds (
  id,
  ready_oil_min, ready_oil_max, ready_water_min, ready_water_max,
  anomaly_water_low, anomaly_water_high,
  normal_oil_max, normal_water_max
) VALUES (
  'default',
  18, 24, 51, 54,
  50, 60,
  17, 60
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.plot_category_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read plot_category_thresholds"
  ON public.plot_category_thresholds;
CREATE POLICY "Anyone can read plot_category_thresholds"
  ON public.plot_category_thresholds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage plot_category_thresholds"
  ON public.plot_category_thresholds;
CREATE POLICY "Allow admin or owner manage plot_category_thresholds"
  ON public.plot_category_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.plot_category_thresholds;
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 threshold row, found %', n;
  END IF;
  RAISE NOTICE 'plot_category_thresholds present with 1 row';
END $$;

COMMIT;


-- Verify — one grid, the way 02-verify.sql does it:
--
-- select 'plot_category_thresholds' as check, count(*)::text as got, '1' as want
--   from public.plot_category_thresholds
-- union all
-- select 'normal_oil_max', normal_oil_max::text, '17' from public.plot_category_thresholds
-- union all
-- select 'ready_oil_min', ready_oil_min::text, '18' from public.plot_category_thresholds;
--
-- Then open /olive as the גשור tenant: with the 2026 import loaded the cards
-- should read 37 בבדיקות / 6 תקינות / 7 חריגות / 0 מוכן למסיק.
