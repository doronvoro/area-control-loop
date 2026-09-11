-- =============================================================================
-- Area Control Loop — full reset + demo seed
-- =============================================================================
--
-- DESTRUCTIVE. Wipes all application data and the four demo auth accounts,
-- then rebuilds a complete, map-ready dataset.
--
-- Run against LOCAL Docker Supabase only:
--   docker exec -i supabase_db_area-control-loop \
--     psql -U postgres -d postgres -v confirm=yes \
--     -f - < supabase/seed/reset_and_seed_full.sql
--
-- or simply:  npm run db:reset-seed
--
-- The -i flag on docker exec is REQUIRED (psql reads the script from stdin).
--
-- Runs as the `postgres` superuser, which has rolbypassrls = true. No table
-- uses FORCE ROW LEVEL SECURITY, so all RLS policies are bypassed. There are
-- no non-internal triggers in `public` or `auth`, so report statuses,
-- completion_percentage and treatment_match are all set explicitly here —
-- nothing is computed for us (see lib/report-status.ts).
--
-- All primary keys are pinned literals so the script is deterministic and
-- re-runnable. This also sidesteps a real schema trap: findings, crops,
-- materials and unit_types have ONLY a primary key — no unique constraint on
-- `name` — so `ON CONFLICT (name)` raises "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification".
--
-- ID namespaces:
--   a1… auth.users      a2… customers     a3… workers      a4… crops
--   a5… findings        a6… materials     a7… unit_types   a8… areas
--   a9… sub_areas       b1… report_areas  b2… monitoring_area_report
--   b3… actions_area_report               b4… monitoring_treatments
--   b5… action_treatments                 b6… crop_findings
--   b7… recommend_material
-- =============================================================================

\if :{?confirm}
\else
\echo ''
\echo 'REFUSING TO RUN: this script deletes all application data.'
\echo 'Re-run with -v confirm=yes if this is your local Docker database.'
\echo ''
\quit
\endif

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- -----------------------------------------------------------------------------
-- Section A — column guard
-- -----------------------------------------------------------------------------
-- migrations/20260227000000_add_geometry_to_areas.sql was committed empty and is
-- already recorded as applied on existing databases, so filling it does not
-- re-run there. This makes the script work either way.

ALTER TABLE public.areas     ADD COLUMN IF NOT EXISTS geometry jsonb;
ALTER TABLE public.sub_areas ADD COLUMN IF NOT EXISTS geometry jsonb;


-- -----------------------------------------------------------------------------
-- Section B — reset
-- -----------------------------------------------------------------------------
-- Preserved (owned by migrations): worker_types, report_area_types, roles,
-- permissions, role_permissions.
--
-- report_area_types MUST survive: report_areas.area_type_id is a TEXT foreign
-- key to report_area_types(name) with ON DELETE RESTRICT.

TRUNCATE TABLE
  public.monitoring_treatments,
  public.action_treatments,
  public.monitoring_area_report,
  public.actions_area_report,
  public.report_areas,
  public.recommend_material,
  public.pesticide_registry,
  public.import_batches,
  public.crop_findings,
  public.customer_areas,
  public.sub_areas,
  public.areas,
  public.invitations,
  public.workers,
  public.customers,
  public.user_roles,
  public.crops,
  public.materials,
  public.findings,
  public.unit_types
RESTART IDENTITY CASCADE;
-- RESTART IDENTITY resets report_areas.report_number so a reseed always
-- produces the same report numbers (1..7) rather than climbing each run.

-- Demo auth accounts only — scoped by email so a real account is never touched.
-- customers.user_id and invitations.invited_by_user_id are ON DELETE RESTRICT,
-- but both tables were just truncated above. auth.sessions / refresh_tokens
-- cascade on their own.
DELETE FROM auth.identities
 WHERE email IN ('admin@example.com', 'inspector@example.com',
                 'worker@example.com', 'customer@example.com');

DELETE FROM auth.users
 WHERE email IN ('admin@example.com', 'inspector@example.com',
                 'worker@example.com', 'customer@example.com');


-- -----------------------------------------------------------------------------
-- Section C — auth users
-- -----------------------------------------------------------------------------
-- Password login needs BOTH an auth.users row and a matching auth.identities
-- row (provider 'email'). Without the identity, the token endpoint returns
-- invalid_credentials even though the user exists.
--
-- The four token columns MUST be '' and not NULL. They are nullable with no
-- default in the schema, but GoTrue scans them into non-nullable Go strings,
-- so a NULL makes every login fail with HTTP 500:
--   "Scan error on column index 3, name \"confirmation_token\":
--    converting NULL to string is unsupported"
-- (phone_change, phone_change_token, email_change_token_current and
-- reauthentication_token already default to '', so they need no help.)

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@example.com',
   extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"מנהל מערכת","role":"admin"}'::jsonb, now(), now()),

  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'customer@example.com',
   extensions.crypt('test123', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"מטעי הגליל"}'::jsonb, now(), now()),

  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inspector@example.com',
   extensions.crypt('test123', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"רותם פקח"}'::jsonb, now(), now()),

  ('a1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'worker@example.com',
   extensions.crypt('test123', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"אלון רסס"}'::jsonb, now(), now());

INSERT INTO auth.identities (
  id, user_id, provider, provider_id, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id, u.id, 'email', u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email,
                     'email_verified', true, 'phone_verified', false),
  now(), now(), now()
FROM auth.users u
WHERE u.id::text LIKE 'a1000000-0000-4000-8000-%';


-- -----------------------------------------------------------------------------
-- Section D — customers, workers, roles
-- -----------------------------------------------------------------------------
-- The admin gets its own customer record and is linked to every area, matching
-- what scripts/create-admin-user.ts does. resolveCustomerId() in
-- lib/api/auth-context.ts prefers ctx.customer.id, so without that link the
-- admin's dashboard and map would come up empty.

INSERT INTO public.customers (id, user_id, name, description) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'מנהל מערכת', 'מנהל מערכת ראשי - יכול להזמין לקוחות חדשים'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'מטעי הגליל בע"מ', 'לקוח הדגמה - מטעים ובתי צמיחה');

