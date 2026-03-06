-- Import areas and sub-areas from CSV data
-- Customer: 364c2ab0-985e-47d7-b486-fce31415ad76
-- Source: temp/זן חלקה copy.csv

BEGIN;

-- 1. Delete existing data for this customer (explicit order to avoid FK issues)
-- Delete action reports (references report_areas + sub_areas)
DELETE FROM actions_area_report WHERE area_report_id IN (
  SELECT id FROM report_areas WHERE area_id IN (
    SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
  )
);
-- Delete monitoring reports (references report_areas + sub_areas)
DELETE FROM monitoring_area_report WHERE area_report_id IN (
  SELECT id FROM report_areas WHERE area_id IN (
    SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
  )
);
-- Delete report_areas (references areas)
DELETE FROM report_areas WHERE area_id IN (
  SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
);
-- Delete sub_areas
DELETE FROM sub_areas WHERE area_id IN (
  SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
);
-- Delete customer_areas links and orphaned areas
DELETE FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76';
DELETE FROM areas WHERE id NOT IN (SELECT area_id FROM customer_areas);

-- 2. Create crops if not exist
INSERT INTO crops (name, description) VALUES ('שזיף', 'שזיף') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('משמש', 'משמש') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('ליים', 'ליים') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('הדרים', 'הדרים') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('אפרסק', 'אפרסק') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('נקטרינה', 'נקטרינה') ON CONFLICT DO NOTHING;
INSERT INTO crops (name, description) VALUES ('אבוקדו', 'אבוקדו') ON CONFLICT DO NOTHING;

-- 3. Create areas and sub-areas using a DO block
DO $$
DECLARE
  v_customer_id UUID := '364c2ab0-985e-47d7-b486-fce31415ad76';
  v_area_id UUID;
  v_crop_id UUID;
