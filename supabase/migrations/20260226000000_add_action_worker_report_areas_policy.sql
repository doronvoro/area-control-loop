-- Add INSERT and UPDATE policies for action_workers on report_areas
-- This allows action workers to create report_areas when submitting action reports

CREATE POLICY "Action workers can create report areas"
  ON report_areas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers w
      JOIN worker_types wt ON wt.id = w.type_id
      JOIN customer_areas ca ON ca.customer_id = w.customer_id
      WHERE w.user_id = auth.uid()
      AND wt.name = 'action_worker'
      AND ca.area_id = report_areas.area_id
    )
  );

CREATE POLICY "Action workers can update report areas"
  ON report_areas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers w
      JOIN worker_types wt ON wt.id = w.type_id
      JOIN customer_areas ca ON ca.customer_id = w.customer_id
      WHERE w.user_id = auth.uid()
      AND wt.name = 'action_worker'
      AND ca.area_id = report_areas.area_id
    )
  );