-- worker_types in the live schema: inspector, action_worker, super_worker.
-- roles in the live schema: admin, customer_owner, worker. (The stale TS seed
-- scripts assign roles named 'inspector'/'action_worker', which do not exist,
-- so they silently assign nothing.)
-- NB: INSERT ... SELECT does not implicitly cast string literals to uuid the
-- way INSERT ... VALUES does, so every literal id here is cast explicitly.
INSERT INTO public.workers (id, customer_id, user_id, name, type_id)
SELECT 'a3000000-0000-4000-8000-000000000001'::uuid, 'a2000000-0000-4000-8000-000000000002'::uuid,
       'a1000000-0000-4000-8000-000000000003'::uuid, 'רותם פקח', wt.id
  FROM public.worker_types wt WHERE wt.name = 'inspector'
UNION ALL
SELECT 'a3000000-0000-4000-8000-000000000002'::uuid, 'a2000000-0000-4000-8000-000000000002'::uuid,
       'a1000000-0000-4000-8000-000000000004'::uuid, 'אלון רסס', wt.id
  FROM public.worker_types wt WHERE wt.name = 'action_worker';

INSERT INTO public.user_roles (user_id, role_id)
SELECT 'a1000000-0000-4000-8000-000000000001'::uuid, r.id FROM public.roles r WHERE r.name = 'admin'
UNION ALL
SELECT 'a1000000-0000-4000-8000-000000000002'::uuid, r.id FROM public.roles r WHERE r.name = 'customer_owner'
UNION ALL
SELECT 'a1000000-0000-4000-8000-000000000003'::uuid, r.id FROM public.roles r WHERE r.name = 'worker'
UNION ALL
SELECT 'a1000000-0000-4000-8000-000000000004'::uuid, r.id FROM public.roles r WHERE r.name = 'worker';


-- -----------------------------------------------------------------------------
-- Section E — catalogue (unit types, findings, crops, materials)
-- -----------------------------------------------------------------------------

INSERT INTO public.unit_types (id, name, description) VALUES
  ('a7000000-0000-4000-8000-000000000001', 'ml',                 'מיליליטר'),
  ('a7000000-0000-4000-8000-000000000002', 'l',                  'ליטר'),
  ('a7000000-0000-4000-8000-000000000003', 'kg',                 'קילוגרם'),
  ('a7000000-0000-4000-8000-000000000004', 'g',                  'גרם'),
  ('a7000000-0000-4000-8000-000000000005', 'units',              'יחידות'),
  ('a7000000-0000-4000-8000-000000000006', 'liters_per_hectare', 'ליטר להקטר');

INSERT INTO public.findings (id, name, description, severity, source) VALUES
  ('a5000000-0000-4000-8000-000000000001', 'כנימות עלה',      'כנימות עלה על צימוח צעיר',        'medium',   'custom'),
  ('a5000000-0000-4000-8000-000000000002', 'אקריות',          'אקרית אדומה מצויה',               'high',     'custom'),
  ('a5000000-0000-4000-8000-000000000003', 'מחלה פטרייתית',   'נגיעות פטרייתית בעלים',           'high',     'custom'),
  ('a5000000-0000-4000-8000-000000000004', 'מחלה חיידקית',    'כתמים חיידקיים על הפרי',          'critical', 'custom'),
  ('a5000000-0000-4000-8000-000000000005', 'זבוב הפירות',     'נקבי הטלה בפרי',                  'high',     'custom'),
  ('a5000000-0000-4000-8000-000000000006', 'עש התפוח',        'זחלים בתוך הפרי',                 'high',     'custom'),
  ('a5000000-0000-4000-8000-000000000007', 'קימחון',          'ציפוי קמחי לבן על העלים',         'medium',   'custom'),
  ('a5000000-0000-4000-8000-000000000008', 'כשותית',          'כתמי שמן בפני העלה',              'high',     'custom'),
  ('a5000000-0000-4000-8000-000000000009', 'חוסר חנקן',       'הצהבת עלים מבוגרים',              'low',      'custom'),
  ('a5000000-0000-4000-8000-000000000010', 'חוסר אשלגן',      'שריפת שוליים בעלים',              'low',      'custom'),
  ('a5000000-0000-4000-8000-000000000011', 'עשבייה',          'כיסוי עשבייה בין השורות',         'low',      'custom'),
  ('a5000000-0000-4000-8000-000000000012', 'ריקבון שורשים',   'קמילה ונבילה בצמחים בודדים',      'critical', 'custom');

