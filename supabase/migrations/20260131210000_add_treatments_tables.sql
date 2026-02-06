-- =============================================
-- Migration: Add Treatments Tables
-- Date: 2026-01-31
-- Description: Restructure reports to support multiple treatments per sub_area/finding
-- =============================================

-- =============================================
-- 1. Create monitoring_treatments table
-- =============================================
CREATE TABLE IF NOT EXISTS monitoring_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoring_report_id UUID NOT NULL REFERENCES monitoring_area_report(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  dosage NUMERIC,
  unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,
  action_type_id UUID REFERENCES action_types(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_treatments_report_id ON monitoring_treatments(monitoring_report_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_treatments_status ON monitoring_treatments(status);

-- =============================================
-- 2. Create action_treatments table
-- =============================================
CREATE TABLE IF NOT EXISTS action_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_report_id UUID NOT NULL REFERENCES actions_area_report(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  dosage NUMERIC,
  unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,
  action_type_id UUID REFERENCES action_types(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  action_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_treatments_report_id ON action_treatments(action_report_id);
CREATE INDEX IF NOT EXISTS idx_action_treatments_status ON action_treatments(status);

-- =============================================
-- 3. Clean up duplicate rows before adding constraints
-- =============================================

-- Delete duplicate monitoring_area_report rows, keeping the most recent one
DELETE FROM monitoring_area_report mar1
WHERE EXISTS (
  SELECT 1 FROM monitoring_area_report mar2
  WHERE mar2.area_report_id = mar1.area_report_id
    AND mar2.sub_area_id = mar1.sub_area_id
    AND mar2.finding_id = mar1.finding_id
    AND mar2.created_at > mar1.created_at
);

-- If duplicates still exist (same created_at), keep the one with smaller id
DELETE FROM monitoring_area_report mar1
WHERE EXISTS (
  SELECT 1 FROM monitoring_area_report mar2
  WHERE mar2.area_report_id = mar1.area_report_id
    AND mar2.sub_area_id = mar1.sub_area_id
    AND mar2.finding_id = mar1.finding_id
    AND mar2.id < mar1.id
);

-- Delete duplicate actions_area_report rows, keeping the most recent one
DELETE FROM actions_area_report aar1
WHERE EXISTS (
  SELECT 1 FROM actions_area_report aar2
  WHERE aar2.area_report_id = aar1.area_report_id
    AND aar2.sub_area_id = aar1.sub_area_id
    AND aar2.finding_id = aar1.finding_id
    AND aar2.created_at > aar1.created_at
);

-- If duplicates still exist (same created_at), keep the one with smaller id
DELETE FROM actions_area_report aar1
WHERE EXISTS (
  SELECT 1 FROM actions_area_report aar2
  WHERE aar2.area_report_id = aar1.area_report_id
    AND aar2.sub_area_id = aar1.sub_area_id
    AND aar2.finding_id = aar1.finding_id
    AND aar2.id < aar1.id
);

-- =============================================
-- 4. Update unique constraints
-- =============================================
-- Monitoring: Change from (area_report_id, sub_area_id) to (area_report_id, sub_area_id, finding_id)
ALTER TABLE monitoring_area_report
  DROP CONSTRAINT IF EXISTS monitoring_area_report_area_report_id_sub_area_id_key;

ALTER TABLE monitoring_area_report
  DROP CONSTRAINT IF EXISTS monitoring_area_report_unique_key;

ALTER TABLE monitoring_area_report
  ADD CONSTRAINT monitoring_area_report_unique_key
  UNIQUE (area_report_id, sub_area_id, finding_id);

-- Actions: Add unique constraint (may not exist)
ALTER TABLE actions_area_report
  DROP CONSTRAINT IF EXISTS actions_area_report_unique_key;

ALTER TABLE actions_area_report
  ADD CONSTRAINT actions_area_report_unique_key
  UNIQUE (area_report_id, sub_area_id, finding_id);

-- =============================================
-- 5. Migrate existing data to treatment tables
-- =============================================
-- Monitoring treatments (only if columns exist and have data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_area_report' AND column_name = 'recommend_material_id'
  ) THEN
    INSERT INTO monitoring_treatments (monitoring_report_id, material_id, dosage, unit_type_id, action_type_id, status)
    SELECT
      id,
      recommend_material_id,
      CASE
        WHEN recommend_dosage IS NULL THEN NULL
        WHEN recommend_dosage::TEXT ~ '^[0-9.]+$' THEN recommend_dosage::NUMERIC
        ELSE NULL
      END,
      recommend_unit_type_id,
      recommend_action_type_id,
      status
    FROM monitoring_area_report
    WHERE recommend_material_id IS NOT NULL
       OR recommend_action_type_id IS NOT NULL;
  END IF;
END $$;

-- Action treatments (only if columns exist and have data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions_area_report' AND column_name = 'action_type_id'
  ) THEN
    INSERT INTO action_treatments (action_report_id, dosage, unit_type_id, action_type_id, status, notes, action_time)
    SELECT
      id,
      CASE WHEN dosage::TEXT ~ '^[0-9.]+$' THEN dosage::NUMERIC ELSE NULL END,
      unit_type_id,
      action_type_id,
      status,
      notes,
      action_time
    FROM actions_area_report
    WHERE action_type_id IS NOT NULL;
  END IF;
END $$;

-- =============================================
-- 6. Enable RLS on treatment tables
-- =============================================
ALTER TABLE monitoring_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_treatments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. RLS Policies for monitoring_treatments
-- =============================================
DROP POLICY IF EXISTS "Admins can manage monitoring treatments" ON monitoring_treatments;
CREATE POLICY "Admins can manage monitoring treatments"
  ON monitoring_treatments FOR ALL
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Inspectors can manage monitoring treatments" ON monitoring_treatments;
CREATE POLICY "Inspectors can manage monitoring treatments"
  ON monitoring_treatments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'inspector'
    )
  );

-- =============================================
-- 8. RLS Policies for action_treatments
-- =============================================
DROP POLICY IF EXISTS "Admins can manage action treatments" ON action_treatments;
CREATE POLICY "Admins can manage action treatments"
  ON action_treatments FOR ALL
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Action workers can manage action treatments" ON action_treatments;
CREATE POLICY "Action workers can manage action treatments"
  ON action_treatments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'action_worker'
    )
  );

-- =============================================
-- 9. Remove deprecated columns from monitoring_area_report
-- =============================================
ALTER TABLE monitoring_area_report
  DROP COLUMN IF EXISTS recommend_material_id,
  DROP COLUMN IF EXISTS recommend_dosage,
  DROP COLUMN IF EXISTS recommend_unit_type_id,
  DROP COLUMN IF EXISTS recommend_action_type_id;

-- =============================================
-- 10. Remove deprecated columns from actions_area_report
-- =============================================
ALTER TABLE actions_area_report
  DROP COLUMN IF EXISTS material,
  DROP COLUMN IF EXISTS dosage,
  DROP COLUMN IF EXISTS unit_type_id,
  DROP COLUMN IF EXISTS action_type_id,
  DROP COLUMN IF EXISTS action_time,
  DROP COLUMN IF EXISTS notes;
