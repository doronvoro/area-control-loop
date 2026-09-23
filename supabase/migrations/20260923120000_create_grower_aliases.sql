-- Grower aliases (שמות נוספים) — the other names one grower goes by in the file.
--
-- THE CASE THIS COMES FROM
-- The גשור backup names the same kibbutz three ways:
--   "קיבוץ גשור"            44 plots
--   "קיבוץ גשור דרום"         1 plot  (region "מנחת", plot name "דרום")
--   "קיבוץ גשור מנחת צפון"     1 plot  (plot name "צפון")
-- In both strays the suffix is the plot's own location, which the plot already
-- carries in olive_plot_details.region and areas.name, so the three are one
-- grower. The מגדלים screen counted them as three, each with its own empty
-- contact details, and the plots screen filtered on three different names.
--
-- WHY A TABLE AND NOT A ONE-OFF CLEAN-UP
-- Repointing the two plots by hand fixes the screen until the next import.
-- trg_olive_plot_details_resolve_grower (20260923080000) resolves a plot's
-- grower by exact name and CREATES one for any name it has not seen, and the
-- importer hands it plot.grower verbatim (import-backup.ts, `grower_name:
-- plot.grower || null`) — so the next backup recreates both strays silently,
-- which is the same class of regression 20260923080000 itself was written to
-- stop. For a merge to survive an import, the mapping from the absorbed name to
-- the surviving grower has to live where the trigger can read it.
--
-- WHY NOT NORMALISE IN THE IMPORTER INSTEAD
-- A canonical-name map in lib/olive/import-backup.ts would put one tenant's
-- names inside a generic importer, would need a code change for every new
-- variant, and would not cover the other way a duplicate is born — someone
-- typing the name into the plot drawer, which components/olive/GrowerPicker.tsx
-- already documents as how "קיבוץ גשור" and "קיבוץ גשור " became two rows. An
-- alias is data, per tenant, and both write paths already go through one
-- trigger.
--
-- ALIASES AND NAMES MAY NOT COLLIDE
-- The resolver below looks up the exact grower name first and the alias second,
-- so a grower NAMED "קיבוץ גשור דרום" would shadow an alias of that spelling and
-- the merge would quietly come undone on the next import. Rather than pick a
-- winner between them, the two guard triggers at the bottom of this file make
-- that state unreachable: an alias may not be an existing grower's name, and a
-- grower may not take a name that is already an alias. /api/growers checks both
-- before writing and answers 409 in Hebrew; the triggers raise only for a caller
-- that goes around the route.

CREATE TABLE IF NOT EXISTS grower_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- CASCADE: an alias has no meaning without the grower it points at, and a
  -- grower is only deletable once nothing points at it anyway.
  grower_id UUID NOT NULL REFERENCES growers(id) ON DELETE CASCADE,
  -- Denormalised from growers.customer_id, and never supplied by a caller — the
  -- BEFORE trigger below fills it from grower_id, so the two cannot disagree.
  -- It is here for two things that both need it without a join: the UNIQUE
  -- below, which has to be per tenant, and the RLS policy.
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Per tenant, like growers' own UNIQUE (customer_id, name): two tenants may
  -- each map "קיבוץ גשור דרום" onto a grower of their own. Within one tenant an
  -- alias resolves to exactly one grower or the resolver would have a choice to
  -- make, which is the thing this table exists to remove.
  UNIQUE (customer_id, alias)
);

COMMENT ON TABLE grower_aliases IS
  'Other names one grower appears under in an import file. Read by trg_olive_plot_details_resolve_grower; written by a merge on /api/growers. See 20260923120000.';
COMMENT ON COLUMN grower_aliases.alias IS
  'The absorbed spelling, trimmed. Never equal to any growers.name of the same tenant — enforced by trg_grower_aliases_validate.';
COMMENT ON COLUMN grower_aliases.customer_id IS
  'Derived from growers.customer_id on write. Never accepted from a caller.';

-- The resolver's only read is "the alias `x` of tenant `c`", which the UNIQUE
-- above already indexes. This one serves the other direction — listing a
-- grower's aliases, which /api/growers does on every load of the screen — and
-- gives the CASCADE an index to delete by.
CREATE INDEX IF NOT EXISTS idx_grower_aliases_grower_id ON grower_aliases(grower_id);

