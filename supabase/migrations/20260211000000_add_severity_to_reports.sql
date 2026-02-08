-- Add severity enum type and column to monitoring and action reports

-- Create severity enum type
CREATE TYPE report_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Add severity column to monitoring_area_report
ALTER TABLE monitoring_area_report
ADD COLUMN severity report_severity NULL;

-- Add severity column to actions_area_report
ALTER TABLE actions_area_report
ADD COLUMN severity report_severity NULL;

-- Add comments for documentation
COMMENT ON COLUMN monitoring_area_report.severity IS 'Severity level of the monitoring report finding';
COMMENT ON COLUMN actions_area_report.severity IS 'Severity level of the action report finding';
