-- Olive rollout — GROWER ALIASES. Creates one table and re-defines two functions.
--
-- Mirrors supabase/migrations/20260923120000_create_grower_aliases.sql. It is a
-- separate file for the same reason every other step here is: the ledger does
-- not describe this database (docs/rollout/README.md), so schema reaches
-- production by being pasted, not pushed.
--
-- WHY IT IS NEEDED
-- The גשור backup names one kibbutz three ways — "קיבוץ גשור" on 44 plots,
-- "קיבוץ גשור דרום" on 1 and "קיבוץ גשור מנחת צפון" on 1 — and in both strays
-- the suffix is the plot's own location, already carried by the plot's region
-- and name. Merging them on the מגדלים screen fixes the list until the next
-- import: trg_olive_plot_details_resolve_grower creates a grower for any name
-- it has not seen, and the importer writes plot.grower verbatim. This table is
-- where the merge is remembered, so it survives.
--
-- PREREQUISITE
-- `growers` must already exist (migration 20260922100000, same release). The
-- guard at the top of the transaction stops with a readable message rather than
-- a cascade of "relation does not exist".
--
-- ORDERING — this one is safe either way
-- Merging deploys the code through Vercel before this runs. The importer's
-- alias lookup treats a missing table as "no aliases" (isMissingTableError, the
-- same guard added for the threshold tables in 09 and 10), and the growers
-- screen simply shows none. Until this runs, a merge is unavailable and the
-- three names stay three growers — which is the state production is in today.
--
-- Re-runnable: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, and every
-- trigger and policy is dropped before it is created.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.growers') IS NULL THEN
    RAISE EXCEPTION
      'growers does not exist — paste supabase/migrations/20260922100000_create_growers.sql first';
  END IF;
  IF to_regproc('public.olive_plot_details_resolve_grower') IS NULL THEN
    RAISE EXCEPTION
      'olive_plot_details_resolve_grower does not exist — paste 20260923080000_resolve_grower_id_trigger.sql first';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.grower_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- CASCADE: an alias has no meaning without its grower, and a grower is only
  -- deletable once nothing points at it anyway.
  grower_id UUID NOT NULL REFERENCES public.growers(id) ON DELETE CASCADE,
  -- Denormalised from growers.customer_id and never supplied by a caller — the
  -- trigger below fills it. Present so the UNIQUE and the RLS policy can read
  -- the tenant without a join.
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Per tenant, like growers' own UNIQUE (customer_id, name).
  UNIQUE (customer_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_grower_aliases_grower_id
  ON public.grower_aliases(grower_id);

-- ONE function, not two. The collision check reads the customer_id the first
-- half derives, and Postgres orders two BEFORE ROW triggers on the same event
-- alphabetically by trigger name — which put the check first and made it match
-- nothing. Sequencing inside one function does not depend on what the triggers
-- are called.
CREATE OR REPLACE FUNCTION public.grower_aliases_validate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alias := btrim(NEW.alias);
  IF NEW.alias = '' THEN
    RAISE EXCEPTION 'grower_aliases.alias must not be blank';
  END IF;

  SELECT customer_id INTO NEW.customer_id FROM public.growers WHERE id = NEW.grower_id;
  IF NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'grower_aliases.grower_id % does not exist', NEW.grower_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.growers
    WHERE customer_id = NEW.customer_id AND name = NEW.alias
  ) THEN
    RAISE EXCEPTION
      'alias "%" is already a grower name for this tenant — merge that grower instead', NEW.alias;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grower_aliases_validate ON public.grower_aliases;
CREATE TRIGGER trg_grower_aliases_validate
  BEFORE INSERT OR UPDATE OF grower_id, alias, customer_id
  ON public.grower_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.grower_aliases_validate();

CREATE OR REPLACE FUNCTION public.growers_no_alias_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.grower_aliases
    WHERE customer_id = NEW.customer_id AND alias = NEW.name AND grower_id <> NEW.id
  ) THEN
    RAISE EXCEPTION
      'grower name "%" is already an alias of another grower for this tenant', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growers_no_alias_collision ON public.growers;
CREATE TRIGGER trg_growers_no_alias_collision
  BEFORE INSERT OR UPDATE OF name
  ON public.growers
  FOR EACH ROW
  EXECUTE FUNCTION public.growers_no_alias_collision();

ALTER TABLE public.grower_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grower aliases for their customer"
  ON public.grower_aliases;