BEGIN

  -- ===== Area 1 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('1', 'חלקה 1', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1), 12, 'dunam', '2008-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'מרקו', 'מרקו', '2008-01-01', 0.7, 'dunam', '1 | מרקו', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'גרין רד', 'גרין רד', '2008-01-01', 0.7, 'dunam', '1 | גרין רד', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'גרין רד+רד דיימונד', 'גרין רד+רד דיימונד', '2008-01-01', 0.7, 'dunam', '1 | גרין רד+רד דיימונד', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'פלמגנט', 'פלמגנט', '2008-01-01', 0.7, 'dunam', '1 | פלמגנט', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'ויקטורי', 'ויקטורי', '2008-01-01', 2.8, 'dunam', '1 | ויקטורי', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'משמש', 'משמש', '2008-01-01', 6.4, 'dunam', '1 | משמש', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1));

  -- ===== Area 2 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('2', 'חלקה 2', (SELECT id FROM crops WHERE name = 'ליים' LIMIT 1), 14.3, 'dunam', '2011-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'ליים עליון', 'ליים', '2011-01-01', 10.4, 'dunam', '2 | ליים עליון', (SELECT id FROM crops WHERE name = 'ליים' LIMIT 1)),
    (v_area_id, 1, 'ליים תחתון', 'ליים', '2011-01-01', 3.9, 'dunam', '2 | ליים תחתון', (SELECT id FROM crops WHERE name = 'ליים' LIMIT 1));

  -- ===== Area 3 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('3', 'חלקה 3', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1), 12, 'dunam', '2008-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'אור מערב (אבוקדו)', 'אור', '2008-01-01', 5, 'dunam', '3 | אור מערב (אבוקדו)', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1)),
    (v_area_id, 1, 'אור מזרח (בניאס)', 'אור', '2008-01-01', 7, 'dunam', '3 | אור מזרח (בניאס)', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1));

  -- ===== Area 4 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('4', 'חלקה 4', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1), 19.9, 'dunam', '2014-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'גרין רד צפון', 'גרין רד', '2014-01-01', 11.5, 'dunam', '4 | גרין רד צפון', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'גרין רד דרום', 'גרין רד', '2014-01-01', NULL, NULL, '4 | גרין רד דרום', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'מרקו', 'מרקו', '2014-01-01', 4.8, 'dunam', '4 | מרקו', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'רד דיימונד צפון', 'רד דיימונד', '2014-01-01', 3.6, 'dunam', '4 | רד דיימונד צפון', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1));

  -- ===== Area 5 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('5', 'חלקה 5', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1), 32.7, 'dunam', '2012-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'רד דיימונד', 'רד דיימונד', '2012-01-01', 3.3, 'dunam', '5 | רד דיימונד', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'ויקטורי', 'ויקטורי', '2012-01-01', 2.4, 'dunam', '5 | ויקטורי', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'בלק דיימונד', 'בלק דיימונד', '2012-01-01', 2.4, 'dunam', '5 | בלק דיימונד', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, '440', '440', '2012-01-01', 4.1, 'dunam', '5 | 440', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'ביגסן', 'ביגסן', '2012-01-01', 4.9, 'dunam', '5 | ביגסן', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'ביצה שחורה', 'ביצה שחורה', '2012-01-01', 1.5, 'dunam', '5 | ביצה שחורה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'פלמגנט + ויקטורי', 'פלמגנט + ויקטורי', '2012-01-01', 1.6, 'dunam', '5 | פלמגנט + ויקטורי', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'בנדורה', 'בנדורה', '2012-01-01', 2.4, 'dunam', '5 | בנדורה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'מירל', 'מירל', '2012-01-01', 2.4, 'dunam', '5 | מירל', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'אנריקה', 'אנריקה', '2012-01-01', 2.4, 'dunam', '5 | אנריקה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'גרין רד', 'גרין רד', '2012-01-01', 7.3, 'dunam', '5 | גרין רד', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1));

  -- ===== Area 6 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('6', 'חלקה 6', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1), 28.5, 'dunam', '2005-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, '315', '315', '2005-01-01', 4, 'dunam', '6 | 315', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, '310', '310', '2005-01-01', 3, 'dunam', '6 | 310', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, '311', '311', '2005-01-01', 2, 'dunam', '6 | 311', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, '123', '123', '2005-01-01', 4, 'dunam', '6 | 123', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, 'אנריקה', 'אנריקה', '2005-01-01', 5.6, 'dunam', '6 | אנריקה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, '211', '211', '2005-01-01', 1, 'dunam', '6 | 211', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, '208', '208', '2005-01-01', 1, 'dunam', '6 | 208', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, 'עקור דרום', 'עקור', '2005-01-01', 1.1, 'dunam', '6 | עקור דרום', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'פלמגרנט', 'פלמגרנט', '2005-01-01', 2.2, 'dunam', '6 | פלמגרנט', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'בנדורה', 'בנדורה', '2005-01-01', 2.3, 'dunam', '6 | בנדורה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'מירל', 'מירל', '2005-01-01', 2.3, 'dunam', '6 | מירל', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1));

  -- ===== Area 7 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('7', 'חלקה 7', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1), 9.9, 'dunam', '2019-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, '5-110', '5-110', '2019-01-01', 3.3, 'dunam', '7 | 5-110', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, 'פולינז', 'פולינז', '2019-01-01', 3.3, 'dunam', '7 | פולינז', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1)),
    (v_area_id, 1, 'פלד', 'פלד', '2019-01-01', 3.3, 'dunam', '7 | פלד', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1));

  -- ===== Area 8 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('8', 'חלקה 8', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1), 14, 'dunam', '2004-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, '4 שורות', 'אור', '2004-01-01', 4, 'dunam', '8 | 4 שורות', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1)),
    (v_area_id, 1, 'אור בוגר', 'אור', '2004-01-01', 10, 'dunam', '8 | אור בוגר', (SELECT id FROM crops WHERE name = 'הדרים' LIMIT 1));

  -- ===== Area 9 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('9', 'חלקה 9', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1), 18, 'dunam', '2011-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'אור', 'אור', '2011-01-01', 18, 'dunam', '9 | אור', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1));

  -- ===== Area 10 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('10', 'חלקה 10', (SELECT id FROM crops WHERE name = 'אפרסק' LIMIT 1), 15.15, 'dunam', '2016-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, '1881', '1-881', '2016-01-01', 6, 'dunam', '10 | 1881', (SELECT id FROM crops WHERE name = 'אפרסק' LIMIT 1)),
    (v_area_id, 1, 'רוויטל', 'רויטל', '2016-01-01', 3.75, 'dunam', '10 | רוויטל', (SELECT id FROM crops WHERE name = 'נקטרינה' LIMIT 1)),
    (v_area_id, 1, 'דורינה', 'דורינה', '2016-01-01', 3.3, 'dunam', '10 | דורינה', (SELECT id FROM crops WHERE name = 'נקטרינה' LIMIT 1)),
    (v_area_id, 1, 'עקירה דרום', 'עקירה', '2016-01-01', 2.1, 'dunam', '10 | עקירה דרום', NULL);

  -- ===== Area 11 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('11', 'חלקה 11', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1), 30, 'dunam', '2000-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'אבוקדו בוגר מערב', 'אבוקדו (שוקה)', '2000-01-01', 30, 'dunam', '11 | אבוקדו בוגר מערב', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1)),
    (v_area_id, 1, 'אבוקדו בוגר מזרח', 'אבוקדו (שוקה)', '2000-01-01', NULL, NULL, '11 | אבוקדו בוגר מזרח', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1)),
    (v_area_id, 1, 'אבוקדו הרכבות', 'אבוקדו (שוקה)', '2000-01-01', NULL, NULL, '11 | אבוקדו הרכבות', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1));

  -- ===== Area 12 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('12', 'חלקה 12', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1), 26, 'dunam', '2000-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'אבוקדו (נבי יהודה-אדרי) צפון', 'אבוקדו (נבי יהודה-אדרי)', '2000-01-01', 26, 'dunam', '12 | אבוקדו (נבי יהודה-אדרי) צפון', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1));

  -- ===== Area 13 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('13', 'חלקה 13', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1), 19, 'dunam', '2023-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'זן 50 מערב', 'זן 50 ראשי', '2023-01-01', 19, 'dunam', '13 | זן 50 מערב', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'זן 50 מזרח', 'זן 50 ראשי', '2023-01-01', NULL, NULL, '13 | זן 50 מזרח', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'זן 45 מפרה', 'זן 45 מפרה', '2023-01-01', NULL, NULL, '13 | זן 45 מפרה', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'זן 31', 'זן 31', '2023-01-01', NULL, NULL, '13 | זן 31', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1)),
    (v_area_id, 1, 'זן 41', 'זן 41', '2023-01-01', NULL, NULL, '13 | זן 41', (SELECT id FROM crops WHERE name = 'שזיף' LIMIT 1));

  -- ===== Area 14 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('14', 'חלקה 14', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1), 6, 'dunam', '2023-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'משמש צלי', 'משמש צלי', '2023-01-01', 6, 'dunam', '14 | משמש צלי', (SELECT id FROM crops WHERE name = 'משמש' LIMIT 1));

  -- ===== Area 15 =====
  INSERT INTO areas (name, description, crop_id, size, size_unit_type, planting_time)
  VALUES ('15', 'חלקה 15', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1), 20, 'dunam', '1985-01-01')
  RETURNING id INTO v_area_id;
  INSERT INTO customer_areas (customer_id, area_id) VALUES (v_customer_id, v_area_id);

  INSERT INTO sub_areas (area_id, level, name, variety, planting_time, size, size_unit_type, display, crop_id) VALUES
    (v_area_id, 1, 'אבוקדו אלימלך', 'אבוקדו אלימלך', '1985-01-01', 20, 'dunam', '15 | אבוקדו אלימלך', (SELECT id FROM crops WHERE name = 'אבוקדו' LIMIT 1));

END $$;

-- Verify results
SELECT 'Areas' AS type, COUNT(*) AS count FROM areas WHERE id IN (
  SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
)
UNION ALL
SELECT 'Sub-areas', COUNT(*) FROM sub_areas WHERE area_id IN (
  SELECT area_id FROM customer_areas WHERE customer_id = '364c2ab0-985e-47d7-b486-fce31415ad76'
);

COMMIT;