-- -----------------------------------------------------------------------------
-- customer_id is derived, not supplied
-- -----------------------------------------------------------------------------
-- ONE function, not two, and deliberately so. The collision check reads the
-- customer_id that the first half of this function derives, and Postgres orders
-- two BEFORE ROW triggers on the same event ALPHABETICALLY BY TRIGGER NAME. Split
-- across `trg_grower_aliases_no_name_collision` and `trg_grower_aliases_set_
-- customer`, "no_name" sorts first, so the check ran against a NULL customer_id,
-- matched nothing, and accepted every colliding alias. Verified, not reasoned
-- about: the two-trigger version returned INSERT 0 1 for an alias equal to a
-- live grower's name. Sequencing inside one function is the fix that does not
-- depend on what the triggers are called.
CREATE OR REPLACE FUNCTION grower_aliases_validate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alias := btrim(NEW.alias);
  IF NEW.alias = '' THEN
    RAISE EXCEPTION 'grower_aliases.alias must not be blank';
  END IF;

  -- Derived, never taken from the caller.
  SELECT customer_id INTO NEW.customer_id FROM growers WHERE id = NEW.grower_id;
  IF NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'grower_aliases.grower_id % does not exist', NEW.grower_id;
  END IF;

  -- Half one of "an alias is never also a name". A backstop: the route answers
  -- 409 naming the grower it clashed with and offers the merge that resolves
  -- it, so reaching this means something wrote to the table directly.
  IF EXISTS (
    SELECT 1 FROM growers
    WHERE customer_id = NEW.customer_id AND name = NEW.alias
  ) THEN
    RAISE EXCEPTION
      'alias "%" is already a grower name for this tenant — merge that grower instead', NEW.alias;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grower_aliases_validate ON grower_aliases;
CREATE TRIGGER trg_grower_aliases_validate
  BEFORE INSERT OR UPDATE OF grower_id, alias, customer_id
  ON grower_aliases
  FOR EACH ROW
  EXECUTE FUNCTION grower_aliases_validate();

-- Half two: the same rule seen from the growers side. This one is safe as its
-- own trigger — it reads NEW.customer_id, which growers rows carry themselves.
CREATE OR REPLACE FUNCTION growers_no_alias_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM grower_aliases
    WHERE customer_id = NEW.customer_id AND alias = NEW.name AND grower_id <> NEW.id
  ) THEN
    RAISE EXCEPTION
      'grower name "%" is already an alias of another grower for this tenant', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growers_no_alias_collision ON growers;
CREATE TRIGGER trg_growers_no_alias_collision
  BEFORE INSERT OR UPDATE OF name
  ON growers
  FOR EACH ROW
  EXECUTE FUNCTION growers_no_alias_collision();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- can_access_customer(), for the reasons 20260922100000 adopted it for growers:
-- SECURITY DEFINER so it cannot re-enter RLS, and one line instead of twelve.
-- Authorization flows one direction only, grower_aliases -> customers.
ALTER TABLE grower_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grower aliases for their customer" ON grower_aliases;
CREATE POLICY "Users can manage grower aliases for their customer"
  ON grower_aliases FOR ALL
  USING (can_access_customer(customer_id, auth.uid()));

-- FOR ALL with only USING means Postgres reuses it as the INSERT/UPDATE check,
-- so an alias cannot be planted under another tenant. Note the check runs
-- against the customer_id the trigger derived, not one a caller sent.

-- -----------------------------------------------------------------------------
-- Teach the resolver about aliases
-- -----------------------------------------------------------------------------
-- Unchanged from 20260923080000 except for the alias arm of the preference.
-- An area may be linked to more than one customer, so the tenant a plot's
-- grower belongs to is a choice; it now also counts a tenant that knows this
-- name as an ALIAS as one that "already has" the grower, so a re-import of the
-- absorbed spelling re-attaches to the same tenant that recorded the merge
-- rather than starting a fresh grower under the other one.
CREATE OR REPLACE FUNCTION olive_plot_owner_customer(p_area_id UUID, p_grower_name TEXT)
RETURNS UUID AS $$
  SELECT ca.customer_id
  FROM customer_areas ca
  LEFT JOIN growers g
    ON g.customer_id = ca.customer_id
   AND g.name = p_grower_name
  LEFT JOIN grower_aliases a
    ON a.customer_id = ca.customer_id
   AND a.alias = p_grower_name
  WHERE ca.area_id = p_area_id
  ORDER BY (g.id IS NOT NULL OR a.id IS NOT NULL) DESC, ca.created_at, ca.customer_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION olive_plot_owner_customer IS
  'The tenant a plot belongs to, preferring one that already knows this grower by name or by alias. See 20260923080000 and 20260923120000.';

