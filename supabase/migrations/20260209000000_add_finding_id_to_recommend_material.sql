-- Add finding_id to recommend_material table
-- This enables pest-specific (finding-specific) treatment recommendations
-- NULL finding_id = crop-level default recommendation

-- Add finding_id column
ALTER TABLE recommend_material
  ADD COLUMN IF NOT EXISTS finding_id UUID REFERENCES findings(id) ON DELETE RESTRICT;

-- Create index for finding_id lookups
CREATE INDEX IF NOT EXISTS idx_recommend_material_finding_id ON recommend_material(finding_id);

-- Drop old unique constraint
ALTER TABLE recommend_material
  DROP CONSTRAINT IF EXISTS recommend_material_crop_id_action_type_id_material_id_unit_t_key;

-- Add new unique constraint that includes finding_id
-- Note: PostgreSQL treats NULL as distinct, so multiple NULL finding_id records are allowed
ALTER TABLE recommend_material
  ADD CONSTRAINT recommend_material_unique_key
  UNIQUE(crop_id, finding_id, action_type_id, material_id, unit_type_id);

-- Update composite index to include finding_id
DROP INDEX IF EXISTS idx_recommend_material_key;
CREATE INDEX idx_recommend_material_key ON recommend_material(crop_id, finding_id, action_type_id, material_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN recommend_material.finding_id IS 'Optional finding ID for finding-specific recommendations. NULL means crop-level default recommendation.';
