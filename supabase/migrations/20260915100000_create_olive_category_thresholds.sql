-- Thresholds for the four dashboard status cards (בבדיקות / תקינות / חריגות / מוכן למסיק).
--
-- WHY THIS IS A SECOND THRESHOLD SET AND NOT parameter_rules
-- The prototype carries TWO independent threshold blocks, and the original port
-- used the first for both jobs:
--
--   `thresholds`         — oilLow/oilHigh/waterLow/waterOpt/waterHigh/dryLow/dryHigh.
--                          Alert bands. Ported to parameter_rules in
--                          20260908100000_create_olive_parameters.sql, and read
--                          by computePlotStatus() for urgency.
--   `categoryThresholds` — readyOilMin/Max, readyWaterMin/Max, anomalyWaterLow/High,
--                          normalOilMax, normalWaterMax. Status-card bands only.
--                          Never ported — this table is it.
--
-- Collapsing the two made תקינות unreachable. The card wanted "sampled, oil at
-- or below normal_oil_max" (≤ 17) but got "oil in the PLAN band" (17..20), so
-- every low-oil sample fell through to בבדיקות next to the plots nobody had
-- sampled at all. On the גשור 2026 backup the app read 43/0/7/0 where the
-- prototype read 37/6/7/0 — the six early-season plots at oil 9.2..11.8.
--
-- A rules cascade cannot express these bands anyway: "ready" is a two-sided box
-- across TWO parameters at once (oil 18..24 AND water 51..54), where
-- parameter_rules evaluates one parameter against one upper bound at a time.
--
-- Global, like parameters / parameter_rules / variety_windows: one row, no
-- customer_id, read by every tenant. A backup import overwrites it, which is
-- the same reach variety_windows and weather_days already have.

CREATE TABLE IF NOT EXISTS plot_category_thresholds (
  -- Single row. The CHECK is what makes it a singleton, so an upsert can always
  -- target ON CONFLICT (id) without first reading what is there.
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

  -- מוכן למסיק: oil AND water both inside their box.
  ready_oil_min NUMERIC NOT NULL,
  ready_oil_max NUMERIC NOT NULL,
  ready_water_min NUMERIC NOT NULL,
  ready_water_max NUMERIC NOT NULL,

  -- חריגה: water outside this band.
  anomaly_water_low NUMERIC NOT NULL,
  anomaly_water_high NUMERIC NOT NULL,

  -- תקינה: sampled, still building oil, water not out of range.
  normal_oil_max NUMERIC NOT NULL,
  normal_water_max NUMERIC NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ready_oil_band CHECK (ready_oil_min <= ready_oil_max),
  CONSTRAINT ready_water_band CHECK (ready_water_min <= ready_water_max),
  CONSTRAINT anomaly_water_band CHECK (anomaly_water_low <= anomaly_water_high)
);

COMMENT ON TABLE plot_category_thresholds IS
  'Status-card bands for classifyPlotCategory(). Distinct from parameter_rules, which drives alert urgency.';

-- -----------------------------------------------------------------------------
-- Seed: the prototype's own defaults, as they appear in its backup export
-- -----------------------------------------------------------------------------
-- Mirrored in DEFAULT_CATEGORY_THRESHOLDS (lib/olive/constants.ts), which is
-- the fallback when this row is missing. Change both together.

INSERT INTO plot_category_thresholds (
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

-- -----------------------------------------------------------------------------
-- RLS — mirrors parameter_rules: every authenticated user reads, admins and
-- customer owners manage.
-- -----------------------------------------------------------------------------

ALTER TABLE plot_category_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read plot_category_thresholds" ON plot_category_thresholds;
CREATE POLICY "Anyone can read plot_category_thresholds"
  ON plot_category_thresholds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage plot_category_thresholds" ON plot_category_thresholds;
CREATE POLICY "Allow admin or owner manage plot_category_thresholds"
  ON plot_category_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );
