-- Allow customer_owner to manage sync-related tables (findings, materials, crops, crop_findings, recommend_material).
-- Previously only admin could write to these tables, but customer_owner needs access
-- for the registry sync feature.

-- Helper: reusable check for admin OR customer_owner
-- r.name IN ('admin', 'customer_owner')

-- ============================================================
-- findings: currently has no write policy at all
-- ============================================================
DROP POLICY IF EXISTS "Allow admin or owner manage findings" ON findings;
CREATE POLICY "Allow admin or owner manage findings" ON findings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

-- ============================================================
-- materials: update existing admin-only policy
-- ============================================================
DROP POLICY IF EXISTS "Allow admin manage materials" ON materials;
DROP POLICY IF EXISTS "Allow admin or owner manage materials" ON materials;
CREATE POLICY "Allow admin or owner manage materials" ON materials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

-- ============================================================
-- crops: update existing admin-only policy
-- ============================================================
DROP POLICY IF EXISTS "Allow admin manage crops" ON crops;
DROP POLICY IF EXISTS "Allow admin or owner manage crops" ON crops;
CREATE POLICY "Allow admin or owner manage crops" ON crops
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

-- ============================================================
-- crop_findings: replace individual admin-only policies with one combined policy
-- ============================================================
DROP POLICY IF EXISTS "Allow admin insert" ON crop_findings;
DROP POLICY IF EXISTS "Allow admin update" ON crop_findings;
DROP POLICY IF EXISTS "Allow admin delete" ON crop_findings;
DROP POLICY IF EXISTS "Allow admin or owner manage crop_findings" ON crop_findings;
CREATE POLICY "Allow admin or owner manage crop_findings" ON crop_findings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );

-- ============================================================
-- recommend_material: update existing admin-only policy
-- ============================================================
DROP POLICY IF EXISTS "Allow admin manage recommend_material" ON recommend_material;
DROP POLICY IF EXISTS "Allow admin or owner manage recommend_material" ON recommend_material;
CREATE POLICY "Allow admin or owner manage recommend_material" ON recommend_material
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'customer_owner')
    )
  );