CREATE POLICY "Users can manage grower aliases for their customer"
  ON public.grower_aliases FOR ALL
  USING (can_access_customer(customer_id, auth.uid()));

-- The resolver, taught about aliases. Both functions are REPLACED, not created:
-- the trigger that calls olive_plot_details_resolve_grower already exists and is
-- left alone.
CREATE OR REPLACE FUNCTION public.olive_plot_owner_customer(p_area_id UUID, p_grower_name TEXT)
RETURNS UUID AS $$
  SELECT ca.customer_id
  FROM public.customer_areas ca
  LEFT JOIN public.growers g
    ON g.customer_id = ca.customer_id
   AND g.name = p_grower_name
  LEFT JOIN public.grower_aliases a
    ON a.customer_id = ca.customer_id
   AND a.alias = p_grower_name
  WHERE ca.area_id = p_area_id
  ORDER BY (g.id IS NOT NULL OR a.id IS NOT NULL) DESC, ca.created_at, ca.customer_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.olive_plot_details_resolve_grower()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_customer_id UUID;
  v_grower_id UUID;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.grower_id IS DISTINCT FROM OLD.grower_id
     AND NEW.grower_id IS NOT NULL THEN
    SELECT name INTO NEW.grower_name FROM public.growers WHERE id = NEW.grower_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.grower_id IS NOT NULL THEN
    SELECT name INTO NEW.grower_name FROM public.growers WHERE id = NEW.grower_id;
    RETURN NEW;
  END IF;

  v_name := btrim(COALESCE(NEW.grower_name, ''));

  IF v_name = '' THEN
    NEW.grower_name := NULL;
    NEW.grower_id := NULL;
    RETURN NEW;
  END IF;

  NEW.grower_name := v_name;
  v_customer_id := olive_plot_owner_customer(NEW.area_id, v_name);

  IF v_customer_id IS NULL THEN
    NEW.grower_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO v_grower_id
  FROM public.growers
  WHERE customer_id = v_customer_id AND name = v_name;

  -- The alias arm, and the reason this file exists. Rewrites the display name to
  -- the surviving grower's so the absorbed spelling does not come back on the
  -- plots screen.
  IF v_grower_id IS NULL THEN
    SELECT g.id, g.name INTO v_grower_id, NEW.grower_name
    FROM public.grower_aliases a
    JOIN public.growers g ON g.id = a.grower_id
    WHERE a.customer_id = v_customer_id AND a.alias = v_name;
  END IF;

  IF v_grower_id IS NULL THEN
    INSERT INTO public.growers (customer_id, name)
    VALUES (v_customer_id, v_name)
    ON CONFLICT (customer_id, name) DO NOTHING
    RETURNING id INTO v_grower_id;

    IF v_grower_id IS NULL THEN
      SELECT id INTO v_grower_id
      FROM public.growers
      WHERE customer_id = v_customer_id AND name = v_name;
    END IF;
  END IF;

  NEW.grower_id := v_grower_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid = 'public.olive_plot_details'::regclass
     AND tgname = 'trg_olive_plot_details_resolve_grower';
  IF n <> 1 THEN
    RAISE EXCEPTION
      'trg_olive_plot_details_resolve_grower is missing — the alias arm will never run';
  END IF;
  RAISE NOTICE 'grower_aliases present, resolver replaced, trigger intact';
END $$;

COMMIT;


-- Verify — one grid, the way 02-verify.sql does it:
--
-- select 'grower_aliases table' as check, count(*)::text as got, '0' as want
--   from public.grower_aliases
-- union all
-- select 'validate trigger',
--        count(*)::text, '1' from pg_trigger
--   where tgrelid = 'public.grower_aliases'::regclass
--     and tgname = 'trg_grower_aliases_validate'
-- union all
-- select 'name-collision trigger',
--        count(*)::text, '1' from pg_trigger
--   where tgrelid = 'public.growers'::regclass
--     and tgname = 'trg_growers_no_alias_collision'
-- union all
-- select 'resolver knows aliases',
--        (position('grower_aliases' in prosrc) > 0)::text, 'true'
--   from pg_proc where proname = 'olive_plot_details_resolve_grower';
--
-- Then open /olive/growers for the גשור tenant: the merge icon appears on each
-- row, and merging "קיבוץ גשור דרום" into "קיבוץ גשור" should move its plot and
-- leave "גם: קיבוץ גשור דרום" under the surviving name. Re-importing the same
-- backup afterwards must NOT recreate it — the import report says
-- "שם מגדל שאוחד" instead.