INSERT INTO public.crops (id, name, description, source) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'שזיף',    'מטע שזיפים',        'custom'),
  ('a4000000-0000-4000-8000-000000000002', 'תפוח',    'מטע תפוחים',        'custom'),
  ('a4000000-0000-4000-8000-000000000003', 'אפרסק',   'מטע אפרסקים',       'custom'),
  ('a4000000-0000-4000-8000-000000000004', 'ענבים',   'כרם יין ומאכל',     'custom'),
  ('a4000000-0000-4000-8000-000000000005', 'זית',     'מטע זיתים',         'custom'),
  ('a4000000-0000-4000-8000-000000000006', 'אבוקדו',  'מטע אבוקדו',        'custom'),
  ('a4000000-0000-4000-8000-000000000007', 'תמר',     'מטע תמרים',         'custom'),
  ('a4000000-0000-4000-8000-000000000008', 'רימון',   'מטע רימונים',       'custom'),
  ('a4000000-0000-4000-8000-000000000009', 'עגבנייה', 'גידול בבית צמיחה',  'custom'),
  ('a4000000-0000-4000-8000-000000000010', 'מלפפון',  'גידול בבית צמיחה',  'custom');

INSERT INTO public.materials (id, name, description, active_ingredient, source) VALUES
  ('a6000000-0000-4000-8000-000000000001', 'ורטימק',    'תכשיר להדברת אקריות',        'Abamectin',              'custom'),
  ('a6000000-0000-4000-8000-000000000002', 'קונפידור',  'קוטל חרקים סיסטמי',          'Imidacloprid',           'custom'),
  ('a6000000-0000-4000-8000-000000000003', 'גופרית',    'אבקה להדברת קימחון',         'Sulfur',                 'custom'),
  ('a6000000-0000-4000-8000-000000000004', 'קוצייד',    'תכשיר נחושת',                'Copper hydroxide',       'custom'),
  ('a6000000-0000-4000-8000-000000000005', 'טרייסר',    'קוטל חרקים ביולוגי',         'Spinosad',               'custom'),
  ('a6000000-0000-4000-8000-000000000006', 'אמיסטאר',   'קוטל פטריות רחב טווח',       'Azoxystrobin',           'custom'),
  ('a6000000-0000-4000-8000-000000000007', 'שמן מינרלי','שמן קיץ למניעת כנימות',      'Mineral oil',            'custom'),
  ('a6000000-0000-4000-8000-000000000008', 'דיפל',      'תכשיר ביולוגי לזחלים',       'Bacillus thuringiensis', 'custom'),
  ('a6000000-0000-4000-8000-000000000009', 'מנקוזב',    'קוטל פטריות במגע',           'Mancozeb',               'custom'),
  ('a6000000-0000-4000-8000-000000000010', 'טילט',      'קוטל פטריות סיסטמי',         'Propiconazole',          'custom');

-- crop → finding associations
INSERT INTO public.crop_findings (crop_id, finding_id)
SELECT c.id, f.id
FROM public.crops c
JOIN public.findings f ON TRUE
WHERE (c.name, f.name) IN (
  ('שזיף','כנימות עלה'), ('שזיף','זבוב הפירות'), ('שזיף','מחלה פטרייתית'),
  ('תפוח','עש התפוח'),   ('תפוח','קימחון'),      ('תפוח','אקריות'),
  ('אפרסק','זבוב הפירות'),('אפרסק','כנימות עלה'),
  ('ענבים','קימחון'),    ('ענבים','כשותית'),      ('ענבים','אקריות'),
  ('זית','זבוב הפירות'), ('זית','מחלה חיידקית'),
  ('אבוקדו','חוסר חנקן'),('אבוקדו','ריקבון שורשים'),
  ('תמר','עשבייה'),
  ('רימון','מחלה חיידקית'),
  ('עגבנייה','כשותית'),  ('עגבנייה','חוסר אשלגן'), ('עגבנייה','אקריות'),
  ('מלפפון','קימחון'),   ('מלפפון','כנימות עלה')
);

-- material recommendations. action_type_id is TEXT ('spray'|'drench'|'spread'),
-- not a FK — the action_types table was dropped in 20260310000000.
INSERT INTO public.recommend_material
  (crop_id, finding_id, material_id, unit_type_id, dosage, action_type_id, source)
