-- =============================================================================
-- RLS POLICIES - CONSOLIDATED REFERENCE
-- =============================================================================
-- This file documents the CURRENT STATE of all RLS policies in the database.
-- It is NOT a migration - use this as a reference when debugging or auditing.
--
-- IMPORTANT: Keep this file in sync with actual migrations.
-- Run `SELECT * FROM pg_policies;` to verify against production.
--
-- Last updated: 2026-02-08
-- =============================================================================


-- =============================================================================
-- TABLE: customers
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: User owns their customer record; admins see all
-- =============================================================================

-- Users can view their own customer
CREATE POLICY "Users can view their own customer"
  ON customers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own customer
CREATE POLICY "Users can update their own customer"
  ON customers FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all customers
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: workers
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Customer owners + workers in same customer + self; admins see all
-- =============================================================================

-- Workers can view workers from their customer (uses function to avoid recursion)
CREATE POLICY "Workers can view workers from their customer"
  ON workers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = workers.customer_id
      AND customers.user_id = auth.uid()
    )
    OR workers.user_id = auth.uid()
    OR is_worker_in_customer(workers.customer_id, auth.uid())
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

-- Admins can view all workers
CREATE POLICY "Admins can view all workers"
  ON workers FOR SELECT
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: invitations
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Sender OR receiver OR customer owner
-- =============================================================================

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


-- =============================================================================
-- TABLE: customer_areas
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Customer owner OR workers in customer; admins full access
-- =============================================================================

-- Users can view their customer areas
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

-- Admins can view all customer areas
CREATE POLICY "Admins can view all customer areas"
  ON customer_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can create customer areas
CREATE POLICY "Admins can create customer areas"
  ON customer_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update customer areas
CREATE POLICY "Admins can update customer areas"
  ON customer_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete customer areas
CREATE POLICY "Admins can delete customer areas"
  ON customer_areas FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: areas
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Via customer_areas relationship; admins full access
-- =============================================================================

-- Users can view accessible areas (via customer_areas)
CREATE POLICY "Users can view accessible areas"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_areas ca
      JOIN customers c ON c.id = ca.customer_id
      WHERE ca.area_id = areas.id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM customer_areas ca
      JOIN customers c ON c.id = ca.customer_id
      JOIN workers w ON w.customer_id = c.id
      WHERE ca.area_id = areas.id
      AND w.user_id = auth.uid()
    )
  );

-- Users can view areas through report areas (indirect access)
CREATE POLICY "Users can view areas through report areas"
  ON areas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_areas ra
      WHERE ra.area_id = areas.id
    )
  );

-- Admins can view all areas
CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can create areas
CREATE POLICY "Admins can create areas"
  ON areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update areas
CREATE POLICY "Admins can update areas"
  ON areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete areas
CREATE POLICY "Admins can delete areas"
  ON areas FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: sub_areas
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Via parent area; admins full access
-- =============================================================================

-- Users can view accessible sub-areas (via parent area)
CREATE POLICY "Users can view accessible sub-areas"
  ON sub_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas a
      JOIN customer_areas ca ON ca.area_id = a.id
      JOIN customers c ON c.id = ca.customer_id
      WHERE a.id = sub_areas.area_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers w
          WHERE w.customer_id = c.id
          AND w.user_id = auth.uid()
        )
      )
    )
  );

-- Admins can view all sub-areas
CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can create sub-areas
CREATE POLICY "Admins can create sub-areas"
  ON sub_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update sub-areas
CREATE POLICY "Admins can update sub-areas"
  ON sub_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete sub-areas
CREATE POLICY "Admins can delete sub-areas"
  ON sub_areas FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: report_areas
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Via area access; inspectors can create/update; admins full access
-- =============================================================================

-- Users can view accessible report areas
CREATE POLICY "Users can view accessible report areas"
  ON report_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas a
      JOIN customer_areas ca ON ca.area_id = a.id
      JOIN customers c ON c.id = ca.customer_id
      WHERE a.id = report_areas.area_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers w
          WHERE w.customer_id = c.id
          AND w.user_id = auth.uid()
        )
      )
    )
  );

-- Admins can view all report areas
CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Admins can create report areas
CREATE POLICY "Admins can create report areas"
  ON report_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update report areas
CREATE POLICY "Admins can update report areas"
  ON report_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete report areas
CREATE POLICY "Admins can delete report areas"
  ON report_areas FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: monitoring_area_report
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Via report_areas; inspectors can create/update; admins full access
-- =============================================================================

-- Users can view monitoring reports for their areas
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

-- Inspectors (and 'super_worker' type) can create monitoring reports
CREATE POLICY "Inspectors can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('inspector', 'super_worker')
    )
  );

-- Inspectors (and 'super_worker' type) can update monitoring reports
CREATE POLICY "Inspectors can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('inspector', 'super_worker')
    )
  );

-- Admins can view all monitoring reports
CREATE POLICY "Admins can view all monitoring reports"
  ON monitoring_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can create monitoring reports
CREATE POLICY "Admins can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update monitoring reports
CREATE POLICY "Admins can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete monitoring reports
CREATE POLICY "Admins can delete monitoring reports"
  ON monitoring_area_report FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: actions_area_report
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: Via report_areas; action workers can create/update; admins full access
-- =============================================================================

-- Users can view action reports for their areas
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

-- Action workers (and 'super_worker' type) can create action reports
CREATE POLICY "Action workers can create action reports"
  ON actions_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('action_worker', 'super_worker')
    )
  );

-- Action workers (and 'super_worker' type) can update action reports
CREATE POLICY "Action workers can update action reports"
  ON actions_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('action_worker', 'super_worker')
    )
  );

-- Admins can view all action reports
CREATE POLICY "Admins can view all action reports"
  ON actions_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can create action reports
CREATE POLICY "Admins can create action reports"
  ON actions_area_report FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Admins can update action reports
CREATE POLICY "Admins can update action reports"
  ON actions_area_report FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admins can delete action reports
CREATE POLICY "Admins can delete action reports"
  ON actions_area_report FOR DELETE
  USING (is_admin_user(auth.uid()));


-- =============================================================================
-- TABLE: user_roles
-- =============================================================================
-- RLS Status: ENABLED
-- Access Model: All authenticated users can read (needed for is_admin_user checks)
-- =============================================================================

-- Authenticated users can view all user_roles (for admin checks)
CREATE POLICY "Authenticated users can view all user_roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);


-- =============================================================================
-- LOOKUP TABLES (Read-Only)
-- =============================================================================
-- These tables are public read for authenticated users
-- =============================================================================

-- worker_types
CREATE POLICY "Anyone can read worker_types"
  ON worker_types FOR SELECT
  TO authenticated
  USING (true);

-- action_types
CREATE POLICY "Anyone can read action_types"
  ON action_types FOR SELECT
  TO authenticated
  USING (true);

-- unit_types
CREATE POLICY "Anyone can read unit_types"
  ON unit_types FOR SELECT
  TO authenticated
  USING (true);

-- findings
CREATE POLICY "Anyone can read findings"
  ON findings FOR SELECT
  TO authenticated
  USING (true);

-- roles
CREATE POLICY "Anyone can read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- permissions
CREATE POLICY "Anyone can read permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- role_permissions
CREATE POLICY "Anyone can read role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);
