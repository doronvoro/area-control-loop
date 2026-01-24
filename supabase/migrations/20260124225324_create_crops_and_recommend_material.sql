-- Create Materials table (referenced by recommend_material.material_id)
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_name ON materials(name);

-- Create Crops table
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crops_name ON crops(name);

-- Create Recommend Material table
CREATE TABLE IF NOT EXISTS recommend_material (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  dosage TEXT NOT NULL,
  unit_type_id UUID NOT NULL REFERENCES unit_types(id) ON DELETE RESTRICT,
  action_type_id UUID NOT NULL REFERENCES action_types(id) ON DELETE RESTRICT,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recommend_material_finding_id ON recommend_material(finding_id);
CREATE INDEX idx_recommend_material_material_id ON recommend_material(material_id);
CREATE INDEX idx_recommend_material_unit_type_id ON recommend_material(unit_type_id);
CREATE INDEX idx_recommend_material_action_type_id ON recommend_material(action_type_id);
CREATE INDEX idx_recommend_material_crop_id ON recommend_material(crop_id);
