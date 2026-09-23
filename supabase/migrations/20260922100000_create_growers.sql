-- Growers (מגדלים) — the people and bodies whose plots a tenant manages.
--
-- Until now a grower was a free-text `olive_plot_details.grower_name`, repeated
-- once per plot. In the גשור data that is five names across 50 plots, one of
-- them ("קיבוץ גשור") on 44 of them. Nothing could list them, nothing could hold
-- a phone number for one, and a typo produced a sixth grower silently.
--
-- WHY A TABLE AND NOT customers.parent_customer_id
-- A self-join on `customers` was the obvious shortcut and was rejected, because
-- a `customers` row does not mean "an organisation" — it means "a TENANT with a
-- login":
--   * customers.user_id is NOT NULL UNIQUE REFERENCES auth.users. A grower is a
--     label on plots, not someone who signs in, so every grower would have
--     needed an auth account or that column would have had to go nullable.
--   * Everything that lists tenants reads `customers` wholesale — the admin
--     customer switcher (components/layout/CustomerSwitcher.tsx), the
--     cross-tenant screen (/api/areas-management) and the monitoring and action
--     form dropdowns (getCustomers in lib/services/lookup.service.ts). Growers
--     would have appeared in all four as selectable tenants, and any picker
--     added later would have regressed silently.
--   * The customers SELECT policy is `auth.uid() = user_id`, so a login-less
--     grower row would have been invisible to the very tenant that owns it.
-- Growers still JOIN to customers through customer_id, which is what makes this
-- page scope to the selected tenant for free. Tenants stay tenants.
--
-- WHY grower_type REUSES PlotType'S CODES
-- 'סוג מגדל' is already olive_plot_details.plot_type — owner / partner /
-- occasional, rendered as ארץ גשור / שותף / מזדמן in PLOT_TYPE_LABELS. The
-- classification belongs to the grower, so it moves here under the same codes.
-- plot_type is deliberately LEFT IN PLACE: the plot drawer edits it, the plots
-- toolbar filters on it and the importer writes it. Removing it is a separate
-- change. The backfill below seeds grower_type from each grower's plots, so the
-- two agree on day one.

CREATE TABLE IF NOT EXISTS growers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The tenant whose grower this is. CASCADE: a deleted tenant takes its
  -- growers with it, exactly as it already takes its workers and area links.
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grower_type TEXT CHECK (grower_type IS NULL OR grower_type IN ('owner', 'partner', 'occasional')),
  contact_person TEXT,
  contact_phone TEXT,
  contact_mobile TEXT,
  contact_email TEXT,
  address TEXT,
  city TEXT,
  business_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique WITHIN a tenant, not globally: two tenants may both work with a
  -- grower of the same name, and they are different records with different
  -- contact details. This is also what makes the backfill below idempotent and
  -- what the importer would match on.
  UNIQUE (customer_id, name)
);

COMMENT ON TABLE growers IS
  'מגדלים — a tenant''s growers. Referenced by olive_plot_details.grower_id. NOT a tenant: growers have no login, see the header of this migration.';
COMMENT ON COLUMN growers.grower_type IS
  'סוג מגדל, same codes as olive_plot_details.plot_type: owner (ארץ גשור), partner (שותף), occasional (מזדמן). Labels in PLOT_TYPE_LABELS.';
COMMENT ON COLUMN growers.is_active IS
  'Soft state for the grid. A grower with plots stays listed regardless.';

-- The only index worth its keep: every read of this table is "the growers of
-- customer X", and the UNIQUE above already indexes (customer_id, name), which
-- serves that prefix. No further index is added — see the note in
-- 20260922000000 about idx_areas_area_type never being consulted.

-- -----------------------------------------------------------------------------
-- The link from a plot to its grower
-- -----------------------------------------------------------------------------
-- ON DELETE SET NULL, not CASCADE: deleting a grower must never delete plots.
-- The API refuses that delete outright while plots still point here; this is the
-- backstop for anything that goes around it.
ALTER TABLE olive_plot_details
  ADD COLUMN IF NOT EXISTS grower_id UUID REFERENCES growers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_olive_plot_details_grower_id
  ON olive_plot_details(grower_id);

COMMENT ON COLUMN olive_plot_details.grower_id IS
  'The plot''s grower. grower_name is kept alongside as the display value the plots table and the importer already read; the API writes both together.';

-- -----------------------------------------------------------------------------
-- Backfill
-- -----------------------------------------------------------------------------
-- One grower per distinct (tenant, grower_name) already on a plot. The tenant is
-- reached the only way it can be — through customer_areas, the junction that
-- carries tenancy for areas.
--
-- grower_type is seeded from the plots themselves: the most common non-null
-- plot_type among that grower's plots, so an existing classification is not
-- thrown away and the new column does not start empty. Ties break on the code,
-- which is arbitrary but deterministic.
INSERT INTO growers (customer_id, name, grower_type)
SELECT DISTINCT ON (ca.customer_id, btrim(d.grower_name))
  ca.customer_id,
  btrim(d.grower_name),
  (
    SELECT d2.plot_type
    FROM olive_plot_details d2
    JOIN customer_areas ca2 ON ca2.area_id = d2.area_id
    WHERE ca2.customer_id = ca.customer_id
      AND btrim(d2.grower_name) = btrim(d.grower_name)
      AND d2.plot_type IS NOT NULL
    GROUP BY d2.plot_type
    ORDER BY count(*) DESC, d2.plot_type
    LIMIT 1
  )
FROM olive_plot_details d
JOIN customer_areas ca ON ca.area_id = d.area_id
WHERE d.grower_name IS NOT NULL AND btrim(d.grower_name) <> ''
ON CONFLICT (customer_id, name) DO NOTHING;

-- Point every plot at the row just created for it. Matched on the trimmed name
-- within the plot's own tenant, which is the pair the insert above keyed on.
UPDATE olive_plot_details d
SET grower_id = g.id
FROM customer_areas ca
JOIN growers g ON g.customer_id = ca.customer_id
WHERE ca.area_id = d.area_id
  AND g.name = btrim(d.grower_name)
  AND d.grower_id IS NULL;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- can_access_customer() from 20260208000000, for the same three reasons
-- olive_plot_details adopted can_access_area() in 20260908110000: it is
-- SECURITY DEFINER so it cannot re-enter RLS and cause the 42P17 recursion that
-- broke /api/map/areas, the helper's own migration documents this exact usage,
-- and it is one line instead of twelve.
--
-- Authorization still flows one direction only: growers -> customers. No policy
-- here reaches down into a child table.
ALTER TABLE growers ENABLE ROW LEVEL SECURITY;

-- Dropped first so the whole migration is re-runnable, as 15 of the 26 policy
-- migrations here already do. Everything above it is guarded by IF NOT EXISTS or
-- ON CONFLICT, and this was the one statement that was not.
DROP POLICY IF EXISTS "Users can manage growers for their customer" ON growers;

CREATE POLICY "Users can manage growers for their customer"
  ON growers FOR ALL
  USING (can_access_customer(customer_id, auth.uid()));

-- FOR ALL with only USING means Postgres reuses it as the INSERT/UPDATE check,
-- so a worker cannot move a grower to another tenant by updating customer_id.
--
-- No new permission rows: the olive screens gate on create_area / update_area /
-- delete_area, which 006_roles_and_permissions.sql already seeds, and a grower
-- is part of the same olive bookkeeping.
