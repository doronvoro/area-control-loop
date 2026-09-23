-- Keep olive_plot_details.grower_id in step with grower_name, automatically.
--
-- THE BUG THIS FIXES
-- 20260922100000 added grower_id and backfilled it once. Nothing maintained it.
-- The very next backup import through /admin/olive-import wiped and recreated
-- every olive_plot_details row for the tenant, writing grower_name and no
-- grower_id — so all 51 plots kept their grower's NAME and lost the LINK, and
-- the growers screen reported 0 חלקות · — דונם for every grower while the plots
-- table still showed them correctly. Silent, and only visible on one screen.
--
-- The same gap applied to supabase/seed/olive_demo_seed.sql (a fresh `db reset`
-- runs migrations against empty tables, so the backfill matched nothing and the
-- seed then loaded plots with names only), and to both plot drawers.
--
-- WHY A TRIGGER RATHER THAN FIXING THE CALLERS
-- Four write paths reach this table — importBackup, the seed, PUT and POST
-- /api/olive/plots — and a fifth added later would regress it silently again,
-- exactly as the import just did. The link is an invariant of the row, not a
-- responsibility of whoever writes it, so it belongs here. It also means the
-- importer stays free to write plain Hebrew names, which is what the prototype
-- backup actually contains.

-- -----------------------------------------------------------------------------
-- Which tenant owns the plot this detail row belongs to
-- -----------------------------------------------------------------------------
-- Tenancy lives across customer_areas, and an area may be linked to more than
-- one customer — 11 are in this database, an artifact of the old create-admin
-- script. The pick is therefore deterministic and stated, not arbitrary:
--   1. a tenant that ALREADY has a grower of this name wins, so a re-import
--      re-attaches to the rows the first import created rather than making a
--      second set under the other tenant;
--   2. otherwise the oldest link, then the lowest id, purely so two runs on the
--      same data agree.
CREATE OR REPLACE FUNCTION olive_plot_owner_customer(p_area_id UUID, p_grower_name TEXT)
RETURNS UUID AS $$
  SELECT ca.customer_id
  FROM customer_areas ca
  LEFT JOIN growers g
    ON g.customer_id = ca.customer_id
   AND g.name = p_grower_name
  WHERE ca.area_id = p_area_id
  ORDER BY (g.id IS NOT NULL) DESC, ca.created_at, ca.customer_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION olive_plot_owner_customer IS
  'The tenant a plot belongs to, preferring one that already knows this grower. See 20260923080000.';

-- -----------------------------------------------------------------------------
-- The trigger
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER because it may INSERT a growers row on behalf of a caller
-- whose own rights were already established against the PLOT (can_access_area on
-- olive_plot_details). Without it an import running as a tenant could write the
-- name but not create the grower.
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
  -- the backfill at the end of this file, and any later write, will resolve it.
  IF v_customer_id IS NULL THEN
    NEW.grower_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO v_grower_id
  FROM growers
  WHERE customer_id = v_customer_id AND name = v_name;

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

DROP TRIGGER IF EXISTS trg_olive_plot_details_resolve_grower ON olive_plot_details;

CREATE TRIGGER trg_olive_plot_details_resolve_grower
  BEFORE INSERT OR UPDATE OF grower_name, grower_id, area_id
  ON olive_plot_details
  FOR EACH ROW
  EXECUTE FUNCTION olive_plot_details_resolve_grower();

-- -----------------------------------------------------------------------------
-- Repair what the import already broke
-- -----------------------------------------------------------------------------
-- Touching grower_name fires the trigger, which resolves the link and creates
-- any grower the import introduced. A no-op write on purpose: the value is
-- rewritten to its own trimmed self, so nothing else about the row changes.
UPDATE olive_plot_details
SET grower_name = btrim(grower_name)
WHERE grower_id IS NULL
  AND grower_name IS NOT NULL
  AND btrim(grower_name) <> '';