SELECT c.id, f.id, m.id, u.id, d.dosage, d.action_type, 'custom'
FROM (VALUES
  ('שזיף',   'כנימות עלה',    'קונפידור',   'ml', 50.00,  'spray'),
  ('שזיף',   'זבוב הפירות',   'טרייסר',     'ml', 30.00,  'spray'),
  ('תפוח',   'עש התפוח',      'דיפל',       'g',  100.00, 'spray'),
  ('תפוח',   'קימחון',        'גופרית',     'kg', 2.00,   'spread'),
  ('תפוח',   'אקריות',        'ורטימק',     'ml', 40.00,  'spray'),
  ('אפרסק',  'זבוב הפירות',   'טרייסר',     'ml', 30.00,  'spray'),
  ('ענבים',  'קימחון',        'גופרית',     'kg', 3.00,   'spread'),
  ('ענבים',  'כשותית',        'אמיסטאר',    'ml', 75.00,  'spray'),
  ('זית',    'מחלה חיידקית',  'קוצייד',     'kg', 1.50,   'spray'),
  ('אבוקדו', 'ריקבון שורשים', 'אמיסטאר',    'l',  1.00,   'drench'),
  ('עגבנייה','כשותית',        'מנקוזב',     'g',  250.00, 'spray'),
  ('עגבנייה','אקריות',        'ורטימק',     'ml', 40.00,  'spray'),
  ('מלפפון', 'קימחון',        'טילט',       'ml', 25.00,  'spray')
) AS d(crop, finding, material, unit, dosage, action_type)
JOIN public.crops     c ON c.name = d.crop
JOIN public.findings  f ON f.name = d.finding
JOIN public.materials m ON m.name = d.material
JOIN public.unit_types u ON u.name = d.unit;


-- -----------------------------------------------------------------------------
-- Section F — areas and sub-areas, with map geometry
-- -----------------------------------------------------------------------------
-- Geometry is a bare GeoJSON Polygon object ({type, coordinates}), NOT a
-- Feature — components/map/LeafletMap.tsx hands the stored value straight to
-- L.geoJSON(). Outdoor coordinates are WGS84 in [lng, lat] order with a closed
-- ring (first point repeated). Longitude first: swapping the pair puts these
-- polygons in the Indian Ocean and fitBounds flies the map off Israel.
--
-- Each area spans 0.030° lng x 0.020° lat (~2.8 km x 2.2 km) and is placed over
-- the region its Hebrew name describes, so the map's DEFAULT_CENTER
-- (31.7683, 35.2137) at DEFAULT_ZOOM 8 shows all four spread across the country.

INSERT INTO public.areas
  (id, name, description, crop_id, size, size_unit_type, area_type, variety, planting_time, geometry)
VALUES
  ('a8000000-0000-4000-8000-000000000001', 'אזור צפון', 'מטע שזיפים בגליל העליון',
   'a4000000-0000-4000-8000-000000000001', 620.00, 'dunam', 'outdoor', 'מרקו', '2012-03-01',
   '{"type":"Polygon","coordinates":[[[35.290,33.010],[35.320,33.010],[35.320,33.030],[35.290,33.030],[35.290,33.010]]]}'::jsonb),

  ('a8000000-0000-4000-8000-000000000002', 'אזור עמק', 'כרם ענבים בעמק יזרעאל',
   'a4000000-0000-4000-8000-000000000004', 540.00, 'dunam', 'outdoor', 'קברנה סוביניון', '2015-02-15',
   '{"type":"Polygon","coordinates":[[[35.280,32.590],[35.310,32.590],[35.310,32.610],[35.280,32.610],[35.280,32.590]]]}'::jsonb),

  ('a8000000-0000-4000-8000-000000000003', 'אזור הר', 'מטע תפוחים בהרי יהודה',
   'a4000000-0000-4000-8000-000000000002', 480.00, 'dunam', 'outdoor', 'גאלה', '2010-11-20',
   '{"type":"Polygon","coordinates":[[[35.035,31.740],[35.065,31.740],[35.065,31.760],[35.035,31.760],[35.035,31.740]]]}'::jsonb),

  ('a8000000-0000-4000-8000-000000000004', 'אזור מרכז', 'מטע אבוקדו בשרון',
   'a4000000-0000-4000-8000-000000000006', 510.00, 'dunam', 'outdoor', 'האס', '2017-04-10',
   '{"type":"Polygon","coordinates":[[[34.885,32.190],[34.915,32.190],[34.915,32.210],[34.885,32.210],[34.885,32.190]]]}'::jsonb),

  -- Indoor: excluded from /map by the area_type !== 'indoor' filter in
  -- app/api/map/areas/route.ts. Its geometry is metres in the L.CRS.Simple
  -- canvas space used by components/indoor-designer/canvas/IndoorCanvas.tsx —
  -- 100 m x 50 m, origin bottom-left. size = 100*50/1000 = 5 dunam.
  ('a8000000-0000-4000-8000-000000000005', 'אזור דרום', 'בית צמיחה בנגב המערבי',
   'a4000000-0000-4000-8000-000000000009', 5.00, 'dunam', 'indoor', 'עגבניית שרי', '2024-09-01',
   '{"type":"Polygon","coordinates":[[[0,0],[100,0],[100,50],[0,50],[0,0]]]}'::jsonb);

-- Every area is linked to BOTH the admin's customer and the demo customer.
-- customer_areas is the entry point for /api/map/areas, /api/areas and
-- /api/areas-management — an area with no link is invisible regardless of
-- geometry.
INSERT INTO public.customer_areas (customer_id, area_id)
SELECT c.id, a.id
FROM public.customers c
CROSS JOIN public.areas a
WHERE c.id IN ('a2000000-0000-4000-8000-000000000001',
               'a2000000-0000-4000-8000-000000000002');

-- Level-1 sub-areas: three vertical strips per outdoor area.
-- Deterministic ids: a9000000-…-<area_idx * 100 + strip_idx>
-- `display` follows the app convention "<area name> | <sub-area name>"
-- (app/api/sub-areas/route.ts).
INSERT INTO public.sub_areas
  (id, area_id, parent_sub_area_id, level, name, display, variety, rows,
   crop_id, size, size_unit_type, planting_time, geometry)
