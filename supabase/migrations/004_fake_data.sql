-- Fake Data Seed Script
-- This script adds comprehensive fake data for testing

-- First, ensure we have worker types (from 003_seed_data.sql)
INSERT INTO worker_types (name, display_name, description) VALUES
  ('inspector', 'פקח', 'Inspector worker type'),
  ('action_worker', 'רסס', 'Action worker type')
ON CONFLICT (name) DO NOTHING;

-- Get worker type IDs for later use
DO $$
DECLARE
  inspector_type_id UUID;
  action_worker_type_id UUID;
BEGIN
  SELECT id INTO inspector_type_id FROM worker_types WHERE name = 'inspector';
  SELECT id INTO action_worker_type_id FROM worker_types WHERE name = 'action_worker';

  -- Create fake areas
  INSERT INTO areas (name, description) VALUES
    ('אזור צפון', 'אזור גידול בצפון הארץ'),
    ('אזור מרכז', 'אזור גידול במרכז הארץ'),
    ('אזור דרום', 'אזור גידול בדרום הארץ'),
    ('אזור עמק', 'אזור גידול בעמק'),
    ('אזור הר', 'אזור גידול בהרים')
  ON CONFLICT DO NOTHING;

  -- Create fake sub-areas (hierarchical)
  -- First level sub-areas
  INSERT INTO sub_areas (area_id, parent_sub_area_id, level, name, variety, rows, display)
  SELECT 
    a.id,
    NULL,
    1,
    'תת-אזור ' || a.name || ' 1',
    'זן A',
    '1-10',
    '1-10 | זן A'
  FROM areas a
  WHERE a.name IN ('אזור צפון', 'אזור מרכז', 'אזור דרום')
  ON CONFLICT DO NOTHING;

  INSERT INTO sub_areas (area_id, parent_sub_area_id, level, name, variety, rows, display)
  SELECT 
    a.id,
    NULL,
    1,
    'תת-אזור ' || a.name || ' 2',
    'זן B',
    '11-20',
    '11-20 | זן B'
  FROM areas a
  WHERE a.name IN ('אזור צפון', 'אזור מרכז')
  ON CONFLICT DO NOTHING;

  -- Second level sub-areas (children)
  INSERT INTO sub_areas (area_id, parent_sub_area_id, level, name, variety, rows, display)
  SELECT 
    sa.area_id,
    sa.id,
    2,
    'תת-תת-אזור ' || sa.name || ' - חלקה 1',
    'זן C',
    '21-30',
    '21-30 | זן C'
  FROM sub_areas sa
  WHERE sa.level = 1
  LIMIT 3
  ON CONFLICT DO NOTHING;

  -- Create fake report areas
  INSERT INTO report_areas (area_id, type, name, description)
  SELECT 
    a.id,
    'monitoring',
    'דוח ניטור ' || a.name,
    'דוח ניטור עבור ' || a.name
  FROM areas a
  ON CONFLICT DO NOTHING;

  INSERT INTO report_areas (area_id, type, name, description)
  SELECT 
    a.id,
    'action',
    'דוח פעולה ' || a.name,
    'דוח פעולה עבור ' || a.name
  FROM areas a
  LIMIT 3
  ON CONFLICT DO NOTHING;

  -- Create fake findings if they don't exist
  INSERT INTO findings (name, description, severity) VALUES
    ('pest_infestation', 'הדבקות מזיקים', 'high'),
    ('disease', 'מחלה', 'medium'),
    ('nutrient_deficiency', 'חוסר חומרים מזינים', 'low'),
    ('weed_growth', 'צמיחת עשבים', 'low'),
    ('aphids', 'כנימות', 'high'),
    ('mites', 'קרדיות', 'medium'),
    ('fungal_infection', 'זיהום פטרייתי', 'high'),
    ('bacterial_disease', 'מחלה חיידקית', 'medium')
  ON CONFLICT DO NOTHING;

  -- Create fake action types if they don't exist
  INSERT INTO action_types (name, description) VALUES
    ('spray', 'ריסוס'),
    ('prune', 'גיזום'),
    ('treat', 'טיפול'),
    ('monitor', 'ניטור'),
    ('fertilize', 'דישון'),
    ('irrigate', 'השקיה')
  ON CONFLICT DO NOTHING;

  -- Create fake unit types if they don't exist
  INSERT INTO unit_types (name, description) VALUES
    ('ml', 'מיליליטר'),
    ('l', 'ליטר'),
    ('kg', 'קילוגרם'),
    ('g', 'גרם'),
    ('units', 'יחידות'),
    ('liters_per_hectare', 'ליטר לדונם')
  ON CONFLICT DO NOTHING;

  -- Note: Customers and Workers require auth.users to exist first
  -- These will be created when users register or are invited
  -- For now, we'll create sample monitoring and action reports that can be linked later

  -- Create fake monitoring reports (will need valid area_report_id and user_id)
  -- These are commented out as they require existing customers/workers
  /*
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
  )
  SELECT 
    ra.id,
    sa.id,
    f.id,
    w.id,
    'חומר מומלץ 1',
    '100',
    ut.id,
    at.id,
    'pending'
  FROM report_areas ra
  CROSS JOIN sub_areas sa
  CROSS JOIN findings f
  CROSS JOIN workers w
  CROSS JOIN unit_types ut
  CROSS JOIN action_types at
  WHERE ra.type = 'monitoring'
    AND sa.area_id = ra.area_id
    AND w.type_id = inspector_type_id
    AND ut.name = 'ml'
    AND at.name = 'spray'
  LIMIT 5;
  */

END $$;

-- Create a function to help with creating test data after users exist
CREATE OR REPLACE FUNCTION create_test_customer_data(
  p_user_id UUID,
  p_customer_name TEXT,
  p_worker_names TEXT[],
  p_area_names TEXT[]
)
RETURNS TABLE(customer_id UUID, worker_ids UUID[]) AS $$
DECLARE
  v_customer_id UUID;
  v_worker_id UUID;
  v_worker_ids UUID[] := ARRAY[]::UUID[];
  v_area_id UUID;
  v_worker_name TEXT;
  v_inspector_type_id UUID;
  v_action_worker_type_id UUID;
BEGIN
  -- Get worker type IDs
  SELECT id INTO v_inspector_type_id FROM worker_types WHERE name = 'inspector';
  SELECT id INTO v_action_worker_type_id FROM worker_types WHERE name = 'action_worker';

  -- Create customer
  INSERT INTO customers (user_id, name, description)
  VALUES (p_user_id, p_customer_name, 'לקוח בדיקה: ' || p_customer_name)
  ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_customer_id;

  -- Create workers (alternating between inspector and action_worker)
  FOR i IN 1..array_length(p_worker_names, 1) LOOP
    -- Note: Workers need auth.users - this is a placeholder
    -- In reality, you'd need to create auth users first via Supabase Auth API
    -- For now, we'll just create the customer and link areas
    NULL; -- Placeholder for worker creation
  END LOOP;

  -- Link customer to areas
  FOREACH v_area_id IN ARRAY (
    SELECT array_agg(id) FROM areas WHERE name = ANY(p_area_names)
  ) LOOP
    INSERT INTO customer_areas (customer_id, area_id)
    VALUES (v_customer_id, v_area_id)
    ON CONFLICT (customer_id, area_id) DO NOTHING;
  END LOOP;

  RETURN QUERY SELECT v_customer_id, v_worker_ids;
END;
$$ LANGUAGE plpgsql;

-- Add some helpful comments
COMMENT ON FUNCTION create_test_customer_data IS 'Helper function to create test customer data. Note: Workers require auth.users to be created first via Supabase Auth API.';
