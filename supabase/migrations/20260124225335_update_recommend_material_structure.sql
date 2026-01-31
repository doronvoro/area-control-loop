-- Update recommend_material table structure
-- Remove finding_id, change dosage to DECIMAL
-- Key: (crop_id, action_type_id, material_id) => Value: array of {unit_type_id, dosage}

-- First, drop the old recommend_material table if it exists with finding_id
DROP TABLE IF EXISTS recommend_material CASCADE;

-- Recreate recommend_material table with new structure
CREATE TABLE recommend_material (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  action_type_id UUID NOT NULL REFERENCES action_types(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  unit_type_id UUID NOT NULL REFERENCES unit_types(id) ON DELETE RESTRICT,
  dosage DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crop_id, action_type_id, material_id, unit_type_id)
);

CREATE INDEX idx_recommend_material_crop_id ON recommend_material(crop_id);
CREATE INDEX idx_recommend_material_action_type_id ON recommend_material(action_type_id);
CREATE INDEX idx_recommend_material_material_id ON recommend_material(material_id);
CREATE INDEX idx_recommend_material_unit_type_id ON recommend_material(unit_type_id);
CREATE INDEX idx_recommend_material_key ON recommend_material(crop_id, action_type_id, material_id);

-- Update monitoring_area_report table
-- Change recommend_material from TEXT to UUID (recommend_material_id)
-- Change recommend_dosage from TEXT to DECIMAL

-- Add new columns
ALTER TABLE monitoring_area_report 
  ADD COLUMN IF NOT EXISTS recommend_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommend_dosage_new DECIMAL(10, 2);

-- Migrate existing data if any (optional - you may want to handle this differently)
-- This assumes recommend_material was storing material names that match materials.name
-- UPDATE monitoring_area_report mar
-- SET recommend_material_id = (
--   SELECT m.id FROM materials m 
--   WHERE m.name = mar.recommend_material 
--   LIMIT 1
-- )
-- WHERE mar.recommend_material IS NOT NULL;

-- Migrate dosage from TEXT to DECIMAL
UPDATE monitoring_area_report
SET recommend_dosage_new = CAST(recommend_dosage AS DECIMAL)
WHERE recommend_dosage IS NOT NULL 
  AND recommend_dosage ~ '^[0-9]+\.?[0-9]*$';

-- Drop old columns
ALTER TABLE monitoring_area_report 
  DROP COLUMN IF EXISTS recommend_material,
  DROP COLUMN IF EXISTS recommend_dosage;

-- Rename new columns (only if they don't already exist with the correct name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'monitoring_area_report' 
             AND column_name = 'recommend_material_id') THEN
    -- Column already exists, do nothing
  ELSE
    ALTER TABLE monitoring_area_report 
      RENAME COLUMN recommend_material_id TO recommend_material_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'monitoring_area_report' 
             AND column_name = 'recommend_dosage_new') THEN
    ALTER TABLE monitoring_area_report 
      RENAME COLUMN recommend_dosage_new TO recommend_dosage;
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_monitoring_area_report_recommend_material_id 
  ON monitoring_area_report(recommend_material_id);

COMMENT ON TABLE recommend_material IS 'Stores material recommendations: key (crop_id, action_type_id, material_id) => value (array of {unit_type_id, dosage})';
COMMENT ON COLUMN recommend_material.dosage IS 'Dosage value as decimal';
COMMENT ON COLUMN monitoring_area_report.recommend_material_id IS 'Reference to materials table';
COMMENT ON COLUMN monitoring_area_report.recommend_dosage IS 'Recommended dosage as decimal';
