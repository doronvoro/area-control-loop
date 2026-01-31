-- =====================================================
-- Combined Migration: crops, materials, recommend_material, crop_findings
-- =====================================================

-- 1. Create Materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);

-- 2. Create Crops table
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_name ON crops(name);

-- 3. Create/Recreate recommend_material table with correct structure
DROP TABLE IF EXISTS recommend_material CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_recommend_material_crop_id ON recommend_material(crop_id);
CREATE INDEX IF NOT EXISTS idx_recommend_material_action_type_id ON recommend_material(action_type_id);
CREATE INDEX IF NOT EXISTS idx_recommend_material_material_id ON recommend_material(material_id);
CREATE INDEX IF NOT EXISTS idx_recommend_material_unit_type_id ON recommend_material(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_recommend_material_key ON recommend_material(crop_id, action_type_id, material_id);

-- 4. Update monitoring_area_report table
ALTER TABLE monitoring_area_report
  ADD COLUMN IF NOT EXISTS recommend_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommend_dosage DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_monitoring_area_report_recommend_material_id
  ON monitoring_area_report(recommend_material_id);

-- 5. Add crop_id to areas table
ALTER TABLE areas ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES crops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_areas_crop_id ON areas(crop_id);

-- 6. Add crop_id to sub_areas table
ALTER TABLE sub_areas ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES crops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sub_areas_crop_id ON sub_areas(crop_id);

-- 7. Create crop_findings junction table
CREATE TABLE IF NOT EXISTS crop_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crop_id, finding_id)
);

CREATE INDEX IF NOT EXISTS idx_crop_findings_crop_id ON crop_findings(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_findings_finding_id ON crop_findings(finding_id);

-- 8. Enable RLS on new tables
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommend_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_findings ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for crops
DROP POLICY IF EXISTS "Allow read access crops" ON crops;
CREATE POLICY "Allow read access crops" ON crops FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin manage crops" ON crops;
CREATE POLICY "Allow admin manage crops" ON crops
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- 10. RLS Policies for materials
DROP POLICY IF EXISTS "Allow read access materials" ON materials;
CREATE POLICY "Allow read access materials" ON materials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin manage materials" ON materials;
CREATE POLICY "Allow admin manage materials" ON materials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- 11. RLS Policies for recommend_material
DROP POLICY IF EXISTS "Allow read access recommend_material" ON recommend_material;
CREATE POLICY "Allow read access recommend_material" ON recommend_material FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin manage recommend_material" ON recommend_material;
CREATE POLICY "Allow admin manage recommend_material" ON recommend_material
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- 12. RLS Policies for crop_findings
DROP POLICY IF EXISTS "Allow read access" ON crop_findings;
CREATE POLICY "Allow read access" ON crop_findings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin insert" ON crop_findings;
CREATE POLICY "Allow admin insert" ON crop_findings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow admin update" ON crop_findings;
CREATE POLICY "Allow admin update" ON crop_findings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow admin delete" ON crop_findings;
CREATE POLICY "Allow admin delete" ON crop_findings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );