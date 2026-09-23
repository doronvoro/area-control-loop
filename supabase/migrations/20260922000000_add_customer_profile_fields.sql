-- Customer profile fields: who the tenant is, and who to call.
--
-- `customers` has carried exactly two descriptive columns since 001 — name and
-- description — while the screen that manages it is the first step of onboarding
-- a tenant. Everything an operator needs at that moment (which kind of tenant
-- this is, who the contact is, how to reach them, the legal ID for invoicing)
-- has had nowhere to live, so it has lived outside the system.
--
-- ONE COLUMN PER FIELD, NO LOOKUP TABLE
-- customer_type is inline TEXT + CHECK, following
-- 20260228000000_add_area_type_to_areas.sql and olive_plot_details.plot_type,
-- rather than a `customer_types` table. Three values fixed by the business, read
-- on every row: a lookup table buys a join and a round-trip for referential
-- integrity the CHECK already provides. English codes stored, Hebrew displayed
-- from CUSTOMER_TYPE_LABELS in types/database.ts — the same split worker_types
-- and PLOT_TYPE_LABELS already use.
--
-- WHY THE CODES MATCH PlotType's
-- 'owner' already renders as 'ארץ גשור' in PLOT_TYPE_LABELS (the operator of
-- this app) and 'partner' as 'שותף'. Reusing the codes keeps one vocabulary for
-- one Hebrew word. The two enums are NOT interchangeable and must not be
-- merged: PlotType classifies who grows a PLOT (third value 'occasional' /
-- מזדמן), CustomerType classifies a TENANT (third value 'internal' / פנימי).
--
-- NULLABLE ON PURPOSE
-- Existing rows predate the column and there is no honest backfill — defaulting
-- to 'owner' would silently label every tenant as the operator itself. The CHECK
-- therefore admits NULL (`col IS NULL OR col IN (...)`), matching
-- olive_plot_details.plot_type. The create form requires a type and the edit
-- drawer makes an unclassified row pick one the first time it is opened, so the
-- backfill happens by hand, visibly, one tenant at a time.
--
-- TWO EMAILS, AND WHY contact_* IS PREFIXED
-- A customer's LOGIN email is not here and never will be: it belongs to
-- auth.users, is set once by POST /api/customers via createUserWithRole, and is
-- reset through /api/admin/recovery-link. contact_email is correspondence only.
-- The `contact_` prefix exists so that difference is visible at the column
-- level and not only in a UI label.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT
    CHECK (customer_type IS NULL OR customer_type IN ('owner', 'partner', 'internal')),
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_mobile TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS business_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  -- NOT NULL DEFAULT TRUE: every existing tenant is in use, so TRUE is the only
  -- correct backfill, and a three-valued "active" would make every badge and
  -- filter in the grid handle a state nobody can explain. PG11+ serves the
  -- default from the catalogue, so this does not rewrite the table.
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN customers.customer_type IS
  'Tenant classification: owner (ארץ גשור — the operator of this app), partner (שותף), internal (פנימי). NULL predates the column. Labels in CUSTOMER_TYPE_LABELS.';
COMMENT ON COLUMN customers.contact_email IS
  'Correspondence address only. The login email lives in auth.users and is set at creation.';
COMMENT ON COLUMN customers.business_id IS
  'ח.פ / ע.מ. Deliberately not UNIQUE — see the header of this migration.';
COMMENT ON COLUMN customers.is_active IS
  'Soft state for the admin grid. NOT access control: a deactivated tenant still logs in until their auth user is removed.';

-- -----------------------------------------------------------------------------
-- No new indexes, and no UNIQUE on business_id — deliberately
-- -----------------------------------------------------------------------------
-- `customers` is tens of rows, /api/customers reads it whole (ORDER BY name,
-- already served by idx_customers_name from 001), and every filter and sort on
-- the new grid is client-side over that single payload. An index on
-- customer_type, or a partial index on is_active, would never be consulted:
-- idx_areas_area_type from 20260228000000 is exactly that shape and no query has
-- ever used it. Adding one here would be cargo cult.
--
-- business_id is left non-unique on purpose. It is transcribed by hand during
-- onboarding, legacy rows have none, and a unique violation would surface as a
-- raw Postgres 500 inside a Hebrew RTL drawer. If duplicate legal IDs ever need
-- policing, that belongs in the API as a warning — not in a constraint whose
-- only behaviour is to fail.

-- -----------------------------------------------------------------------------
-- No RLS change, and no new permissions
-- -----------------------------------------------------------------------------
-- customers keeps its three policies from 002_rls_policies.sql and
-- 20260125000000_fix_admin_rls_policies.sql: a user reads and updates their own
-- row, an admin reads all. There is still no INSERT, no DELETE and no
-- admin-UPDATE policy, and this migration deliberately does not add one.
-- /api/customers performs those writes through ctx.adminClient after an explicit
-- permission AND ownership check, the same way /api/areas and /api/olive/plots
-- already do for admin-only writes (20260206000000_add_admin_areas_policies.sql).
-- Widening RLS would grant the same power to anything holding a user JWT,
-- including the browser's own client.
--
-- create_customer / read_customer / update_customer / delete_customer and
-- create_area are all seeded in 006_roles_and_permissions.sql. The new screens
-- reuse them unchanged, so there is no permission row to add.
