-- Make action_type_id optional in recommend_material
-- NULL action_type_id = recommendation applies regardless of action type

-- Make column nullable
ALTER TABLE recommend_material
  ALTER COLUMN action_type_id DROP NOT NULL;

-- Drop old unique constraint
ALTER TABLE recommend_material
  DROP CONSTRAINT IF EXISTS recommend_material_unique_key;

-- Add new unique constraint (NULL action_type_id treated as distinct by PostgreSQL)
ALTER TABLE recommend_material
  ADD CONSTRAINT recommend_material_unique_key
  UNIQUE(crop_id, finding_id, action_type_id, material_id, unit_type_id);

-- Update composite index
DROP INDEX IF EXISTS idx_recommend_material_key;
CREATE INDEX idx_recommend_material_key ON recommend_material(crop_id, finding_id, action_type_id, material_id);

COMMENT ON COLUMN recommend_material.action_type_id IS 'Optional action type ID. NULL means recommendation applies to all action types.';
