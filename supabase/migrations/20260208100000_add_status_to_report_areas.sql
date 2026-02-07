-- Migration: Add status column to report_areas and remove from child tables
-- This simplifies the data model by having status at the report level

-- Step 1: Add status column to report_areas
ALTER TABLE report_areas ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Step 2: Create index on status
CREATE INDEX idx_report_areas_status ON report_areas(status);

-- Step 3: Migrate status from child tables
-- Set status based on child records (prioritize: pending > in_progress > completed)
UPDATE report_areas ra
SET status = COALESCE(
  (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM monitoring_area_report mar
          WHERE mar.area_report_id = ra.id AND mar.status = 'pending'
        ) OR EXISTS (
          SELECT 1 FROM actions_area_report aar
          WHERE aar.area_report_id = ra.id AND aar.status = 'pending'
        ) THEN 'pending'
        WHEN EXISTS (
          SELECT 1 FROM monitoring_area_report mar
          WHERE mar.area_report_id = ra.id AND mar.status = 'in_progress'
        ) OR EXISTS (
          SELECT 1 FROM actions_area_report aar
          WHERE aar.area_report_id = ra.id AND aar.status IN ('in_progress', 'planned')
        ) THEN 'in_progress'
        WHEN EXISTS (
          SELECT 1 FROM monitoring_area_report mar
          WHERE mar.area_report_id = ra.id AND mar.status = 'completed'
        ) OR EXISTS (
          SELECT 1 FROM actions_area_report aar
          WHERE aar.area_report_id = ra.id AND aar.status = 'completed'
        ) THEN 'completed'
        ELSE 'pending'
      END
  ),
  'pending'
);

-- Step 4: Drop status column from monitoring_area_report
ALTER TABLE monitoring_area_report DROP COLUMN status;

-- Step 5: Drop status column from actions_area_report
ALTER TABLE actions_area_report DROP COLUMN status;
