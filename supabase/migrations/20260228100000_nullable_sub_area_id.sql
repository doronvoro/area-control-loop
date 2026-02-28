-- Make sub_area_id nullable in monitoring and action reports
-- NULL sub_area_id means "entire area selected"
-- A parent sub_area_id (that has children) means "parent + all children"

ALTER TABLE monitoring_area_report ALTER COLUMN sub_area_id DROP NOT NULL;
ALTER TABLE actions_area_report ALTER COLUMN sub_area_id DROP NOT NULL;