SELECT
  ('a9000000-0000-4000-8000-' || lpad((d.idx * 100 + s)::text, 12, '0'))::uuid,
  d.area_id,
  NULL,
  1,
  n.name,
  a.name || ' | ' || n.name,
  a.variety,
  n.rows,
  a.crop_id,
  round((a.size / 3)::numeric, 2),
  'dunam',
  a.planting_time,
  jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(round(d.min_lng + d.step * (s - 1), 6), round(d.min_lat, 6)),
      jsonb_build_array(round(d.min_lng + d.step * s,       6), round(d.min_lat, 6)),
      jsonb_build_array(round(d.min_lng + d.step * s,       6), round(d.max_lat, 6)),
      jsonb_build_array(round(d.min_lng + d.step * (s - 1), 6), round(d.max_lat, 6)),
      jsonb_build_array(round(d.min_lng + d.step * (s - 1), 6), round(d.min_lat, 6))
    ))
  )
FROM (VALUES
  (1, 'a8000000-0000-4000-8000-000000000001'::uuid, 35.290::numeric, 33.010::numeric, 33.030::numeric, 0.010::numeric),
  (2, 'a8000000-0000-4000-8000-000000000002'::uuid, 35.280::numeric, 32.590::numeric, 32.610::numeric, 0.010::numeric),
  (3, 'a8000000-0000-4000-8000-000000000003'::uuid, 35.035::numeric, 31.740::numeric, 31.760::numeric, 0.010::numeric),
  (4, 'a8000000-0000-4000-8000-000000000004'::uuid, 34.885::numeric, 32.190::numeric, 32.210::numeric, 0.010::numeric)
) AS d(idx, area_id, min_lng, min_lat, max_lat, step)
JOIN public.areas a ON a.id = d.area_id
CROSS JOIN generate_series(1, 3) AS s
JOIN (VALUES
  (1, 'חלקה א', '1-40'),
  (2, 'חלקה ב', '41-80'),
  (3, 'חלקה ג', '81-120')
) AS n(seq, name, rows) ON n.seq = s;

-- Level-2 sub-areas: the first strip of each outdoor area split in two by
-- latitude. ids: a9000000-…-<area_idx * 100 + 50 + j>
INSERT INTO public.sub_areas
  (id, area_id, parent_sub_area_id, level, name, display, variety, rows,
   crop_id, size, size_unit_type, planting_time, geometry)
SELECT
  ('a9000000-0000-4000-8000-' || lpad((d.idx * 100 + 50 + j)::text, 12, '0'))::uuid,
  d.area_id,
  ('a9000000-0000-4000-8000-' || lpad((d.idx * 100 + 1)::text, 12, '0'))::uuid,
  2,
  n.name,
  parent.display || ' | ' || n.name,
  a.variety,
  n.rows,
  a.crop_id,
  round((a.size / 6)::numeric, 2),
  'dunam',
  a.planting_time,
  jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(round(d.min_lng, 6),             round(d.min_lat + d.lat_step * (j - 1), 6)),
      jsonb_build_array(round(d.min_lng + d.step, 6),    round(d.min_lat + d.lat_step * (j - 1), 6)),
      jsonb_build_array(round(d.min_lng + d.step, 6),    round(d.min_lat + d.lat_step * j,       6)),
      jsonb_build_array(round(d.min_lng, 6),             round(d.min_lat + d.lat_step * j,       6)),
      jsonb_build_array(round(d.min_lng, 6),             round(d.min_lat + d.lat_step * (j - 1), 6))
    ))
  )
FROM (VALUES
  (1, 'a8000000-0000-4000-8000-000000000001'::uuid, 35.290::numeric, 33.010::numeric, 0.010::numeric, 0.010::numeric),
  (2, 'a8000000-0000-4000-8000-000000000002'::uuid, 35.280::numeric, 32.590::numeric, 0.010::numeric, 0.010::numeric),
  (3, 'a8000000-0000-4000-8000-000000000003'::uuid, 35.035::numeric, 31.740::numeric, 0.010::numeric, 0.010::numeric),
  (4, 'a8000000-0000-4000-8000-000000000004'::uuid, 34.885::numeric, 32.190::numeric, 0.010::numeric, 0.010::numeric)
) AS d(idx, area_id, min_lng, min_lat, step, lat_step)
JOIN public.areas a ON a.id = d.area_id
JOIN public.sub_areas parent
  ON parent.id = ('a9000000-0000-4000-8000-' || lpad((d.idx * 100 + 1)::text, 12, '0'))::uuid
CROSS JOIN generate_series(1, 2) AS j
JOIN (VALUES
  (1, 'שורות 1-20',  '1-20'),
  (2, 'שורות 21-40', '21-40')
) AS n(seq, name, rows) ON n.seq = j;

-- Indoor sub-areas: four vertical strips of the 100 m x 50 m house, in metres.
INSERT INTO public.sub_areas
  (id, area_id, parent_sub_area_id, level, name, display, variety, rows,
   crop_id, size, size_unit_type, planting_time, geometry)
