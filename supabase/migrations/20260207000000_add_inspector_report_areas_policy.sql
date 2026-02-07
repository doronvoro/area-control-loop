-- Add INSERT policy for inspectors and admins on report_areas
-- This allows inspectors to create report_areas when creating monitoring reports

CREATE POLICY "Inspectors and admins can create report areas"
  ON report_areas FOR INSERT
  WITH CHECK (
    is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM workers w
      JOIN worker_types wt ON wt.id = w.type_id
      JOIN customer_areas ca ON ca.customer_id = w.customer_id
      WHERE w.user_id = auth.uid()
      AND wt.name = 'inspector'
      AND ca.area_id = report_areas.area_id
    )
  );

-- Also add UPDATE policy for inspectors and admins
CREATE POLICY "Inspectors and admins can update report areas"
  ON report_areas FOR UPDATE
  USING (
    is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM workers w
      JOIN worker_types wt ON wt.id = w.type_id
      JOIN customer_areas ca ON ca.customer_id = w.customer_id
      WHERE w.user_id = auth.uid()
      AND wt.name = 'inspector'
      AND ca.area_id = report_areas.area_id
    )
  );
