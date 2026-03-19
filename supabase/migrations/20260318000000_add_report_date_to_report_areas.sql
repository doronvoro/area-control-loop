-- Add report_date to report_areas so users can set the actual date and time of the report
ALTER TABLE report_areas
ADD COLUMN report_date TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows: use created_at as their report_date
UPDATE report_areas SET report_date = created_at WHERE report_date IS NOT NULL;
