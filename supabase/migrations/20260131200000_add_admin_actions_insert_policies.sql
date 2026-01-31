-- Add INSERT/UPDATE/DELETE policies for admins on actions_area_report

-- Allow admins to insert action reports
CREATE POLICY "Admins can create action reports"
  ON actions_area_report FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow admins to update action reports
CREATE POLICY "Admins can update action reports"
  ON actions_area_report FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Allow admins to delete action reports
CREATE POLICY "Admins can delete action reports"
  ON actions_area_report FOR DELETE
  USING (is_admin_user(auth.uid()));
