-- Convert action_type_id from UUID (FK to action_types) to TEXT enum values
-- Values: 'spray', 'drench', 'spread'

-- 1. Drop FK constraints first
ALTER TABLE monitoring_treatments DROP CONSTRAINT IF EXISTS monitoring_treatments_action_type_id_fkey;
ALTER TABLE action_treatments DROP CONSTRAINT IF EXISTS action_treatments_action_type_id_fkey;
ALTER TABLE recommend_material DROP CONSTRAINT IF EXISTS recommend_material_action_type_id_fkey;

-- 2. Add temporary text columns to hold the mapped names
ALTER TABLE monitoring_treatments ADD COLUMN action_type_name TEXT;
ALTER TABLE action_treatments ADD COLUMN action_type_name TEXT;
ALTER TABLE recommend_material ADD COLUMN action_type_name TEXT;

-- 3. Populate temp columns with action type names from lookup
UPDATE monitoring_treatments mt
SET action_type_name = at.name
FROM action_types at
WHERE mt.action_type_id = at.id;

UPDATE action_treatments at_tbl
SET action_type_name = at.name
FROM action_types at
WHERE at_tbl.action_type_id = at.id;

UPDATE recommend_material rm
SET action_type_name = at.name
FROM action_types at
WHERE rm.action_type_id = at.id;

-- 4. Drop the old UUID columns and rename the text columns
ALTER TABLE monitoring_treatments DROP COLUMN action_type_id;
ALTER TABLE monitoring_treatments RENAME COLUMN action_type_name TO action_type_id;

ALTER TABLE action_treatments DROP COLUMN action_type_id;
ALTER TABLE action_treatments RENAME COLUMN action_type_name TO action_type_id;

ALTER TABLE recommend_material DROP COLUMN action_type_id;
ALTER TABLE recommend_material RENAME COLUMN action_type_name TO action_type_id;

-- 5. Add CHECK constraints for valid enum values
ALTER TABLE monitoring_treatments ADD CONSTRAINT monitoring_treatments_action_type_check
  CHECK (action_type_id IS NULL OR action_type_id IN ('spray', 'drench', 'spread'));

ALTER TABLE action_treatments ADD CONSTRAINT action_treatments_action_type_check
  CHECK (action_type_id IS NULL OR action_type_id IN ('spray', 'drench', 'spread'));

ALTER TABLE recommend_material ADD CONSTRAINT recommend_material_action_type_check
  CHECK (action_type_id IS NULL OR action_type_id IN ('spray', 'drench', 'spread'));

-- 6. Drop the action_types table (no longer needed)
DROP INDEX IF EXISTS idx_action_types_name;
DROP TABLE IF EXISTS action_types;
