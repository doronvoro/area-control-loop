-- =============================================
-- Migration: Add SELECT RLS policy for monitoring_treatments
-- Date: 2026-02-12
-- Description: Allow customer owners and workers to view monitoring treatments
--              for areas they have access to via customer_areas
-- =============================================

CREATE POLICY "Users can view monitoring treatments for their areas"
ON monitoring_treatments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM monitoring_area_report mar
    JOIN report_areas ra ON ra.id = mar.area_report_id
    JOIN customer_areas ca ON ca.area_id = ra.area_id
    WHERE mar.id = monitoring_treatments.monitoring_report_id
    AND (
      ca.customer_id = get_user_customer_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = ca.customer_id
        AND customers.user_id = auth.uid()
      )
    )
  )
);
