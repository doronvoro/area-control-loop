-- Add worker_id column to report_areas table to track who created the report
ALTER TABLE report_areas
ADD COLUMN worker_id UUID REFERENCES workers(id) ON DELETE SET NULL;

-- Add index for faster queries by worker
CREATE INDEX idx_report_areas_worker_id ON report_areas(worker_id);

-- Add comment for documentation
COMMENT ON COLUMN report_areas.worker_id IS 'The worker (inspector/action_worker) who created this report';
