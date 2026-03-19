-- Get recommended materials for finding "אקרית החלודה" and crop "אפרסק"

SELECT
  m.name AS material_name,
  m.active_ingredient,
  rm.dosage,
  ut.name AS unit_type,
  CASE rm.action_type_id
    WHEN 'spray' THEN 'ריסוס'
    WHEN 'drench' THEN 'הגמעה'
    WHEN 'spread' THEN 'פיזור'
    ELSE 'כל סוגי הפעולות'
  END AS action_type,
  rm.source
FROM recommend_material rm
JOIN crops c ON c.id = rm.crop_id
JOIN findings f ON f.id = rm.finding_id
JOIN materials m ON m.id = rm.material_id
LEFT JOIN unit_types ut ON ut.id = rm.unit_type_id
WHERE f.name = 'אקרית החלודה'
  AND c.name = 'אפרסק'
ORDER BY m.name, rm.action_type_id;
