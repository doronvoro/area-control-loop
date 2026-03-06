-- Delete all data from tables in correct order (respecting foreign key constraints)
-- Run with: psql or Supabase SQL editor

BEGIN;

-- 1. Leaf tables (no dependents)
DELETE FROM monitoring_treatments;
DELETE FROM action_treatments;
DELETE FROM report_areas;

DELETE FROM crop_findings;
DELETE FROM recommend_material;
DELETE FROM pesticide_registry;
DELETE FROM import_batches;

-- 2. Report tables
DELETE FROM monitoring_area_report;
DELETE FROM actions_area_report;

-- 3. Base/lookup tables
DELETE FROM crops;
DELETE FROM materials;
DELETE FROM findings;
DELETE FROM unit_types;
DELETE FROM action_types;

COMMIT;
