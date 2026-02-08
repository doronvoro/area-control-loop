-- Add size and size_unit_type columns to areas table
-- size_unit_type stores the unit name directly (e.g., 'dunam') - not a FK
ALTER TABLE areas
ADD COLUMN size DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN size_unit_type VARCHAR(50) DEFAULT 'dunam';

-- Add size and size_unit_type columns to sub_areas table
ALTER TABLE sub_areas
ADD COLUMN size DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN size_unit_type VARCHAR(50) DEFAULT 'dunam';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_areas_size_unit_type ON areas(size_unit_type);
CREATE INDEX IF NOT EXISTS idx_sub_areas_size_unit_type ON sub_areas(size_unit_type);
