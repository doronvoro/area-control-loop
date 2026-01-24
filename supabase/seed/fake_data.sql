-- Comprehensive Fake Data Seed Script
-- Run this after creating auth users via Supabase Auth API
-- Usage: After registering users, you can manually link them to customers and workers

-- This script assumes you have:
-- 1. Created auth users via registration or Supabase dashboard
-- 2. Note the user IDs to use below

-- Example: To create a test customer with workers:
-- 1. Register users via the app (or create them in Supabase dashboard)
-- 2. Get their user IDs from auth.users table
-- 3. Run the INSERT statements below with those user IDs

-- Example customer creation (replace USER_ID_1, USER_ID_2, etc. with actual UUIDs):
/*
-- Create a test customer
INSERT INTO customers (user_id, name, description) VALUES
  ('USER_ID_1'::UUID, 'חברת גידול בע"מ', 'חברה לניסוי ובדיקה')
ON CONFLICT (user_id) DO NOTHING;

-- Get customer ID
DO $$
DECLARE
  v_customer_id UUID;
  v_inspector_type_id UUID;
  v_action_worker_type_id UUID;
BEGIN
  SELECT id INTO v_customer_id FROM customers WHERE name = 'חברת גידול בע"מ';
  SELECT id INTO v_inspector_type_id FROM worker_types WHERE name = 'inspector';
  SELECT id INTO v_action_worker_type_id FROM worker_types WHERE name = 'action_worker';

  -- Create workers (replace USER_ID_2, USER_ID_3 with actual auth user IDs)
  INSERT INTO workers (customer_id, user_id, name, type_id) VALUES
    (v_customer_id, 'USER_ID_2'::UUID, 'יוסי כהן', v_inspector_type_id),
    (v_customer_id, 'USER_ID_3'::UUID, 'דני לוי', v_action_worker_type_id),
    (v_customer_id, 'USER_ID_4'::UUID, 'שרה אברהם', v_inspector_type_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Link customer to all areas
  INSERT INTO customer_areas (customer_id, area_id)
  SELECT v_customer_id, id FROM areas
  ON CONFLICT (customer_id, area_id) DO NOTHING;
END $$;
*/

-- Create sample monitoring reports (requires existing workers and report areas)
/*
DO $$
DECLARE
  v_inspector_id UUID;
  v_area_report_id UUID;
  v_sub_area_id UUID;
  v_finding_id UUID;
  v_unit_type_id UUID;
  v_action_type_id UUID;
BEGIN
  -- Get first inspector worker
  SELECT w.id INTO v_inspector_id 
  FROM workers w
  JOIN worker_types wt ON w.type_id = wt.id
  WHERE wt.name = 'inspector'
  LIMIT 1;

  -- Get first monitoring report area
  SELECT id INTO v_area_report_id 
  FROM report_areas 
  WHERE type = 'monitoring'
  LIMIT 1;

  -- Get first sub-area
  SELECT id INTO v_sub_area_id 
  FROM sub_areas 
  LIMIT 1;

  -- Get a finding
  SELECT id INTO v_finding_id 
  FROM findings 
  WHERE severity = 'high'
  LIMIT 1;

  -- Get unit type
  SELECT id INTO v_unit_type_id 
  FROM unit_types 
  WHERE name = 'ml'
  LIMIT 1;

  -- Get action type
  SELECT id INTO v_action_type_id 
  FROM action_types 
  WHERE name = 'spray'
  LIMIT 1;

  -- Create monitoring reports
  IF v_inspector_id IS NOT NULL AND v_area_report_id IS NOT NULL THEN
    INSERT INTO monitoring_area_report (
      area_report_id,
      sub_area_id,
      finding_id,
      inspector_id,
      recommend_material,
      recommend_dosage,
      recommend_unit_type_id,
      recommend_action_type_id,
      status
    ) VALUES
      (v_area_report_id, v_sub_area_id, v_finding_id, v_inspector_id, 'חומר A', '100', v_unit_type_id, v_action_type_id, 'pending'),
      (v_area_report_id, v_sub_area_id, v_finding_id, v_inspector_id, 'חומר B', '150', v_unit_type_id, v_action_type_id, 'in_progress'),
      (v_area_report_id, v_sub_area_id, v_finding_id, v_inspector_id, 'חומר C', '200', v_unit_type_id, v_action_type_id, 'completed')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
*/

-- Summary of what's been created:
-- ✅ Worker types (inspector, action_worker)
-- ✅ Areas (5 areas)
-- ✅ Sub-areas (hierarchical structure)
-- ✅ Report areas (monitoring and action types)
-- ✅ Findings (8 different findings)
-- ✅ Action types (6 different action types)
-- ✅ Unit types (6 different unit types)
-- ⚠️  Customers and Workers require auth.users (create via app registration)
-- ⚠️  Monitoring/Action reports require customers and workers to exist
