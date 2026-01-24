-- Seed Worker Types
INSERT INTO worker_types (name, display_name, description) VALUES
  ('inspector', 'פקח', 'Inspector worker type'),
  ('action_worker', 'רסס', 'Action worker type')
ON CONFLICT (name) DO NOTHING;

-- Seed Action Types (example data)
INSERT INTO action_types (name, description) VALUES
  ('spray', 'Spray action'),
  ('prune', 'Prune action'),
  ('treat', 'Treatment action'),
  ('monitor', 'Monitoring action')
ON CONFLICT DO NOTHING;

-- Seed Unit Types (example data)
INSERT INTO unit_types (name, description) VALUES
  ('ml', 'Milliliters'),
  ('l', 'Liters'),
  ('kg', 'Kilograms'),
  ('g', 'Grams'),
  ('units', 'Units')
ON CONFLICT DO NOTHING;

-- Seed Findings (example data)
INSERT INTO findings (name, description, severity) VALUES
  ('pest_infestation', 'Pest infestation', 'high'),
  ('disease', 'Plant disease', 'medium'),
  ('nutrient_deficiency', 'Nutrient deficiency', 'low'),
  ('weed_growth', 'Weed growth', 'low')
ON CONFLICT DO NOTHING;
