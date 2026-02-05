-- =============================================
-- Migration: Link Monitoring Treatments to Action Treatments
-- Date: 2026-02-01
-- Description: Add action_treatment_id FK to monitoring_treatments for tracking fulfillment
-- Note: Status sync is handled in application code (not via trigger)
-- =============================================

-- =============================================
-- 1. Add action_treatment_id column to monitoring_treatments
-- =============================================
ALTER TABLE monitoring_treatments
  ADD COLUMN IF NOT EXISTS action_treatment_id UUID REFERENCES action_treatments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_monitoring_treatments_action ON monitoring_treatments(action_treatment_id);
