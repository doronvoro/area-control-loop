-- Make dosage and unit_type_id nullable in recommend_material
-- so rows without parsable dosage can still be inserted as material recommendations
ALTER TABLE recommend_material ALTER COLUMN dosage DROP NOT NULL;
ALTER TABLE recommend_material ALTER COLUMN unit_type_id DROP NOT NULL;
