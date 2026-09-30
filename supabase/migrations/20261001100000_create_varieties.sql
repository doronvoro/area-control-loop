-- Varieties (זנים) — every variety gets an id.
--
-- Until now a variety was free text: areas.variety (20260308000000) and
-- variety_windows.variety (20260908110000), typed into a plain input and
-- imported verbatim. The גשור backup shows where that leads — "ארבקינה",
-- "ארבקינה בוגר" and "ארבקינה צעיר" are one variety spelled three ways, and a
-- trailing space makes a fourth. Nothing could list the varieties, and every
-- screen that grouped by variety split them.
--
-- THE SHAPE IS THE GROWERS ONE, ON PURPOSE
-- Growers had the same problem and 20260922100000 / 20260923080000 /
-- 20260923120000 solved it: a table, a link column kept in step by a trigger,
-- and an alias table the trigger reads. Reusing it here means:
--   * areas.variety STAYS as the display value. Some ninety call sites — the
--     olive screens, the reports, the generic area forms, the map — read it, and
--     none of them has to change.
--   * areas.variety_id is the source of truth, and the trigger maintains it on
--     every write path (importer, seed, plot drawers, area forms) including
--     ones added later.
--   * An alias is data, not code: folding "ארבקינה צעיר" into "ארבקינה" is a
--     row in variety_aliases, and the trigger rewrites the text to the
--     canonical name so the absorbed spelling never shows on a screen.
--
-- WHY GLOBAL AND NOT PER TENANT
-- Unlike a grower, a variety is an agronomic fact: ארבקינה is the same tree
-- for every customer. variety_windows is already global for the same reason.
--
-- WHY SCOPED BY CROP
-- `areas` is shared by every crop this app manages, not just olives. The same
-- word may name varieties of two different crops, so the key is
-- (crop_id, name). crop_id is nullable because areas.crop_id is; NULLS NOT
-- DISTINCT keeps "no crop" a single scope rather than letting duplicates in.
--
-- AGE IS NOT A VARIETY
-- "צעיר"/"בוגר" describe the planting's age, which areas.planting_time already
-- carries. They are folded into the base variety via aliases, seeded below.

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS varieties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- CASCADE: a variety means nothing without its crop. The areas pointing at
  -- it fall back to NULL through areas.variety_id's own SET NULL.
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT varieties_crop_name_unique UNIQUE NULLS NOT DISTINCT (crop_id, name)
);

COMMENT ON TABLE varieties IS
  'זנים — one row per variety of a crop. Referenced by areas.variety_id and variety_windows.variety_id. See 20261001100000.';

CREATE TABLE IF NOT EXISTS variety_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variety_id UUID NOT NULL REFERENCES varieties(id) ON DELETE CASCADE,
  -- Derived from varieties.crop_id by the validate trigger, never supplied by
  -- a caller — here only so the UNIQUE below can be per crop.
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT variety_aliases_crop_alias_unique UNIQUE NULLS NOT DISTINCT (crop_id, alias)
);

COMMENT ON TABLE variety_aliases IS
  'Other spellings of a variety, e.g. "ארבקינה צעיר" -> ארבקינה. Read by resolve_variety(). See 20261001100000.';

CREATE INDEX IF NOT EXISTS idx_variety_aliases_variety_id ON variety_aliases(variety_id);

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS variety_id UUID REFERENCES varieties(id) ON DELETE SET NULL;
ALTER TABLE variety_windows
  ADD COLUMN IF NOT EXISTS variety_id UUID REFERENCES varieties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_areas_variety_id ON areas(variety_id);

COMMENT ON COLUMN areas.variety_id IS
  'The variety. Kept in step with areas.variety by trg_areas_resolve_variety; areas.variety is the display name.';

-- -----------------------------------------------------------------------------
-- 2. Normalisation
-- -----------------------------------------------------------------------------
-- NFC matters: the geresh in לצ'ינו arrives as U+05F3 from some keyboards and
-- as an apostrophe with a combining sequence from others, and without NFC the
-- two spellings would be two varieties. Same reasoning as yieldKey() in
-- lib/olive/import-yield.ts. Inner runs of whitespace collapse to one space.
CREATE OR REPLACE FUNCTION variety_normalize(p_name TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(regexp_replace(btrim(normalize(COALESCE(p_name, ''), NFC)), '\s+', ' ', 'g'), '');
$$ LANGUAGE sql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- 3. Alias guards
-- -----------------------------------------------------------------------------
-- An alias may never also be a variety name of the same crop, or the exact-name
-- lookup would shadow it and the fold would quietly come undone. One function
-- for derivation and check together — see the ordering note in 20260923120000.
CREATE OR REPLACE FUNCTION variety_aliases_validate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alias := variety_normalize(NEW.alias);
  IF NEW.alias IS NULL THEN
    RAISE EXCEPTION 'variety_aliases.alias must not be blank';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM varieties WHERE id = NEW.variety_id) THEN
    RAISE EXCEPTION 'variety_aliases.variety_id % does not exist', NEW.variety_id;
  END IF;
  SELECT crop_id INTO NEW.crop_id FROM varieties WHERE id = NEW.variety_id;

  IF EXISTS (
    SELECT 1 FROM varieties
    WHERE crop_id IS NOT DISTINCT FROM NEW.crop_id AND name = NEW.alias
  ) THEN
    RAISE EXCEPTION
      'alias "%" is already a variety name for this crop — merge that variety instead', NEW.alias;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_variety_aliases_validate ON variety_aliases;