SELECT
  ('a9000000-0000-4000-8000-' || lpad((500 + s)::text, 12, '0'))::uuid,
  'a8000000-0000-4000-8000-000000000005',
  NULL,
  1,
  'מנהרה ' || s,
  'אזור דרום | מנהרה ' || s,
  'עגבניית שרי',
  ((s - 1) * 12 + 1) || '-' || (s * 12),
  'a4000000-0000-4000-8000-000000000009',
  1.25,
  'dunam',
  '2024-09-01',
  jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array((s - 1) * 25, 0),
      jsonb_build_array(s * 25,       0),
      jsonb_build_array(s * 25,       50),
      jsonb_build_array((s - 1) * 25, 50),
      jsonb_build_array((s - 1) * 25, 0)
    ))
  )
FROM generate_series(1, 4) AS s;


-- -----------------------------------------------------------------------------
-- Section G — the report chain
-- -----------------------------------------------------------------------------
-- report_areas.area_type_id is TEXT ('monitoring' | 'action'), a FK to
-- report_area_types(name). Statuses and completion_percentage are computed by
-- the application (lib/report-status.ts), never by the database, so they are
-- set explicitly here to match what the app would have written.
--
-- Four deliberate shapes:
--   RA1 אזור צפון   — open      (pending, 0%)   → red map pins
--   RA2 אזור עמק    — partial   (in_progress, 50%)
--   RA3 אזור הר     — fulfilled (completed, 100%)
--   RA4 אזור מרכז   — open      (pending, 0%)   → red map pins
--   RA5 אזור דרום   — open indoor (pending, 0%)

INSERT INTO public.report_areas
  (id, area_id, area_type_id, name, description, status, worker_id,
   completion_percentage, report_date)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001',
   'monitoring', 'ניטור שבועי - אזור צפון', 'סיור ניטור שגרתי', 'pending',
   'a3000000-0000-4000-8000-000000000001', 0,   now() - interval '2 days'),

  ('b1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000002',
   'monitoring', 'ניטור שבועי - אזור עמק', 'ניטור כרם', 'in_progress',
   'a3000000-0000-4000-8000-000000000001', 50,  now() - interval '6 days'),

  ('b1000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000003',
   'monitoring', 'ניטור שבועי - אזור הר', 'ניטור מטע תפוחים', 'completed',
   'a3000000-0000-4000-8000-000000000001', 100, now() - interval '12 days'),

  ('b1000000-0000-4000-8000-000000000004', 'a8000000-0000-4000-8000-000000000004',
   'monitoring', 'ניטור שבועי - אזור מרכז', 'ניטור מטע אבוקדו', 'pending',
   'a3000000-0000-4000-8000-000000000001', 0,   now() - interval '1 day'),

  ('b1000000-0000-4000-8000-000000000005', 'a8000000-0000-4000-8000-000000000005',
   'monitoring', 'ניטור בית צמיחה - אזור דרום', 'ניטור עגבניות', 'pending',
   'a3000000-0000-4000-8000-000000000001', 0,   now() - interval '3 days'),

  -- action headers
  ('b1000000-0000-4000-8000-000000000011', 'a8000000-0000-4000-8000-000000000002',
   'action', 'פעולה - אזור עמק', 'ריסוס בעקבות ניטור', 'completed',
   'a3000000-0000-4000-8000-000000000002', 100, now() - interval '4 days'),

  ('b1000000-0000-4000-8000-000000000012', 'a8000000-0000-4000-8000-000000000003',
   'action', 'פעולה - אזור הר', 'טיפול מלא בעקבות ניטור', 'completed',
   'a3000000-0000-4000-8000-000000000002', 100, now() - interval '10 days');

-- Action side first: monitoring_area_report.actions_area_report_id and
-- monitoring_treatments.action_treatment_id both point this way, so inserting
-- actions first avoids any need for deferred constraints.
-- NB actions_area_report.status defaults to 'completed' (monitoring defaults to 'pending').
INSERT INTO public.actions_area_report
  (id, area_report_id, sub_area_id, finding_id, severity, status, created_at)
VALUES
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000011',
   'a9000000-0000-4000-8000-000000000201', 'a5000000-0000-4000-8000-000000000007',
   'medium', 'completed', now() - interval '4 days'),

  ('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000012',
   'a9000000-0000-4000-8000-000000000301', 'a5000000-0000-4000-8000-000000000006',
   'high', 'completed', now() - interval '10 days'),

  ('b3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000012',
   'a9000000-0000-4000-8000-000000000302', 'a5000000-0000-4000-8000-000000000002',
   'high', 'completed', now() - interval '10 days');

INSERT INTO public.action_treatments
  (id, action_report_id, material_id, dosage, unit_type_id, action_type_id,
   status, notes, action_time)
VALUES
  ('b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000003', 3.00, 'a7000000-0000-4000-8000-000000000003',
   'spread', 'completed', 'פיזור גופרית בוקר', now() - interval '4 days'),

  ('b5000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002',
   'a6000000-0000-4000-8000-000000000008', 100.00, 'a7000000-0000-4000-8000-000000000004',
   'spray', 'completed', 'ריסוס דיפל לפי המלצה', now() - interval '10 days'),

  -- Deliberately different dosage from what monitoring recommended (40 ml),
  -- so treatment_match = false and the mismatch UI has something to show.
  ('b5000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000003',
   'a6000000-0000-4000-8000-000000000001', 60.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'completed', 'ריסוס ורטימק במינון מוגבר', now() - interval '10 days');

