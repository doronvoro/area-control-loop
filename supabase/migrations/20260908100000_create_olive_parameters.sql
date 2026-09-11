-- Generic measurement parameters and their threshold rules.
--
-- These two tables move decision thresholds out of application code and into
-- data. The engine knows a measurement has a value, that ranges map to a
-- status, and that a status carries a severity and a Hebrew message. It does
-- not know what "oil" means. Adding a crop later means adding rows, not code.
--
-- Boundary encoding matters and is easy to get wrong. The olive prototype's
-- nirStatus() uses `<` for the lower band but `<=` for the upper:
--   oil 17.0 is "תוכנן למסיק", not "לא מוכן"
--   oil 20.0 is "תוכנן למסיק", not "מסיק מיידי"
-- A plain min/max pair cannot express that, so each rule carries an
-- upper_bound plus an upper_inclusive flag, and rules are evaluated in
-- sort_order with first match winning. A NULL upper_bound is the catch-all
-- and must be the last rule for its parameter.
--
-- Parameters with no rules (green, acid, maturity, irrig) are informational
-- only — spec §4.2 is explicit that colour and acidity have no threshold
-- because too many variables affect them for a defensible cutoff.

CREATE TABLE IF NOT EXISTS parameters (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE parameters IS 'Measurable quantities (oil %, water %, ...). Crop-agnostic.';

CREATE TABLE IF NOT EXISTS parameter_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parameter_code TEXT NOT NULL REFERENCES parameters(code) ON DELETE CASCADE,
  upper_bound NUMERIC,
  upper_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL CHECK (status IN ('idle', 'ok', 'plan', 'urgent')),
  severity INTEGER NOT NULL DEFAULT 0 CHECK (severity BETWEEN 0 AND 3),
  message TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN parameter_rules.upper_bound IS
  'Upper limit of this band. NULL means unbounded — must be the last rule for the parameter.';
COMMENT ON COLUMN parameter_rules.upper_inclusive IS
  'TRUE evaluates value <= upper_bound, FALSE evaluates value < upper_bound.';

CREATE INDEX IF NOT EXISTS idx_parameter_rules_parameter_code
  ON parameter_rules(parameter_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parameter_rules_order
  ON parameter_rules(parameter_code, sort_order);

-- -----------------------------------------------------------------------------
-- Seed: olive parameters
-- -----------------------------------------------------------------------------
-- parameters.code is the primary key, so ON CONFLICT (code) is safe here.
-- (Unlike findings/crops/materials, which have no unique constraint on name.)

INSERT INTO parameters (code, label, unit, sort_order) VALUES
  ('oil',      'אחוז שמן',             '%',            1),
  ('water',    'אחוז מים',             '%',            2),
  ('dry',      'אחוז שמן בחומר יבש',   '%',            3),
  ('green',    'אחוז צבע ירוק',        '%',            4),
  ('acid',     'חומציות',              '%',            5),
  ('maturity', 'אינדקס הבשלה',         NULL,           6),
  ('irrig',    'השקיה בפועל',          'קוב/דונם/יום', 7)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: threshold rules, ported verbatim from the prototype's nirStatus()
-- -----------------------------------------------------------------------------

INSERT INTO parameter_rules (parameter_code, upper_bound, upper_inclusive, status, severity, message, sort_order) VALUES
  -- oil:   < 17 idle | 17..20 plan | > 20 urgent
  ('oil',    17,   FALSE, 'idle',   0, 'לא מוכן למסיק',      1),
  ('oil',    20,   TRUE,  'plan',   2, 'תוכנן למסיק',        2),
  ('oil',    NULL, TRUE,  'urgent', 3, 'מסיק מיידי',          3),

  -- water: < 50 urgent | 50..54 ok | 54..60 plan | > 60 urgent
  ('water',  50,   FALSE, 'urgent', 3, 'עקת מים',            1),
  ('water',  54,   TRUE,  'ok',     1, 'אופטימום',           2),
  ('water',  60,   TRUE,  'plan',   2, 'צמצום השקיה',        3),
  ('water',  NULL, TRUE,  'urgent', 3, 'סגירת מים מיידית',   4),

  -- dry:   < 40 idle | 40..45 plan | > 45 urgent
  ('dry',    40,   FALSE, 'idle',   0, '—',                   1),
  ('dry',    45,   TRUE,  'plan',   2, 'תשומת לב / החלטה',   2),
  ('dry',    NULL, TRUE,  'urgent', 3, 'מסיק',                3)
ON CONFLICT (parameter_code, sort_order) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- Global configuration, not customer-scoped: every authenticated user reads,
-- admins and customer owners manage. Mirrors the findings/crops policies added
-- in 20260321100000_allow_customer_owner_manage_sync_tables.sql.

ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read parameters" ON parameters;
CREATE POLICY "Anyone can read parameters"
  ON parameters FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage parameters" ON parameters;
CREATE POLICY "Allow admin or owner manage parameters"
  ON parameters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

DROP POLICY IF EXISTS "Anyone can read parameter_rules" ON parameter_rules;
CREATE POLICY "Anyone can read parameter_rules"
  ON parameter_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage parameter_rules" ON parameter_rules;
CREATE POLICY "Allow admin or owner manage parameter_rules"
  ON parameter_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );
