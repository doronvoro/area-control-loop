-- The levels at which a forecast day counts as rain or wind (Spec §4.4).
--
-- WHY A THIRD THRESHOLD TABLE
-- The module now has three independent threshold sets, and they are independent
-- because they answer different questions:
--
--   parameter_rules            — alert bands. A measured value against a cascade
--                                of upper bounds. Drives urgency and the NIR pills.
--   plot_category_thresholds   — the four status cards. A two-sided box across
--                                two parameters at once, which a cascade cannot express.
--   weather_alert_thresholds   — this table. A FORECAST value against one level:
--                                "is tomorrow wetter/windier than this".
--
-- These two numbers were hardcoded in lib/olive/logic.ts, and duplicated by hand
-- into the weather screen's caption. They decide which days appear as
-- "משפיע על דחיפות המסיק" and therefore which plots read "שקול הקדמת מסיק —
-- גשם צפוי" instead of "מתוכנן למסיק בקרוב". Tuning them belonged with the
-- other thresholds in the settings dialog, not in a client bundle.
--
-- The seed is the values they were hardcoded to, so nothing changes until
-- someone edits the row.
--
-- Global, like every other threshold table here: one row, no customer_id, read
-- by every tenant. Weather itself is regional (weather_days has no customer_id
-- either), so a per-customer level would have nothing to vary against.

CREATE TABLE IF NOT EXISTS weather_alert_thresholds (
  -- Single row. The CHECK is what makes it a singleton, so an upsert can always
  -- target ON CONFLICT (id) without first reading what is there.
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

  -- A day counts as rain when rain_mm is STRICTLY above this. The strictness is
  -- the tuned behaviour: exactly 5 mm does not flag.
  rain_alert_mm NUMERIC NOT NULL CHECK (rain_alert_mm >= 0),

  -- Same rule for wind_kmh. Not capped at 100: unlike every other threshold in
  -- this module these are not percentages, and a 120 km/h gust is a real value.
  wind_alert_kmh NUMERIC NOT NULL CHECK (wind_alert_kmh >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE weather_alert_thresholds IS
  'Forecast alert levels for computeUpcomingWeather(). Distinct from parameter_rules and plot_category_thresholds, which read measurements rather than a forecast.';

-- -----------------------------------------------------------------------------
-- Seed: the values these flags shipped with
-- -----------------------------------------------------------------------------
-- Mirrored in DEFAULT_WEATHER_THRESHOLDS (lib/olive/logic.ts), which is the
-- fallback when this row is missing. Change both together.

INSERT INTO weather_alert_thresholds (id, rain_alert_mm, wind_alert_kmh)
VALUES ('default', 5, 25)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS — mirrors plot_category_thresholds: every authenticated user reads,
-- admins and customer owners manage.
-- -----------------------------------------------------------------------------

ALTER TABLE weather_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read weather_alert_thresholds" ON weather_alert_thresholds;
CREATE POLICY "Anyone can read weather_alert_thresholds"
  ON weather_alert_thresholds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage weather_alert_thresholds" ON weather_alert_thresholds;
CREATE POLICY "Allow admin or owner manage weather_alert_thresholds"
  ON weather_alert_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );
