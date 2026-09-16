-- Olive rollout — WEATHER ALERT LEVELS. Creates one table, writes one row.
--
-- Mirrors supabase/migrations/20260915110000_create_olive_weather_thresholds.sql.
-- It is a separate file for the same reason every other step here is: the
-- ledger does not describe this database (docs/rollout/README.md), so schema
-- reaches production by being pasted, not pushed.
--
-- WHY IT IS NEEDED
-- "גשם מעל 5 מ״מ" and "רוח מעל 25 קמ״ש" were compiled into the client bundle —
-- twice, once in lib/olive/logic.ts and once in the weather screen's caption.
-- They decide which forecast days show up as משפיע על דחיפות המסיק, and so
-- which plots read "שקול הקדמת מסיק — גשם צפוי" rather than "מתוכנן למסיק
-- בקרוב". This makes them a row the client can tune from הגדרת ספי מסיק,
-- alongside the status-card bands that step 09 moved out of the bundle.
--
-- ORDERING — this one is safe either way
-- Merging deploys the code through Vercel before this runs.
-- getWeatherThresholds() treats 42P01 (undefined_table) as "no row" and
-- toWeatherThresholds() falls back to the same 5 / 25 seeded below, so the
-- dashboard, the forecast strip and every urgency headline keep working
-- unchanged in the window between the two. Until this runs, the מזג אוויר tab
-- shows the defaults and saving returns a 503 naming this file.
--
-- Re-runnable: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING, and the
-- policies are dropped before they are created. Running it twice is a no-op,
-- and running it after the levels have been tuned does NOT overwrite that row.

BEGIN;

CREATE TABLE IF NOT EXISTS public.weather_alert_thresholds (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

  -- Strictly above, both of them: exactly 5 mm does not flag. That strictness
  -- is tuned behaviour, not an accident of the comparison.
  rain_alert_mm NUMERIC NOT NULL CHECK (rain_alert_mm >= 0),

  -- Deliberately not capped at 100. Unlike every other threshold in this module
  -- these are not percentages — a 120 km/h gust is a real value.
  wind_alert_kmh NUMERIC NOT NULL CHECK (wind_alert_kmh >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.weather_alert_thresholds IS
  'Forecast alert levels for computeUpcomingWeather(). Distinct from parameter_rules and plot_category_thresholds, which read measurements rather than a forecast.';

INSERT INTO public.weather_alert_thresholds (id, rain_alert_mm, wind_alert_kmh)
VALUES ('default', 5, 25)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weather_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read weather_alert_thresholds"
  ON public.weather_alert_thresholds;
CREATE POLICY "Anyone can read weather_alert_thresholds"
  ON public.weather_alert_thresholds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage weather_alert_thresholds"
  ON public.weather_alert_thresholds;
CREATE POLICY "Allow admin or owner manage weather_alert_thresholds"
  ON public.weather_alert_thresholds FOR ALL
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
  SELECT count(*) INTO n FROM public.weather_alert_thresholds;
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 weather threshold row, found %', n;
  END IF;
  RAISE NOTICE 'weather_alert_thresholds present with 1 row';
END $$;

COMMIT;


-- Verify — one grid, the way 02-verify.sql does it:
--
-- select 'weather_alert_thresholds' as check, count(*)::text as got, '1' as want
--   from public.weather_alert_thresholds
-- union all
-- select 'rain_alert_mm', rain_alert_mm::text, '5' from public.weather_alert_thresholds
-- union all
-- select 'wind_alert_kmh', wind_alert_kmh::text, '25' from public.weather_alert_thresholds;
--
-- Then open /olive: the forecast strip should name these two numbers in its
-- "אין גשם מעל … או רוח מעל …" line, and the gear → מזג אוויר tab should save
-- without the 503 that names this file.
