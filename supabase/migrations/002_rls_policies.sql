-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_area_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions_area_report ENABLE ROW LEVEL SECURITY;

-- Customers policies
-- Users can only see their own customer record
CREATE POLICY "Users can view their own customer"
  ON customers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own customer
CREATE POLICY "Users can update their own customer"
  ON customers FOR UPDATE
  USING (auth.uid() = user_id);

-- Workers policies
-- Workers can view workers from their customer
CREATE POLICY "Workers can view workers from their customer"
  ON workers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = workers.customer_id
      AND customers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM workers w
      WHERE w.user_id = auth.uid()
      AND w.customer_id = workers.customer_id
    )
  );

-- Customer owners can insert workers
CREATE POLICY "Customer owners can insert workers"
  ON workers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = workers.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Customer owners can update workers
CREATE POLICY "Customer owners can update workers"
  ON workers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = workers.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Invitations policies
-- Users can view invitations they sent or received
CREATE POLICY "Users can view relevant invitations"
  ON invitations FOR SELECT
  USING (
    invited_by_user_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = invitations.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Admins can create customer invitations
CREATE POLICY "Admins can create customer invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    invitation_type = 'customer'
    AND invited_by_user_id = auth.uid()
    -- Add admin check here (via user_metadata or separate table)
  );

-- Customer owners can create worker invitations
CREATE POLICY "Customer owners can create worker invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    invitation_type = 'worker'
    AND EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = invitations.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Customer Areas policies
-- Users can view customer areas for their customer
CREATE POLICY "Users can view their customer areas"
  ON customer_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_areas.customer_id
      AND customers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.customer_id = customer_areas.customer_id
      AND workers.user_id = auth.uid()
    )
  );

-- Customer owners can manage customer areas
CREATE POLICY "Customer owners can manage customer areas"
  ON customer_areas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_areas.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Areas policies
-- Users can view areas accessible to their customer
CREATE POLICY "Users can view accessible areas"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_areas
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE customer_areas.area_id = areas.id
      AND (
        customers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers
          WHERE workers.customer_id = customers.id
          AND workers.user_id = auth.uid()
        )
      )
    )
  );

-- Sub Areas policies
-- Users can view sub-areas for accessible areas
CREATE POLICY "Users can view accessible sub-areas"
  ON sub_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE areas.id = sub_areas.area_id
      AND (
        customers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers
          WHERE workers.customer_id = customers.id
          AND workers.user_id = auth.uid()
        )
      )
    )
  );

-- Report Areas policies
-- Users can view report areas for accessible areas
CREATE POLICY "Users can view accessible report areas"
  ON report_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE areas.id = report_areas.area_id
      AND (
        customers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers
          WHERE workers.customer_id = customers.id
          AND workers.user_id = auth.uid()
        )
      )
    )
  );

-- Monitoring Area Report policies
-- Users can view monitoring reports for their customer's areas
CREATE POLICY "Users can view monitoring reports for their areas"
  ON monitoring_area_report FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM report_areas
      JOIN areas ON areas.id = report_areas.area_id
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE report_areas.id = monitoring_area_report.area_report_id
      AND (
        customers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers
          WHERE workers.customer_id = customers.id
          AND workers.user_id = auth.uid()
        )
      )
    )
  );

-- Inspectors can create monitoring reports
CREATE POLICY "Inspectors can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'inspector'
    )
  );

-- Inspectors can update their monitoring reports
CREATE POLICY "Inspectors can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'inspector'
    )
  );

-- Actions Area Report policies
-- Users can view action reports for their customer's areas
CREATE POLICY "Users can view action reports for their areas"
  ON actions_area_report FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM report_areas
      JOIN areas ON areas.id = report_areas.area_id
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE report_areas.id = actions_area_report.area_report_id
      AND (
        customers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers
          WHERE workers.customer_id = customers.id
          AND workers.user_id = auth.uid()
        )
      )
    )
  );

-- Action workers can create action reports
CREATE POLICY "Action workers can create action reports"
  ON actions_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'action_worker'
    )
  );

-- Action workers can update their action reports
CREATE POLICY "Action workers can update action reports"
  ON actions_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name = 'action_worker'
    )
  );

-- Lookup tables are public read
CREATE POLICY "Anyone can read worker_types"
  ON worker_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read action_types"
  ON action_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read unit_types"
  ON unit_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read findings"
  ON findings FOR SELECT
  TO authenticated
  USING (true);