INSERT INTO public.monitoring_area_report
  (id, area_report_id, sub_area_id, finding_id, actions_area_report_id,
   severity, status, created_at)
VALUES
  -- RA1 אזור צפון — fully open (drives red pins on the map)
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000101', 'a5000000-0000-4000-8000-000000000001',
   NULL, 'high',     'pending', now() - interval '2 days'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000102', 'a5000000-0000-4000-8000-000000000003',
   NULL, 'critical', 'pending', now() - interval '2 days'),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000151', 'a5000000-0000-4000-8000-000000000005',
   NULL, 'medium',   'pending', now() - interval '2 days'),

  -- RA2 אזור עמק — one entry fulfilled, one still open → 50%
  ('b2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000002',
   'a9000000-0000-4000-8000-000000000201', 'a5000000-0000-4000-8000-000000000007',
   'b3000000-0000-4000-8000-000000000001', 'medium', 'completed', now() - interval '6 days'),
  ('b2000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000002',
   'a9000000-0000-4000-8000-000000000202', 'a5000000-0000-4000-8000-000000000008',
   NULL, 'high', 'pending', now() - interval '6 days'),

  -- RA3 אזור הר — fully fulfilled → 100%
  ('b2000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000003',
   'a9000000-0000-4000-8000-000000000301', 'a5000000-0000-4000-8000-000000000006',
   'b3000000-0000-4000-8000-000000000002', 'high', 'completed', now() - interval '12 days'),
  ('b2000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000003',
   'a9000000-0000-4000-8000-000000000302', 'a5000000-0000-4000-8000-000000000002',
   'b3000000-0000-4000-8000-000000000003', 'high', 'completed', now() - interval '12 days'),

  -- RA4 אזור מרכז — open
  ('b2000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000004',
   'a9000000-0000-4000-8000-000000000401', 'a5000000-0000-4000-8000-000000000009',
   NULL, 'low',      'pending', now() - interval '1 day'),
  ('b2000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000004',
   'a9000000-0000-4000-8000-000000000402', 'a5000000-0000-4000-8000-000000000012',
   NULL, 'critical', 'pending', now() - interval '1 day'),
  ('b2000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000004',
   'a9000000-0000-4000-8000-000000000403', 'a5000000-0000-4000-8000-000000000011',
   NULL, 'low',      'pending', now() - interval '1 day'),
  ('b2000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000004',
   'a9000000-0000-4000-8000-000000000451', 'a5000000-0000-4000-8000-000000000001',
   NULL, 'medium',   'pending', now() - interval '1 day'),

  -- RA5 אזור דרום (indoor) — open
  ('b2000000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000005',
   'a9000000-0000-4000-8000-000000000501', 'a5000000-0000-4000-8000-000000000008',
   NULL, 'high',     'pending', now() - interval '3 days'),
  ('b2000000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000005',
   'a9000000-0000-4000-8000-000000000502', 'a5000000-0000-4000-8000-000000000010',
   NULL, 'low',      'pending', now() - interval '3 days'),
  ('b2000000-0000-4000-8000-000000000014', 'b1000000-0000-4000-8000-000000000005',
   'a9000000-0000-4000-8000-000000000503', 'a5000000-0000-4000-8000-000000000002',
   NULL, 'medium',   'pending', now() - interval '3 days'),
  ('b2000000-0000-4000-8000-000000000015', 'b1000000-0000-4000-8000-000000000005',
   'a9000000-0000-4000-8000-000000000504', 'a5000000-0000-4000-8000-000000000003',
   NULL, 'high',     'pending', now() - interval '3 days');

-- Treatments recommended during monitoring.
-- action_treatment_id NULL + status 'pending' = still outstanding.
-- treatment_match is only meaningful once linked; it compares material,
-- action_type, unit and dosage against the action treatment (lib/report-status.ts).
INSERT INTO public.monitoring_treatments
  (id, monitoring_report_id, material_id, dosage, unit_type_id, action_type_id,
   status, notes, action_treatment_id, treatment_match)
