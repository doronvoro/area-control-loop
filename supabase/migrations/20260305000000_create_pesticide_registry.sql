-- Create pesticide registry tables for importing Israeli Ministry of Agriculture CSV data
-- The registry stores the full CSV as reference, then syncs into lookup tables and recommend_material

BEGIN;

-- ============================================================
-- 1. Import batches (audit trail for imports)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  error_log JSONB,
  imported_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Pesticide registry (stores full CSV data)
-- ============================================================
CREATE TABLE IF NOT EXISTS pesticide_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Core fields mapped to lookup tables
  crop_name TEXT NOT NULL,
  crop_name_en TEXT,
  pest_name TEXT,
  pest_name_en TEXT,
  material_name TEXT NOT NULL,
  material_name_en TEXT,
  activity_type TEXT,           -- סוג פעילות (product category, NOT action_type)
  activity_type_en TEXT,
  dosage_text TEXT,             -- raw dosage text from CSV
  volume_text TEXT,             -- raw volume text from CSV

  -- Rich metadata
  license_number TEXT,
  active_ingredient TEXT,
  cas_number TEXT,
  resistance_group TEXT,
  target_code TEXT,
  concentration TEXT,
  concentration_en TEXT,
  formulation TEXT,
  formulation_en TEXT,
  toxicity_info TEXT,
  toxicity_info_en TEXT,
  toxicity_level TEXT,
  toxicity_level_en TEXT,
  license_holder TEXT,
  license_holder_en TEXT,
  manufacturer TEXT,
  manufacturer_en TEXT,
  label_url TEXT,
  crop_group TEXT,
  crop_group_en TEXT,
  pest_group TEXT,
  pest_group_en TEXT,
  pest_latin TEXT,
  approval_date TEXT,
  waiting_period TEXT,
  reentry_period TEXT,
  crop_stage TEXT,
  crop_age TEXT,
  weed_stage TEXT,
  weed_age TEXT,
  operation_type TEXT,
  crop_notes TEXT,
  soil_type TEXT,

  -- FK links (populated during sync step)
  crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
  finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,

  -- Import tracking
  import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  csv_row_number INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_registry_crop_name ON pesticide_registry(crop_name);
CREATE INDEX idx_registry_pest_name ON pesticide_registry(pest_name);
CREATE INDEX idx_registry_material_name ON pesticide_registry(material_name);
CREATE INDEX idx_registry_import_batch ON pesticide_registry(import_batch_id);
CREATE INDEX idx_registry_crop_id ON pesticide_registry(crop_id);
CREATE INDEX idx_registry_finding_id ON pesticide_registry(finding_id);
CREATE INDEX idx_registry_material_id ON pesticide_registry(material_id);

-- ============================================================
-- 3. Add source columns to existing tables
-- ============================================================

-- Source tracking: 'registry' = from CSV import, 'custom' = manual entry
ALTER TABLE crops ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';

-- Add active_ingredient to materials (useful metadata for display)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS active_ingredient TEXT;

-- Add source and registry_id to recommend_material
ALTER TABLE recommend_material ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE recommend_material ADD COLUMN IF NOT EXISTS registry_id UUID REFERENCES pesticide_registry(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recommend_material_source ON recommend_material(source);
CREATE INDEX IF NOT EXISTS idx_recommend_material_registry_id ON recommend_material(registry_id);

-- Make action_type_id nullable (registry imports don't have action types)
ALTER TABLE recommend_material ALTER COLUMN action_type_id DROP NOT NULL;

-- ============================================================
-- 4. RLS policies
-- ============================================================

ALTER TABLE pesticide_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Pesticide registry: readable by all authenticated users
CREATE POLICY "Allow authenticated read pesticide_registry"
  ON pesticide_registry FOR SELECT
  TO authenticated
  USING (true);

-- Pesticide registry: admin can manage
CREATE POLICY "Allow admin manage pesticide_registry"
  ON pesticide_registry FOR ALL
  USING (is_admin_user(auth.uid()));

-- Import batches: admin only
CREATE POLICY "Allow admin read import_batches"
  ON import_batches FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Allow admin manage import_batches"
  ON import_batches FOR ALL
  USING (is_admin_user(auth.uid()));

COMMIT;
