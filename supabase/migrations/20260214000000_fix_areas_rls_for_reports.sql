-- Fix areas RLS policy to allow users to see areas through report_areas
-- This ensures the area name is displayed correctly in reports table
--
-- The issue: When API joins report_areas to areas, RLS on areas may block access
-- even though the user can see the report_areas. This creates a mismatch where
-- report_areas are visible but area names show as "-".
--
-- Solution: Add a policy that allows viewing areas if the user has accessible
-- report_areas for that area. This leverages the existing report_areas RLS.

-- Add policy allowing users to see areas referenced in their accessible report_areas
-- The EXISTS subquery will be filtered by report_areas RLS policies
CREATE POLICY "Users can view areas through report areas"
  ON areas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_areas ra
      WHERE ra.area_id = areas.id
    )
  );
