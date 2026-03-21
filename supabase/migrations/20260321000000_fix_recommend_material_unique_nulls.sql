-- Fix unique constraint on recommend_material to handle NULL values.
-- PostgreSQL UNIQUE constraints treat NULLs as distinct, so
-- ON CONFLICT never matches when finding_id, action_type_id, or unit_type_id are NULL.
-- Solution: use a unique INDEX with COALESCE to treat NULLs as a sentinel value.

-- Drop the old constraint that doesn't handle NULLs
ALTER TABLE recommend_material
  DROP CONSTRAINT IF EXISTS recommend_material_unique_key;

-- Remove duplicate rows before creating the unique index.
-- Keep the row with the latest updated_at (or created_at) for each unique combo.
DELETE FROM recommend_material
WHERE id NOT IN (
  SELECT DISTINCT ON (
    crop_id,
    COALESCE(finding_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(action_type_id, '__none__'),
    material_id,
    COALESCE(unit_type_id, '00000000-0000-0000-0000-000000000000')
  ) id
  FROM recommend_material
  ORDER BY
    crop_id,
    COALESCE(finding_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(action_type_id, '__none__'),
    material_id,
    COALESCE(unit_type_id, '00000000-0000-0000-0000-000000000000'),
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST
);

-- Create a unique index with COALESCE for nullable columns
CREATE UNIQUE INDEX recommend_material_unique_key
  ON recommend_material (
    crop_id,
    COALESCE(finding_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(action_type_id, '__none__'),
    material_id,
    COALESCE(unit_type_id, '00000000-0000-0000-0000-000000000000')
  );
