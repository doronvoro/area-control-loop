-- Clean all report data
-- Run this in Supabase SQL Editor or via psql

BEGIN;

-- Delete in order respecting foreign key constraints
-- monitoring_treatments must go first (FK → action_treatments via action_treatment_id)

DELETE FROM monitoring_treatments;
DELETE FROM action_treatments;
DELETE FROM monitoring_area_report;
DELETE FROM actions_area_report;
DELETE FROM report_areas;

COMMIT;

-- Verify counts are zero
SELECT 'monitoring_treatments' as table_name, COUNT(*) as count FROM monitoring_treatments
UNION ALL
SELECT 'action_treatments', COUNT(*) FROM action_treatments
UNION ALL
SELECT 'monitoring_area_report', COUNT(*) FROM monitoring_area_report
UNION ALL
SELECT 'actions_area_report', COUNT(*) FROM actions_area_report
UNION ALL
SELECT 'report_areas', COUNT(*) FROM report_areas;
