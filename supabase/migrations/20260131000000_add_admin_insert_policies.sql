-- Add INSERT policies for admins on monitoring_area_report and related tables

-- Allow admins to insert monitoring reports
CREATE POLICY "Admins can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow admins to update monitoring reports
CREATE POLICY "Admins can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Allow admins to delete monitoring reports
CREATE POLICY "Admins can delete monitoring reports"
  ON monitoring_area_report FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Allow admins to insert report_areas
CREATE POLICY "Admins can create report areas"
  ON report_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow admins to update report_areas
CREATE POLICY "Admins can update report areas"
  ON report_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Allow admins to delete report_areas
CREATE POLICY "Admins can delete report areas"
  ON report_areas FOR DELETE
  USING (is_admin_user(auth.uid()));
