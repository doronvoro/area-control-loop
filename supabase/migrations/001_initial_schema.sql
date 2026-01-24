-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Worker Types lookup table
CREATE TABLE worker_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worker_types_name ON worker_types(name);

-- Customers (Companies/Organizations)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_name ON customers(name);

-- Workers (belong to customers, linked to auth users)
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  type_id UUID NOT NULL REFERENCES worker_types(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workers_customer_id ON workers(customer_id);
CREATE INDEX idx_workers_user_id ON workers(user_id);
CREATE INDEX idx_workers_type_id ON workers(type_id);
CREATE INDEX idx_workers_name ON workers(name);

-- Invitations (Unified table for customer and worker invitations)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('customer', 'worker')),
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  worker_type_id UUID REFERENCES worker_types(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_invitation_type ON invitations(invitation_type);
CREATE INDEX idx_invitations_invited_by_user_id ON invitations(invited_by_user_id);
CREATE INDEX idx_invitations_invited_user_id ON invitations(invited_user_id);
CREATE INDEX idx_invitations_customer_id ON invitations(customer_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX idx_invitations_worker_type_id ON invitations(worker_type_id);

-- Areas
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_areas_name ON areas(name);

-- Customer Areas (Junction Table)
CREATE TABLE customer_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, area_id)
);

CREATE INDEX idx_customer_areas_customer_id ON customer_areas(customer_id);
CREATE INDEX idx_customer_areas_area_id ON customer_areas(area_id);

-- Sub Areas (Hierarchical structure with parent-child relationships)
CREATE TABLE sub_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  parent_sub_area_id UUID REFERENCES sub_areas(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  variety TEXT,
  rows TEXT,
  display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_areas_area_id ON sub_areas(area_id);
CREATE INDEX idx_sub_areas_parent_sub_area_id ON sub_areas(parent_sub_area_id);
CREATE INDEX idx_sub_areas_level ON sub_areas(level);
CREATE INDEX idx_sub_areas_name ON sub_areas(name);

-- Report Areas
CREATE TABLE report_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_areas_area_id ON report_areas(area_id);
CREATE INDEX idx_report_areas_type ON report_areas(type);
CREATE INDEX idx_report_areas_name ON report_areas(name);

-- Action Types
CREATE TABLE action_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_action_types_name ON action_types(name);

-- Unit Types
CREATE TABLE unit_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unit_types_name ON unit_types(name);

-- Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_findings_name ON findings(name);
CREATE INDEX idx_findings_severity ON findings(severity);

-- Monitoring Area Report
CREATE TABLE monitoring_area_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_report_id UUID NOT NULL REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID NOT NULL REFERENCES sub_areas(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  recommend_material TEXT,
  recommend_dosage TEXT,
  recommend_unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,
  recommend_action_type_id UUID REFERENCES action_types(id) ON DELETE SET NULL,
  actions_area_report_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_report_id, sub_area_id)
);

CREATE INDEX idx_monitoring_area_report_area_report_id ON monitoring_area_report(area_report_id);
CREATE INDEX idx_monitoring_area_report_sub_area_id ON monitoring_area_report(sub_area_id);
CREATE INDEX idx_monitoring_area_report_finding_id ON monitoring_area_report(finding_id);
CREATE INDEX idx_monitoring_area_report_recommend_action_type_id ON monitoring_area_report(recommend_action_type_id);
CREATE INDEX idx_monitoring_area_report_recommend_unit_type_id ON monitoring_area_report(recommend_unit_type_id);
CREATE INDEX idx_monitoring_area_report_status ON monitoring_area_report(status);
CREATE INDEX idx_monitoring_area_report_actions_area_report_id ON monitoring_area_report(actions_area_report_id);

-- Actions Area Report
CREATE TABLE actions_area_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_report_id UUID NOT NULL REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID NOT NULL REFERENCES sub_areas(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  material TEXT,
  dosage TEXT,
  unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,
  action_type_id UUID REFERENCES action_types(id) ON DELETE SET NULL,
  action_time TIMESTAMPTZ,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_actions_area_report_area_report_id ON actions_area_report(area_report_id);
CREATE INDEX idx_actions_area_report_sub_area_id ON actions_area_report(sub_area_id);
CREATE INDEX idx_actions_area_report_finding_id ON actions_area_report(finding_id);
CREATE INDEX idx_actions_area_report_action_type_id ON actions_area_report(action_type_id);
CREATE INDEX idx_actions_area_report_unit_type_id ON actions_area_report(unit_type_id);
CREATE INDEX idx_actions_area_report_status ON actions_area_report(status);
CREATE INDEX idx_actions_area_report_action_time ON actions_area_report(action_time);

-- Add foreign key constraint for monitoring_area_report.actions_area_report_id
-- This needs to be added after actions_area_report table is created
ALTER TABLE monitoring_area_report
ADD CONSTRAINT fk_monitoring_actions_area_report
FOREIGN KEY (actions_area_report_id) REFERENCES actions_area_report(id) ON DELETE SET NULL;
