-- Fix RLS policies for areas and sub_areas tables
-- Run this in Supabase SQL Editor
-- This allows customer owners to manage areas/sub-areas for their customer

-- =====================================================
-- AREAS TABLE POLICIES
-- =====================================================

-- Customer owners can create areas (they'll link to their customer via customer_areas)
CREATE POLICY "Customer owners can create areas"
  ON areas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- Customer owners can update areas linked to their customer
CREATE POLICY "Customer owners can update their areas"
  ON areas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customer_areas
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE customer_areas.area_id = areas.id
      AND customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- Customer owners can delete areas linked to their customer
CREATE POLICY "Customer owners can delete their areas"
  ON areas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customer_areas
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE customer_areas.area_id = areas.id
      AND customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- =====================================================
-- SUB_AREAS TABLE POLICIES
-- =====================================================

-- Customer owners can create sub-areas for areas linked to their customer
CREATE POLICY "Customer owners can create sub-areas"
  ON sub_areas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE areas.id = sub_areas.area_id
      AND customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- Customer owners can update sub-areas for their areas
CREATE POLICY "Customer owners can update their sub-areas"
  ON sub_areas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE areas.id = sub_areas.area_id
      AND customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- Customer owners can delete sub-areas for their areas
CREATE POLICY "Customer owners can delete their sub-areas"
  ON sub_areas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN customer_areas ON customer_areas.area_id = areas.id
      JOIN customers ON customers.id = customer_areas.customer_id
      WHERE areas.id = sub_areas.area_id
      AND customers.user_id = auth.uid()
    )
    OR is_admin_user(auth.uid())
  );

-- =====================================================
-- VERIFY POLICIES WERE CREATED
-- =====================================================
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('areas', 'sub_areas')
ORDER BY tablename, policyname;
