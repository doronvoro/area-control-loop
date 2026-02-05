-- Clean all report data
-- Run this in Supabase SQL Editor or via psql

-- Delete in order respecting foreign key constraints

-- 1. Delete action treatments
DELETE FROM action_treatments;

-- 2. Delete monitoring treatments
DELETE FROM monitoring_treatments;

-- 3. Delete action reports
DELETE FROM actions_area_report;

-- 4. Delete monitoring reports
DELETE FROM monitoring_area_report;

-- 5. Delete report areas
DELETE FROM report_areas;

-- Verify counts are zero
SELECT 'action_treatments' as table_name, COUNT(*) as count FROM action_treatments
UNION ALL
SELECT 'monitoring_treatments', COUNT(*) FROM monitoring_treatments
UNION ALL
SELECT 'actions_area_report', COUNT(*) FROM actions_area_report
UNION ALL
SELECT 'monitoring_area_report', COUNT(*) FROM monitoring_area_report
UNION ALL
SELECT 'report_areas', COUNT(*) FROM report_areas;