CREATE TRIGGER trg_variety_aliases_validate
  BEFORE INSERT OR UPDATE OF variety_id, alias, crop_id
  ON variety_aliases
  FOR EACH ROW
  EXECUTE FUNCTION variety_aliases_validate();

CREATE OR REPLACE FUNCTION varieties_validate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := variety_normalize(NEW.name);
  IF NEW.name IS NULL THEN
    RAISE EXCEPTION 'varieties.name must not be blank';
  END IF;
  IF EXISTS (
    SELECT 1 FROM variety_aliases
    WHERE crop_id IS NOT DISTINCT FROM NEW.crop_id AND alias = NEW.name AND variety_id <> NEW.id
  ) THEN
    RAISE EXCEPTION
      'variety name "%" is already an alias of another variety for this crop', NEW.name;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_varieties_validate ON varieties;
CREATE TRIGGER trg_varieties_validate
  BEFORE INSERT OR UPDATE OF name, crop_id
  ON varieties
  FOR EACH ROW
  EXECUTE FUNCTION varieties_validate();

-- -----------------------------------------------------------------------------
-- 4. The resolver
-- -----------------------------------------------------------------------------
-- Exact name, then alias, then create. The alias arm sits between the other
-- two for the reason given in 20260923120000: ahead of the exact match it would
-- shadow a real variety, behind the INSERT it would never run.
--
-- SECURITY DEFINER because it may INSERT a varieties row on behalf of a caller
-- whose rights were established against the AREA — writing varieties directly
-- is admin-only (RLS below), but typing a new variety on your own plot is not.
CREATE OR REPLACE FUNCTION resolve_variety(
  p_crop_id UUID,
  p_name TEXT,
  OUT variety_id UUID,
  OUT variety_name TEXT
) AS $$
DECLARE
  v_name TEXT := variety_normalize(p_name);
BEGIN
  IF v_name IS NULL THEN
    RETURN;
  END IF;

  SELECT v.id, v.name INTO variety_id, variety_name
  FROM varieties v
  WHERE v.crop_id IS NOT DISTINCT FROM p_crop_id AND v.name = v_name;
  IF variety_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT v.id, v.name INTO variety_id, variety_name
  FROM variety_aliases a
  JOIN varieties v ON v.id = a.variety_id
  WHERE a.crop_id IS NOT DISTINCT FROM p_crop_id AND a.alias = v_name;
  IF variety_id IS NOT NULL THEN
    RETURN;
  END IF;

  -- ON CONFLICT covers two rows of one import racing on a new name.
  INSERT INTO varieties (crop_id, name)
  VALUES (p_crop_id, v_name)
  ON CONFLICT ON CONSTRAINT varieties_crop_name_unique DO NOTHING
  RETURNING id, name INTO variety_id, variety_name;

  IF variety_id IS NULL THEN
    SELECT v.id, v.name INTO variety_id, variety_name
    FROM varieties v
    WHERE v.crop_id IS NOT DISTINCT FROM p_crop_id AND v.name = v_name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION resolve_variety IS
  'Variety id and canonical name for a typed name: exact match, then alias, then a new row. See 20261001100000.';

-- -----------------------------------------------------------------------------
-- 5. Keep areas.variety_id in step
-- -----------------------------------------------------------------------------
-- An explicitly set or CHANGED variety_id wins and the text follows it — the
-- path a future variety picker takes. Otherwise the text drives, which is what
-- the importer, the seed and every existing form send.
CREATE OR REPLACE FUNCTION areas_resolve_variety()
RETURNS TRIGGER AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.variety_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.variety_id IS DISTINCT FROM OLD.variety_id) THEN
    SELECT name INTO NEW.variety FROM varieties WHERE id = NEW.variety_id;
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM resolve_variety(NEW.crop_id, NEW.variety);
  NEW.variety_id := r.variety_id;
  NEW.variety := r.variety_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_areas_resolve_variety ON areas;
CREATE TRIGGER trg_areas_resolve_variety
  BEFORE INSERT OR UPDATE OF variety, variety_id, crop_id
  ON areas
  FOR EACH ROW
  EXECUTE FUNCTION areas_resolve_variety();

