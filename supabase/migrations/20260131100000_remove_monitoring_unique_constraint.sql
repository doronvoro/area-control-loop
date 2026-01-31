-- Remove unique constraint on monitoring_area_report to allow multiple findings per sub-area
-- This enables inspectors to record multiple findings for the same sub-area in a single report

ALTER TABLE monitoring_area_report
DROP CONSTRAINT IF EXISTS monitoring_area_report_area_report_id_sub_area_id_key;
