-- Script to clean all report data and ensure correct schema
-- Run with: npx supabase db reset or execute directly in Supabase Studio

-- Step 1: Delete all data from report-related tables (in correct order due to FK constraints)
TRUNCATE TABLE action_treatments CASCADE;
TRUNCATE TABLE monitoring_treatments CASCADE;
TRUNCATE TABLE actions_area_report CASCADE;
TRUNCATE TABLE monitoring_area_report CASCADE;
TRUNCATE TABLE report_areas CASCADE;

-- Step 2: Verify report_area_types table structure (should have name as PK, no id column)
DO $$
BEGIN
  -- Check if report_area_types has correct structure
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_area_types' AND column_name = 'id'
  ) THEN
    RAISE NOTICE 'WARNING: report_area_types has an id column - schema may be incorrect';
  ELSE
    RAISE NOTICE 'OK: report_area_types uses name as PK (no id column)';
  END IF;

  -- Check if report_areas.area_type_id exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_areas' AND column_name = 'area_type_id'
  ) THEN
    RAISE NOTICE 'OK: report_areas has area_type_id column';
  ELSE
    RAISE NOTICE 'WARNING: report_areas missing area_type_id column';
  END IF;

  -- Check if report_areas.status exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_areas' AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'OK: report_areas has status column';
  ELSE
    RAISE NOTICE 'WARNING: report_areas missing status column';
  END IF;

  -- Check if monitoring_area_report.status was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_area_report' AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'WARNING: monitoring_area_report still has status column';
  ELSE
    RAISE NOTICE 'OK: monitoring_area_report status column removed';
  END IF;

  -- Check if actions_area_report.status was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions_area_report' AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'WARNING: actions_area_report still has status column';
  ELSE
    RAISE NOTICE 'OK: actions_area_report status column removed';
  END IF;
END $$;

-- Step 3: Show report_area_types data
SELECT * FROM report_area_types;

-- Step 4: Show report_areas structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'report_areas'
ORDER BY ordinal_position;
