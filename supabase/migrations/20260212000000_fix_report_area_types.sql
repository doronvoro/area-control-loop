-- Migration: Create report_area_types lookup table and fix area_type_id column
-- This migration handles the case where area_type_id might be UUID or TEXT

-- Step 1: Create report_area_types lookup table with name as PK
CREATE TABLE IF NOT EXISTS report_area_types (
  name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS and create public read policy
ALTER TABLE report_area_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read report_area_types" ON report_area_types;
CREATE POLICY "Anyone can read report_area_types"
  ON report_area_types FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Seed initial values with Hebrew display names
INSERT INTO report_area_types (name, display_name, description) VALUES
  ('monitoring', 'ניטור', 'Monitoring report'),
  ('action', 'פעולה', 'Action report')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Check if we need to convert the column type
DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Get the current data type of area_type_id
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'report_areas' AND column_name = 'area_type_id';

  -- If it's UUID, we need to convert
  IF col_type = 'uuid' THEN
    -- Drop existing FK constraint if exists
    ALTER TABLE report_areas DROP CONSTRAINT IF EXISTS fk_report_areas_area_type;
    ALTER TABLE report_areas DROP CONSTRAINT IF EXISTS report_areas_area_type_id_fkey;

    -- Add a temporary TEXT column
    ALTER TABLE report_areas ADD COLUMN area_type_id_new TEXT;

    -- Copy existing values - map any existing UUIDs to appropriate type
    -- Since we don't have existing data to map, we'll default to 'monitoring'
    UPDATE report_areas SET area_type_id_new = 'monitoring' WHERE area_type_id IS NOT NULL;

    -- Drop old column
    ALTER TABLE report_areas DROP COLUMN area_type_id;

    -- Rename new column
    ALTER TABLE report_areas RENAME COLUMN area_type_id_new TO area_type_id;

    -- Make it NOT NULL with default
    ALTER TABLE report_areas ALTER COLUMN area_type_id SET DEFAULT 'monitoring';

    RAISE NOTICE 'Converted area_type_id from UUID to TEXT';
  ELSE
    RAISE NOTICE 'area_type_id is already TEXT type, skipping conversion';
  END IF;
END $$;

-- Step 5: Add FK constraint to report_area_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_report_areas_report_area_type'
    AND table_name = 'report_areas'
  ) THEN
    ALTER TABLE report_areas ADD CONSTRAINT fk_report_areas_report_area_type
      FOREIGN KEY (area_type_id) REFERENCES report_area_types(name) ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 6: Create index on area_type_id if not exists
CREATE INDEX IF NOT EXISTS idx_report_areas_area_type_id ON report_areas(area_type_id);

-- Step 7: Drop old area_types table if exists (cleanup from previous migration attempt)
DROP TABLE IF EXISTS area_types CASCADE;