-- The resolver itself. The alias lookup sits between "is there a grower of this
-- name" and "create one", which is the only place it can go: ahead of the exact
-- match it would shadow a real grower, behind the INSERT it would never run.
--
-- A name matched through an alias also REWRITES NEW.grower_name to the
-- surviving grower's name. Without that the plots table and the plots-screen
-- filter would keep showing "קיבוץ גשור דרום" for a plot whose grower is
-- "קיבוץ גשור" — the same split between id and display value that
-- 20260923080000 closed for the other direction, and the reason PUT
-- /api/growers already renames a grower on its plots.
CREATE OR REPLACE FUNCTION olive_plot_details_resolve_grower()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_customer_id UUID;
  v_grower_id UUID;
BEGIN
  -- An explicitly CHANGED grower_id wins, and the name follows it. This is the
  -- picker's path: it sends an id, and grower_name is kept alongside only as the
  -- display value the plots table and the importer read.
  IF TG_OP = 'UPDATE'
     AND NEW.grower_id IS DISTINCT FROM OLD.grower_id
     AND NEW.grower_id IS NOT NULL THEN
    SELECT name INTO NEW.grower_name FROM growers WHERE id = NEW.grower_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.grower_id IS NOT NULL THEN
    SELECT name INTO NEW.grower_name FROM growers WHERE id = NEW.grower_id;
    RETURN NEW;
  END IF;

  -- Otherwise the NAME drives, which is the importer's and the seed's path.
  v_name := btrim(COALESCE(NEW.grower_name, ''));

  IF v_name = '' THEN
    NEW.grower_name := NULL;
    NEW.grower_id := NULL;
    RETURN NEW;
  END IF;

  NEW.grower_name := v_name;

  v_customer_id := olive_plot_owner_customer(NEW.area_id, v_name);

  -- No tenant yet: an area is sometimes inserted before its customer_areas row
  -- (the importer does exactly that). Leave the link null rather than guessing —
  -- the backfill at the end of 20260923080000, and any later write, resolve it.
  IF v_customer_id IS NULL THEN
    NEW.grower_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO v_grower_id
  FROM growers
  WHERE customer_id = v_customer_id AND name = v_name;

  -- The alias arm. Rewrites the display name to the surviving grower's, so the
  -- absorbed spelling does not come back on the plots screen.
  IF v_grower_id IS NULL THEN
    SELECT g.id, g.name INTO v_grower_id, NEW.grower_name
    FROM grower_aliases a
    JOIN growers g ON g.id = a.grower_id
    WHERE a.customer_id = v_customer_id AND a.alias = v_name;
  END IF;

  IF v_grower_id IS NULL THEN
    -- ON CONFLICT covers two rows of the same import racing on a new name.
    INSERT INTO growers (customer_id, name)
    VALUES (v_customer_id, v_name)
    ON CONFLICT (customer_id, name) DO NOTHING
    RETURNING id INTO v_grower_id;

    IF v_grower_id IS NULL THEN
      SELECT id INTO v_grower_id
      FROM growers
      WHERE customer_id = v_customer_id AND name = v_name;
    END IF;
  END IF;

  NEW.grower_id := v_grower_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself is unchanged and is not re-created: CREATE OR REPLACE
-- FUNCTION above swaps the body under the existing trg_olive_plot_details_
-- resolve_grower, which already fires BEFORE INSERT OR UPDATE OF grower_name,
-- grower_id, area_id.

-- No new permission rows: the growers screen gates on create_area / update_area
-- / delete_area, seeded in 006_roles_and_permissions.sql, and an alias is part
-- of the same bookkeeping as the grower that owns it.
