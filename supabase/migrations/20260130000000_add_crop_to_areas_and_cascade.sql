-- Add crop_id to areas table
ALTER TABLE areas ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES crops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_areas_crop_id ON areas(crop_id);

-- Add crop_id to sub_areas table (nullable - inherits from area if empty)
ALTER TABLE sub_areas ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES crops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sub_areas_crop_id ON sub_areas(crop_id);

-- Create crop_findings junction table (findings available per crop)
CREATE TABLE IF NOT EXISTS crop_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crop_id, finding_id)
);

CREATE INDEX IF NOT EXISTS idx_crop_findings_crop_id ON crop_findings(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_findings_finding_id ON crop_findings(finding_id);

-- RLS policies for crop_findings
ALTER TABLE crop_findings ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Allow read access" ON crop_findings;
CREATE POLICY "Allow read access" ON crop_findings FOR SELECT USING (true);

-- Allow admins to manage crop_findings
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

-- Add RLS policies for crops, materials tables if not already exists
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE recommend_material ENABLE ROW LEVEL SECURITY;
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
