-- Add INSERT, UPDATE, DELETE policies for admins on areas and sub_areas tables

-- Areas table policies
CREATE POLICY "Admins can create areas"
  ON areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update areas"
  ON areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete areas"
  ON areas FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Sub-areas table policies
CREATE POLICY "Admins can create sub-areas"
  ON sub_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update sub-areas"
  ON sub_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete sub-areas"
  ON sub_areas FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Customer_areas table policies (for linking areas to customers)
CREATE POLICY "Admins can create customer areas"
  ON customer_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update customer areas"
  ON customer_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete customer areas"
  ON customer_areas FOR DELETE
  USING (is_admin_user(auth.uid()));
