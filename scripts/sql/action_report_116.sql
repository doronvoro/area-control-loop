-- Full data for action report 116
-- Run with: docker exec supabase_db_area-control-loop psql -U postgres -f /dev/stdin < scripts/sql/action_report_116.sql

-- 1) Report header
SELECT
  r.id, r.name, r.status, r.report_date, r.created_at,
  a.name AS area_name,
  w.name AS worker_name,
  rat.display_name AS report_type
FROM report_areas r
LEFT JOIN areas a ON a.id = r.area_id
LEFT JOIN workers w ON w.id = r.worker_id
LEFT JOIN report_area_types rat ON rat.name = r.area_type_id
WHERE r.area_type_id = 'action'
ORDER BY r.created_at DESC;

-- 2) Action entries (findings per sub-area)
SELECT
  aar.id AS entry_id, aar.severity, aar.created_at,
  r.name AS report_name,
  sa.name AS sub_area, sa.display AS sub_area_display,
  f.name AS finding_name, f.description AS finding_desc
FROM actions_area_report aar
JOIN report_areas r ON r.id = aar.area_report_id
LEFT JOIN sub_areas sa ON sa.id = aar.sub_area_id
LEFT JOIN findings f ON f.id = aar.finding_id
WHERE r.area_type_id = 'action'
ORDER BY r.created_at DESC;

-- 3) Action treatments (material, dosage, status)
SELECT
  r.name AS report_name,
  t.id AS treatment_id, t.dosage, t.notes, t.status, t.action_time, t.action_type_id,
  t.material_id,
  m.name AS material_name,
  ut.name AS unit_type_name
FROM action_treatments t
JOIN actions_area_report aar ON aar.id = t.action_report_id
JOIN report_areas r ON r.id = aar.area_report_id
LEFT JOIN materials m ON m.id = t.material_id
LEFT JOIN unit_types ut ON ut.id = t.unit_type_id
WHERE r.area_type_id = 'action'
ORDER BY r.created_at DESC;
