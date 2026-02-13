-- Migration: Add status columns back to monitoring_area_report and actions_area_report
-- Also add treatment_match to monitoring_treatments and completion_percentage to report_areas

-- Step 1: Add status columns
ALTER TABLE monitoring_area_report ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE actions_area_report ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Step 2: Add treatment_match to monitoring_treatments
ALTER TABLE monitoring_treatments ADD COLUMN IF NOT EXISTS treatment_match BOOLEAN;

-- Step 3: Add completion_percentage to report_areas
ALTER TABLE report_areas ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_area_report_status ON monitoring_area_report(status);
CREATE INDEX IF NOT EXISTS idx_actions_area_report_status ON actions_area_report(status);

-- Step 5: Backfill monitoring_area_report status
-- If all treatments have action_treatment_id → completed
UPDATE monitoring_area_report mar SET status = 'completed'
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring_treatments mt
  WHERE mt.monitoring_report_id = mar.id
  AND mt.action_treatment_id IS NULL
)
AND EXISTS (
  SELECT 1 FROM monitoring_treatments mt WHERE mt.monitoring_report_id = mar.id
);

-- Step 6: Backfill treatment_match for already-linked treatments
UPDATE monitoring_treatments mt
SET treatment_match = (
  mt.material_id IS NOT DISTINCT FROM at.material_id
  AND mt.action_type_id IS NOT DISTINCT FROM at.action_type_id
  AND mt.dosage IS NOT DISTINCT FROM at.dosage
  AND mt.unit_type_id IS NOT DISTINCT FROM at.unit_type_id
)
FROM action_treatments at
WHERE mt.action_treatment_id = at.id;

-- Step 7: Backfill completion_percentage on monitoring report_areas
UPDATE report_areas ra
SET completion_percentage = COALESCE(
  (
    SELECT CASE WHEN total = 0 THEN 0
    ELSE ROUND((completed::NUMERIC / total) * 100)::INTEGER
    END
    FROM (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE mar.status = 'completed') AS completed
      FROM monitoring_area_report mar
      WHERE mar.area_report_id = ra.id
    ) counts
  ), 0
),
status = CASE
  WHEN (
    SELECT COUNT(*) FROM monitoring_area_report mar WHERE mar.area_report_id = ra.id
  ) = 0 THEN 'pending'
  WHEN (
    SELECT COUNT(*) FILTER (WHERE mar.status = 'completed')
    FROM monitoring_area_report mar WHERE mar.area_report_id = ra.id
  ) = (
    SELECT COUNT(*) FROM monitoring_area_report mar WHERE mar.area_report_id = ra.id
  ) THEN 'completed'
  WHEN (
    SELECT COUNT(*) FILTER (WHERE mar.status = 'completed')
    FROM monitoring_area_report mar WHERE mar.area_report_id = ra.id
  ) > 0 THEN 'in_progress'
  ELSE 'pending'
END
WHERE ra.area_type_id = 'monitoring';
