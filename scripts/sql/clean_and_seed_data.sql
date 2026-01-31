-- =============================================
-- Clean and Seed Data Script
-- Date: 2026-01-31
-- Description: Delete all report data and insert fresh sample data
-- =============================================

-- =============================================
-- PART 1: CLEAN DATA
-- Delete in correct order (children first to avoid FK violations)
-- =============================================

-- Delete treatments first
DELETE FROM monitoring_treatments;
DELETE FROM action_treatments;

-- Delete report entries
DELETE FROM monitoring_area_report;
DELETE FROM actions_area_report;

-- Delete report containers
DELETE FROM report_areas;

-- =============================================
-- PART 2: SEED DATA
-- Insert fresh sample data with new structure
-- =============================================

-- Create temporary variables to hold IDs
DO $$
DECLARE
  v_area_id UUID;
  v_sub_area_id UUID;
  v_finding_id UUID;
  v_finding_id_2 UUID;
  v_material_id UUID;
  v_material_id_2 UUID;
  v_unit_type_id UUID;
  v_action_type_id UUID;
  v_action_type_id_2 UUID;
  v_report_area_id UUID;
  v_monitoring_report_id UUID;
  v_action_report_id UUID;
BEGIN
  -- Get reference IDs from existing lookup tables
  SELECT id INTO v_area_id FROM areas LIMIT 1;
  SELECT id INTO v_sub_area_id FROM sub_areas WHERE area_id = v_area_id LIMIT 1;
  SELECT id INTO v_finding_id FROM findings LIMIT 1;
  SELECT id INTO v_finding_id_2 FROM findings OFFSET 1 LIMIT 1;
  SELECT id INTO v_material_id FROM materials LIMIT 1;
  SELECT id INTO v_material_id_2 FROM materials OFFSET 1 LIMIT 1;
  SELECT id INTO v_unit_type_id FROM unit_types LIMIT 1;
  SELECT id INTO v_action_type_id FROM action_types LIMIT 1;
  SELECT id INTO v_action_type_id_2 FROM action_types OFFSET 1 LIMIT 1;

  -- Fallback if second IDs don't exist
  IF v_finding_id_2 IS NULL THEN v_finding_id_2 := v_finding_id; END IF;
  IF v_material_id_2 IS NULL THEN v_material_id_2 := v_material_id; END IF;
  IF v_action_type_id_2 IS NULL THEN v_action_type_id_2 := v_action_type_id; END IF;

  -- Check if we have necessary data
  IF v_area_id IS NULL OR v_sub_area_id IS NULL OR v_finding_id IS NULL THEN
    RAISE NOTICE 'Missing required reference data. Please seed areas, sub_areas, and findings first.';
    RETURN;
  END IF;

  -- =============================================
  -- Create Monitoring Report #1
  -- =============================================
  INSERT INTO report_areas (id, area_id, type, name, description)
  VALUES (gen_random_uuid(), v_area_id, 'monitoring', 'דוח ניטור שבועי - ינואר 2026', 'דוח ניטור שגרתי לבדיקת מזיקים')
  RETURNING id INTO v_report_area_id;

  -- Monitoring entry 1: Sub-area with finding 1, multiple treatments
  INSERT INTO monitoring_area_report (id, area_report_id, sub_area_id, finding_id, status)
  VALUES (gen_random_uuid(), v_report_area_id, v_sub_area_id, v_finding_id, 'pending')
  RETURNING id INTO v_monitoring_report_id;

  -- Treatment 1 for monitoring entry 1
  INSERT INTO monitoring_treatments (monitoring_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes)
  VALUES (v_monitoring_report_id, v_material_id, 0.5, v_unit_type_id, v_action_type_id, 'pending', 'טיפול ראשוני מומלץ');

  -- Treatment 2 for monitoring entry 1
  INSERT INTO monitoring_treatments (monitoring_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes)
  VALUES (v_monitoring_report_id, v_material_id_2, 1.0, v_unit_type_id, v_action_type_id_2, 'pending', 'טיפול משלים');

  -- Monitoring entry 2: Same sub-area with finding 2, single treatment
  INSERT INTO monitoring_area_report (id, area_report_id, sub_area_id, finding_id, status)
  VALUES (gen_random_uuid(), v_report_area_id, v_sub_area_id, v_finding_id_2, 'completed')
  RETURNING id INTO v_monitoring_report_id;

  -- Treatment for monitoring entry 2
  INSERT INTO monitoring_treatments (monitoring_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes)
  VALUES (v_monitoring_report_id, v_material_id, 0.3, v_unit_type_id, v_action_type_id, 'completed', 'בוצע בהצלחה');

  -- =============================================
  -- Create Monitoring Report #2 (different area if exists)
  -- =============================================
  SELECT id INTO v_area_id FROM areas OFFSET 1 LIMIT 1;
  IF v_area_id IS NOT NULL THEN
    SELECT id INTO v_sub_area_id FROM sub_areas WHERE area_id = v_area_id LIMIT 1;

    IF v_sub_area_id IS NOT NULL THEN
      INSERT INTO report_areas (id, area_id, type, name, description)
      VALUES (gen_random_uuid(), v_area_id, 'monitoring', 'דוח ניטור חודשי - ינואר 2026', 'דוח ניטור מקיף')
      RETURNING id INTO v_report_area_id;

      INSERT INTO monitoring_area_report (id, area_report_id, sub_area_id, finding_id, status)
      VALUES (gen_random_uuid(), v_report_area_id, v_sub_area_id, v_finding_id, 'in_progress')
      RETURNING id INTO v_monitoring_report_id;

      INSERT INTO monitoring_treatments (monitoring_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes)
      VALUES (v_monitoring_report_id, v_material_id, 0.8, v_unit_type_id, v_action_type_id, 'in_progress', 'בתהליך ביצוע');
    END IF;
  END IF;

  -- =============================================
  -- Create Action Report #1
  -- =============================================
  SELECT id INTO v_area_id FROM areas LIMIT 1;
  SELECT id INTO v_sub_area_id FROM sub_areas WHERE area_id = v_area_id LIMIT 1;

  INSERT INTO report_areas (id, area_id, type, name, description)
  VALUES (gen_random_uuid(), v_area_id, 'action', 'דוח פעולה - ריסוס ינואר 2026', 'דוח ביצוע פעולות טיפול')
  RETURNING id INTO v_report_area_id;

  -- Action entry 1
  INSERT INTO actions_area_report (id, area_report_id, sub_area_id, finding_id, status)
  VALUES (gen_random_uuid(), v_report_area_id, v_sub_area_id, v_finding_id, 'completed')
  RETURNING id INTO v_action_report_id;

  -- Treatment 1 for action entry 1
  INSERT INTO action_treatments (action_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes, action_time)
  VALUES (v_action_report_id, v_material_id, 0.5, v_unit_type_id, v_action_type_id, 'completed', 'בוצע ריסוס מלא', NOW() - INTERVAL '2 days');

  -- Treatment 2 for action entry 1
  INSERT INTO action_treatments (action_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes, action_time)
  VALUES (v_action_report_id, v_material_id_2, 0.3, v_unit_type_id, v_action_type_id_2, 'completed', 'טיפול משלים בוצע', NOW() - INTERVAL '1 day');

  -- Action entry 2 (planned, not yet executed)
  INSERT INTO actions_area_report (id, area_report_id, sub_area_id, finding_id, status)
  VALUES (gen_random_uuid(), v_report_area_id, v_sub_area_id, v_finding_id_2, 'planned')
  RETURNING id INTO v_action_report_id;

  -- Treatment for action entry 2 (planned)
  INSERT INTO action_treatments (action_report_id, material_id, dosage, unit_type_id, action_type_id, status, notes)
  VALUES (v_action_report_id, v_material_id, 1.0, v_unit_type_id, v_action_type_id, 'pending', 'מתוכנן לביצוע בשבוע הבא');

  RAISE NOTICE 'Sample data seeded successfully!';
END $$;

-- =============================================
-- Verify seeded data
-- =============================================
SELECT 'report_areas' as table_name, COUNT(*) as count FROM report_areas
UNION ALL
SELECT 'monitoring_area_report', COUNT(*) FROM monitoring_area_report
UNION ALL
SELECT 'actions_area_report', COUNT(*) FROM actions_area_report
UNION ALL
SELECT 'monitoring_treatments', COUNT(*) FROM monitoring_treatments
UNION ALL
SELECT 'action_treatments', COUNT(*) FROM action_treatments;