VALUES
  -- RA1 — open
  ('b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000002', 50.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'לרסס בהקדם', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002',
   'a6000000-0000-4000-8000-000000000006', 75.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'טיפול פטרייתי דחוף', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000003',
   'a6000000-0000-4000-8000-000000000005', 30.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'מלכודות + ריסוס', NULL, NULL),

  -- RA2 — first entry fulfilled (exact match), second still open
  ('b4000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000004',
   'a6000000-0000-4000-8000-000000000003', 3.00, 'a7000000-0000-4000-8000-000000000003',
   'spread', 'completed', 'פיזור גופרית', 'b5000000-0000-4000-8000-000000000001', TRUE),
  ('b4000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000005',
   'a6000000-0000-4000-8000-000000000006', 75.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'ממתין לביצוע', NULL, NULL),

  -- RA3 — both fulfilled; the second was executed at a higher dosage,
  -- so treatment_match is FALSE
  ('b4000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000006',
   'a6000000-0000-4000-8000-000000000008', 100.00, 'a7000000-0000-4000-8000-000000000004',
   'spray', 'completed', 'טיפול ביולוגי', 'b5000000-0000-4000-8000-000000000002', TRUE),
  ('b4000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000007',
   'a6000000-0000-4000-8000-000000000001', 40.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'completed', 'המלצה: 40 מ"ל', 'b5000000-0000-4000-8000-000000000003', FALSE),

  -- RA4 — open
  ('b4000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000008',
   'a6000000-0000-4000-8000-000000000007', 1.00, 'a7000000-0000-4000-8000-000000000002',
   'drench', 'pending', 'דישון משלים', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-000000000009',
   'a6000000-0000-4000-8000-000000000006', 1.00, 'a7000000-0000-4000-8000-000000000002',
   'drench', 'pending', 'טיפול שורשים דחוף', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000010',
   'a6000000-0000-4000-8000-000000000009', 250.00, 'a7000000-0000-4000-8000-000000000004',
   'spray', 'pending', 'טיפול עשבייה', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000011', 'b2000000-0000-4000-8000-000000000011',
   'a6000000-0000-4000-8000-000000000002', 50.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'כנימות על צימוח צעיר', NULL, NULL),

  -- RA5 indoor — open
  ('b4000000-0000-4000-8000-000000000012', 'b2000000-0000-4000-8000-000000000012',
   'a6000000-0000-4000-8000-000000000009', 250.00, 'a7000000-0000-4000-8000-000000000004',
   'spray', 'pending', 'כשותית בבית צמיחה', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000013', 'b2000000-0000-4000-8000-000000000013',
   'a6000000-0000-4000-8000-000000000007', 1.00, 'a7000000-0000-4000-8000-000000000002',
   'drench', 'pending', 'השלמת אשלגן', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000014', 'b2000000-0000-4000-8000-000000000014',
   'a6000000-0000-4000-8000-000000000001', 40.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'אקריות במנהרה 2', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000015', 'b2000000-0000-4000-8000-000000000015',
   'a6000000-0000-4000-8000-000000000010', 25.00, 'a7000000-0000-4000-8000-000000000001',
   'spray', 'pending', 'טיפול פטרייתי', NULL, NULL);

COMMIT;


-- -----------------------------------------------------------------------------
-- Section H — verification
-- -----------------------------------------------------------------------------

\echo ''
\echo '=== seeded row counts ==='
SELECT 'auth.users'             AS table_name, count(*) FROM auth.users
UNION ALL SELECT 'auth.identities',        count(*) FROM auth.identities
UNION ALL SELECT 'customers',              count(*) FROM public.customers
UNION ALL SELECT 'workers',                count(*) FROM public.workers
UNION ALL SELECT 'user_roles',             count(*) FROM public.user_roles
UNION ALL SELECT 'crops',                  count(*) FROM public.crops
UNION ALL SELECT 'findings',               count(*) FROM public.findings
UNION ALL SELECT 'materials',              count(*) FROM public.materials
UNION ALL SELECT 'unit_types',             count(*) FROM public.unit_types
UNION ALL SELECT 'crop_findings',          count(*) FROM public.crop_findings
UNION ALL SELECT 'recommend_material',     count(*) FROM public.recommend_material
UNION ALL SELECT 'areas',                  count(*) FROM public.areas
UNION ALL SELECT 'sub_areas',              count(*) FROM public.sub_areas
UNION ALL SELECT 'customer_areas',         count(*) FROM public.customer_areas
UNION ALL SELECT 'report_areas',           count(*) FROM public.report_areas
UNION ALL SELECT 'monitoring_area_report', count(*) FROM public.monitoring_area_report
UNION ALL SELECT 'actions_area_report',    count(*) FROM public.actions_area_report
UNION ALL SELECT 'monitoring_treatments',  count(*) FROM public.monitoring_treatments
UNION ALL SELECT 'action_treatments',      count(*) FROM public.action_treatments
ORDER BY 1;

\echo ''
\echo '=== geometry coverage (must be 0 missing) ==='
SELECT
  (SELECT count(*) FROM public.areas     WHERE geometry IS NULL) AS areas_missing_geometry,
  (SELECT count(*) FROM public.sub_areas WHERE geometry IS NULL) AS sub_areas_missing_geometry,
  (SELECT count(*) FROM public.areas     WHERE geometry IS NOT NULL) AS areas_with_geometry,
  (SELECT count(*) FROM public.sub_areas WHERE geometry IS NOT NULL) AS sub_areas_with_geometry;

\echo ''
\echo '=== monitoring status by report ==='
SELECT ra.name, ra.status, ra.completion_percentage,
       count(m.id) FILTER (WHERE m.status = 'pending')   AS pending_entries,
       count(m.id) FILTER (WHERE m.status = 'completed') AS completed_entries
FROM public.report_areas ra
LEFT JOIN public.monitoring_area_report m ON m.area_report_id = ra.id
WHERE ra.area_type_id = 'monitoring'
GROUP BY ra.id, ra.name, ra.status, ra.completion_percentage
ORDER BY ra.name;

\echo ''
\echo 'Done. Login: admin@example.com/admin123, customer@example.com/test123,'
\echo '             inspector@example.com/test123, worker@example.com/test123'
\echo ''
