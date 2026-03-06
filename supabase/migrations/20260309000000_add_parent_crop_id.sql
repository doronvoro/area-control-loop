-- Add parent_crop_id to crops table for crop hierarchy
-- Allows child crops (e.g., ליים) to inherit recommendations from parent crops (e.g., הדרים)

ALTER TABLE crops ADD COLUMN IF NOT EXISTS parent_crop_id UUID REFERENCES crops(id) ON DELETE SET NULL;

-- Set ליים parent to הדרים
UPDATE crops
SET parent_crop_id = (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1)
WHERE name = 'ליים' AND parent_crop_id IS NULL;
