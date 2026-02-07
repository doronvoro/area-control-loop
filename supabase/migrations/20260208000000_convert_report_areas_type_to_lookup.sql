-- Migration: Convert report_areas.type TEXT column to area_types lookup table
-- Uses name as PK to avoid extra SELECT queries - code can use enum values directly

-- Step 1: Create area_types lookup table with name as PK
CREATE TABLE area_types (
  name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS and create public read policy
ALTER TABLE area_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read area_types"
  ON area_types FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Seed initial values with Hebrew display names
INSERT INTO area_types (name, display_name, description) VALUES
  ('monitoring', 'ניטור', 'Monitoring report'),
  ('action', 'פעולה', 'Action report');

-- Step 4: Rename type column to area_type_id and add FK constraint
ALTER TABLE report_areas RENAME COLUMN type TO area_type_id;
ALTER TABLE report_areas ADD CONSTRAINT fk_report_areas_area_type
  FOREIGN KEY (area_type_id) REFERENCES area_types(name) ON DELETE RESTRICT;

-- Step 5: Create index on area_type_id
CREATE INDEX idx_report_areas_area_type_id ON report_areas(area_type_id);

-- Step 6: Drop old index if exists
DROP INDEX IF EXISTS idx_report_areas_type;
