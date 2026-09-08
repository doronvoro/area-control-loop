-- Olive-harvest domain tables that hang off the existing areas tree.
--
-- An olive plot (חלקה) IS an `areas` row — that table already carries name,
-- variety, planting_time, size, crop_id and geometry, so only the nine
-- olive-specific fields need a home. olive_plot_details is 1:1 with areas and
-- holds exactly those. Takts (טאקטים) are `sub_areas` rows. Multi-tenancy
-- arrives for free through customer_areas.
--
-- Lookup values are stored as English codes and displayed in Hebrew from
-- types/database.ts, matching how worker_types already works.
--
-- RLS NOTE — a deliberate deviation from observed practice.
-- Every shipped policy in this repo inlines a multi-table EXISTS chain, while
-- can_access_area() from 20260208000000_consolidate_rls_helpers.sql has sat
-- unused since it was added. These tables adopt it, for three reasons:
--   1. It is SECURITY DEFINER, so it does not re-enter RLS and is structurally
--      immune to the 42P17 recursion that broke /api/map/areas in
--      20260907000000. That bug came from a policy reaching *down* into a
--      child table; a SECURITY DEFINER helper cannot close such a loop.
--   2. 20260208000000's own trailing comment documents this exact usage.
--   3. One line instead of twelve, so the tenancy rule is auditable at a glance.
-- The invariant still holds either way: authorization flows one direction only,
-- child -> customer_areas -> customers. No policy here reaches into a child.

-- -----------------------------------------------------------------------------
-- 1. Plot details (1:1 with areas)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS olive_plot_details (
  area_id UUID PRIMARY KEY REFERENCES areas(id) ON DELETE CASCADE,
  grower_name TEXT,
  region TEXT,
  plot_type TEXT CHECK (plot_type IS NULL OR plot_type IN ('owner', 'partner', 'occasional')),
  harvester TEXT CHECK (harvester IS NULL OR harvester IN ('1190x', '9090x', 'other')),
  water_type TEXT CHECK (water_type IS NULL OR water_type IN ('fresh', 'reclaimed', 'kinneret')),
  takt_count INTEGER CHECK (takt_count IS NULL OR takt_count BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE olive_plot_details IS
  'Olive-specific attributes for an area. The plot itself lives in areas.';
COMMENT ON COLUMN olive_plot_details.region IS
  'גוש — a grouping label, deliberately a field rather than a parent area (see design §4.2).';

-- -----------------------------------------------------------------------------
-- 2. Seasons (מחזור מסיק)
-- -----------------------------------------------------------------------------
-- Replaces the prototype's two loose globals, harvestYear and harvestYearType.
-- year_type is the olive's natural alternate-bearing cycle: ON is a heavy year,
-- OFF a light one.

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  year_type TEXT CHECK (year_type IS NULL OR year_type IN ('ON', 'OFF')),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT seasons_dates_ordered CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active) WHERE is_active;

-- -----------------------------------------------------------------------------
-- 3. Yield estimates (area x season)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS yield_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  kg_per_dunam NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT yield_estimates_area_season_unique UNIQUE (area_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_yield_estimates_area_id ON yield_estimates(area_id);
CREATE INDEX IF NOT EXISTS idx_yield_estimates_season_id ON yield_estimates(season_id);

-- -----------------------------------------------------------------------------
-- 4. Variety harvest windows (חלונות קטיף)
-- -----------------------------------------------------------------------------
-- Accumulated agronomic knowledge: when each variety is normally picked.
-- Dates are day/month only because the window recurs every year. Stored as
-- text in DD/MM form, exactly as the prototype does, so a window may wrap the
-- turn of the year.

CREATE TABLE IF NOT EXISTS variety_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variety TEXT NOT NULL,
  start_dm TEXT NOT NULL CHECK (start_dm ~ '^\d{1,2}/\d{1,2}$'),
  end_dm TEXT NOT NULL CHECK (end_dm ~ '^\d{1,2}/\d{1,2}$'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variety_windows_variety ON variety_windows(variety);

-- -----------------------------------------------------------------------------
-- 5. Weather days
-- -----------------------------------------------------------------------------
-- Two rows may exist per date: the fetched forecast (is_manual = false) and a
-- manual override (is_manual = true). The manual row wins in application logic,
-- which is why the unique constraint spans both columns rather than date alone.

CREATE TABLE IF NOT EXISTS weather_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  temp_min NUMERIC(5, 2),
  temp_max NUMERIC(5, 2),
  rain_mm NUMERIC(6, 2),
  wind_kmh NUMERIC(6, 2),
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT weather_days_date_source_unique UNIQUE (entry_date, is_manual)
);

CREATE INDEX IF NOT EXISTS idx_weather_days_entry_date ON weather_days(entry_date);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE olive_plot_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE variety_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_days ENABLE ROW LEVEL SECURITY;

-- Area-scoped. can_access_area already folds in the admin bypass, so no
-- separate is_admin_user clause is needed. FOR ALL with only USING means
-- Postgres reuses USING as the INSERT/UPDATE check, matching house style.
DROP POLICY IF EXISTS "Users can manage olive plot details for their areas" ON olive_plot_details;
CREATE POLICY "Users can manage olive plot details for their areas"
  ON olive_plot_details FOR ALL
  USING (can_access_area(area_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage yield estimates for their areas" ON yield_estimates;
CREATE POLICY "Users can manage yield estimates for their areas"
  ON yield_estimates FOR ALL
  USING (can_access_area(area_id, auth.uid()));

-- Shared reference data: everyone reads, admins and customer owners manage.
DROP POLICY IF EXISTS "Anyone can read seasons" ON seasons;
CREATE POLICY "Anyone can read seasons"
  ON seasons FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage seasons" ON seasons;
CREATE POLICY "Allow admin or owner manage seasons"
  ON seasons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

DROP POLICY IF EXISTS "Anyone can read variety_windows" ON variety_windows;
CREATE POLICY "Anyone can read variety_windows"
  ON variety_windows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage variety_windows" ON variety_windows;
CREATE POLICY "Allow admin or owner manage variety_windows"
  ON variety_windows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

-- Weather is regional, not per-customer, and the manual-override form is used
-- by ops staff in the field, so any authenticated worker may write it.
DROP POLICY IF EXISTS "Anyone can read weather_days" ON weather_days;
CREATE POLICY "Anyone can read weather_days"
  ON weather_days FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage weather_days" ON weather_days;
CREATE POLICY "Authenticated users can manage weather_days"
  ON weather_days FOR ALL
  TO authenticated
  USING (true);