-- variety_windows has no crop column. Harvest windows exist only for the olive
-- screens, so they resolve against the olive crop (OLIVE_CROP_NAME in
-- lib/olive/constants.ts). If that crop does not exist yet the lookup yields
-- NULL, which resolves against the "no crop" scope — the backfill below and
-- any later write re-resolve it once the crop is there.
CREATE OR REPLACE FUNCTION olive_crop_id()
RETURNS UUID AS $$
  SELECT id FROM crops WHERE name = 'זית' ORDER BY id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION variety_windows_resolve_variety()
RETURNS TRIGGER AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.variety_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.variety_id IS DISTINCT FROM OLD.variety_id) THEN
    SELECT name INTO NEW.variety FROM varieties WHERE id = NEW.variety_id;
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM resolve_variety(olive_crop_id(), NEW.variety);
  -- variety is NOT NULL on this table; a blank one stays as typed and the
  -- link stays empty, rather than the insert failing.
  NEW.variety_id := r.variety_id;
  NEW.variety := COALESCE(r.variety_name, NEW.variety);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_variety_windows_resolve_variety ON variety_windows;
CREATE TRIGGER trg_variety_windows_resolve_variety
  BEFORE INSERT OR UPDATE OF variety, variety_id
  ON variety_windows
  FOR EACH ROW
  EXECUTE FUNCTION variety_windows_resolve_variety();

-- -----------------------------------------------------------------------------
-- 6. Olive age aliases
-- -----------------------------------------------------------------------------
-- A function, not a bare INSERT, because the olive crop is created by the seed
-- scripts, not by a migration — on a fresh `db reset` it does not exist yet
-- when this file runs. supabase/seed/olive_demo_seed.sql calls it again once
-- the crop is there. Idempotent either way.
CREATE OR REPLACE FUNCTION seed_olive_variety_aliases()
RETURNS VOID AS $$
DECLARE
  v_crop UUID := olive_crop_id();
  v_pair RECORD;
  v_variety UUID;
BEGIN
  IF v_crop IS NULL THEN
    RETURN;
  END IF;

  FOR v_pair IN
    SELECT * FROM (VALUES
      ('ארבקינה צעיר', 'ארבקינה'),
      ('ארבקינה בוגר', 'ארבקינה'),
      ('קורנייקי צעיר', 'קורנייקי'),
      ('קורנייקי בוגר', 'קורנייקי'),
      ('ארבוסנה צעיר', 'ארבוסנה'),
      ('ארבוסנה בוגר', 'ארבוסנה')
    ) AS t(alias, base)
  LOOP
    -- A variety that was already created under the alias spelling (before
    -- this migration existed) is folded first: repoint its areas and windows,
    -- then delete it, so the alias does not collide with a live name.
    INSERT INTO varieties (crop_id, name) VALUES (v_crop, v_pair.base)
    ON CONFLICT ON CONSTRAINT varieties_crop_name_unique DO NOTHING;
    SELECT id INTO v_variety FROM varieties WHERE crop_id = v_crop AND name = v_pair.base;

    UPDATE areas SET variety_id = v_variety
    WHERE variety_id IN (SELECT id FROM varieties WHERE crop_id = v_crop AND name = v_pair.alias);
    UPDATE variety_windows SET variety_id = v_variety
    WHERE variety_id IN (SELECT id FROM varieties WHERE crop_id = v_crop AND name = v_pair.alias);
    DELETE FROM varieties WHERE crop_id = v_crop AND name = v_pair.alias;

    INSERT INTO variety_aliases (variety_id, alias) VALUES (v_variety, v_pair.alias)
    ON CONFLICT ON CONSTRAINT variety_aliases_crop_alias_unique DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT seed_olive_variety_aliases();

-- -----------------------------------------------------------------------------
-- 7. Backfill
-- -----------------------------------------------------------------------------
-- A no-op write fires the triggers, which create any missing variety, apply
-- the aliases and link the row. Rows with no variety are left alone.
UPDATE areas SET variety = variety
WHERE variety IS NOT NULL AND variety_id IS NULL;

UPDATE variety_windows SET variety = variety
WHERE variety_id IS NULL;

-- -----------------------------------------------------------------------------
-- 8. RLS — same shape as variety_windows
-- -----------------------------------------------------------------------------
-- Everyone signed in reads; admins and customer owners manage the list. Plot
-- writers never need write access here: resolve_variety() is SECURITY DEFINER.
ALTER TABLE varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE variety_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read varieties" ON varieties;
CREATE POLICY "Anyone can read varieties"
  ON varieties FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage varieties" ON varieties;
CREATE POLICY "Allow admin or owner manage varieties"
  ON varieties FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

DROP POLICY IF EXISTS "Anyone can read variety_aliases" ON variety_aliases;
CREATE POLICY "Anyone can read variety_aliases"
  ON variety_aliases FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin or owner manage variety_aliases" ON variety_aliases;
CREATE POLICY "Allow admin or owner manage variety_aliases"
  ON variety_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );
