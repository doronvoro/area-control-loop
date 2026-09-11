-- NIR measurements and harvest passes as report types.
--
-- report_areas is already a report header with a pluggable type: report_area_types
-- is a lookup, and monitoring_area_report / actions_area_report are its per-type
-- detail tables. Olive adds two more types on the same pattern, which is why
-- neither needs its own header table, numbering, or worker attribution.
--
--   nir     — one ripeness measurement (בדיקת NIR)
--   harvest — one harvest pass (מסיק), several per plot per season
--
-- Both detail tables are keyed 1:1 on report_areas.id, unlike the monitoring and
-- action detail tables which hold many rows per report (one per finding). A NIR
-- measurement and a harvest pass are each a single event with a single set of
-- values, so 1:1 is correct here.
--
-- KNOWN CONSEQUENCE, deliberately accepted: report_areas.report_number is a
-- single global identity across all report types (added in 20260908000000), so
-- NIR rows consume numbers from the same sequence as pest monitoring reports and
-- appear in the /reports list. The reports list therefore needs a type filter.
-- If that inflation proves unacceptable in use, NIR is the type to split back
-- out into a standalone time-series table; harvest should stay a report either
-- way, since it is genuinely an event with a date and a responsible worker.

INSERT INTO report_area_types (name, display_name, description) VALUES
  ('nir',     'בדיקת NIR', 'NIR ripeness measurement'),
  ('harvest', 'מסיק',      'Olive harvest pass')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- NIR detail
-- -----------------------------------------------------------------------------
-- `dry` (שמן בחומר יבש) is derived, never entered: oil / (100 - water) * 100.
-- Storing it generated keeps the prototype's formula in one place and makes it
-- queryable. The water < 100 guard avoids a division by zero on bad input.

CREATE TABLE IF NOT EXISTS nir_report (
  report_area_id UUID PRIMARY KEY REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID REFERENCES sub_areas(id) ON DELETE SET NULL,
  oil NUMERIC(5, 2) CHECK (oil IS NULL OR oil BETWEEN 0 AND 100),
  water NUMERIC(5, 2) CHECK (water IS NULL OR water BETWEEN 0 AND 100),
  dry NUMERIC(6, 2) GENERATED ALWAYS AS (
    CASE
      WHEN oil IS NOT NULL AND water IS NOT NULL AND water < 100
      THEN round(oil / (100 - water) * 100, 2)
    END
  ) STORED,
  green NUMERIC(5, 2) CHECK (green IS NULL OR green BETWEEN 0 AND 100),
  acid NUMERIC(5, 2),
  maturity NUMERIC(5, 2),
  irrig_amount NUMERIC(10, 2),
  direction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN nir_report.sub_area_id IS 'The takt sampled, when the sample is not plot-wide.';
COMMENT ON COLUMN nir_report.dry IS 'Derived: oil / (100 - water) * 100. Never entered by hand.';
COMMENT ON COLUMN nir_report.green IS 'Informational only — spec §4.2 defines no threshold for colour.';

CREATE INDEX IF NOT EXISTS idx_nir_report_sub_area_id ON nir_report(sub_area_id);

-- -----------------------------------------------------------------------------
-- Harvest detail
-- -----------------------------------------------------------------------------
-- One row per pass. is_final marks the pass that completes the plot, which is
-- what moves it out of the active list — replacing the prototype's single
-- boolean harvestStatus flag.

CREATE TABLE IF NOT EXISTS harvest_report (
  report_area_id UUID PRIMARY KEY REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID REFERENCES sub_areas(id) ON DELETE SET NULL,
  pass_number INTEGER NOT NULL DEFAULT 1 CHECK (pass_number > 0),
  harvester_type TEXT,
  operator TEXT,
  area_done_dunam NUMERIC(10, 2),
  fruit_kg NUMERIC(12, 2),
  oil_kg NUMERIC(12, 2),
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN harvest_report.is_final IS 'Marks the pass that completes the plot for this season.';

CREATE INDEX IF NOT EXISTS idx_harvest_report_sub_area_id ON harvest_report(sub_area_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- Both tables reach tenancy through their parent report_areas row.
-- can_access_report_area is SECURITY DEFINER and already folds in the admin
-- bypass. It reaches upward only (detail -> report_areas -> areas ->
-- customer_areas -> customers), so it cannot recreate the 42P17 cycle fixed in
-- 20260907000000.

ALTER TABLE nir_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage nir reports for their areas" ON nir_report;
CREATE POLICY "Users can manage nir reports for their areas"
  ON nir_report FOR ALL
  USING (can_access_report_area(report_area_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage harvest reports for their areas" ON harvest_report;
CREATE POLICY "Users can manage harvest reports for their areas"
  ON harvest_report FOR ALL
  USING (can_access_report_area(report_area_id, auth.uid()));
