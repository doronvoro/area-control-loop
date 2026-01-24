-- Roles and Permissions System
-- This migration creates a role-based authorization system

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_name ON roles(name);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL, -- e.g., 'customer', 'worker', 'area', 'report'
  action TEXT NOT NULL, -- e.g., 'create', 'read', 'update', 'delete'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User-Role junction table (links auth.users to roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Insert default roles
INSERT INTO roles (name, display_name, description) VALUES
  ('admin', 'מנהל מערכת', 'מנהל מערכת - יכול לנהל לקוחות, עובדים ואזורים, לא יכול ליצור דוחות'),
  ('customer_owner', 'בעל לקוח', 'בעל לקוח - יכול לנהל עובדים ואזורים של הלקוח שלו, לא יכול ליצור דוחות'),
  ('worker', 'עובד', 'עובד - יכול ליצור דוחות ניטור ופעולה')
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
  -- Customer permissions
  ('create_customer', 'יצירת לקוח', 'יצירת לקוח חדש', 'customer', 'create'),
  ('read_customer', 'צפייה בלקוח', 'צפייה בפרטי לקוח', 'customer', 'read'),
  ('update_customer', 'עדכון לקוח', 'עדכון פרטי לקוח', 'customer', 'update'),
  ('delete_customer', 'מחיקת לקוח', 'מחיקת לקוח', 'customer', 'delete'),
  
  -- Worker permissions
  ('create_worker', 'יצירת עובד', 'יצירת עובד חדש', 'worker', 'create'),
  ('read_worker', 'צפייה בעובד', 'צפייה בפרטי עובד', 'worker', 'read'),
  ('update_worker', 'עדכון עובד', 'עדכון פרטי עובד', 'worker', 'update'),
  ('delete_worker', 'מחיקת עובד', 'מחיקת עובד', 'worker', 'delete'),
  
  -- Area permissions
  ('create_area', 'יצירת אזור', 'יצירת אזור חדש', 'area', 'create'),
  ('read_area', 'צפייה באזור', 'צפייה בפרטי אזור', 'area', 'read'),
  ('update_area', 'עדכון אזור', 'עדכון פרטי אזור', 'area', 'update'),
  ('delete_area', 'מחיקת אזור', 'מחיקת אזור', 'area', 'delete'),
  
  -- Sub-area permissions
  ('create_sub_area', 'יצירת תת-אזור', 'יצירת תת-אזור חדש', 'sub_area', 'create'),
  ('read_sub_area', 'צפייה בתת-אזור', 'צפייה בפרטי תת-אזור', 'sub_area', 'read'),
  ('update_sub_area', 'עדכון תת-אזור', 'עדכון פרטי תת-אזור', 'sub_area', 'update'),
  ('delete_sub_area', 'מחיקת תת-אזור', 'מחיקת תת-אזור', 'sub_area', 'delete'),
  
  -- Customer-Area permissions
  ('add_area_to_customer', 'הוספת אזור ללקוח', 'קישור אזור ללקוח', 'customer_area', 'create'),
  ('remove_area_from_customer', 'הסרת אזור מלקוח', 'הסרת קישור אזור מלקוח', 'customer_area', 'delete'),
  
  -- Report permissions
  ('create_monitoring_report', 'יצירת דוח ניטור', 'יצירת דוח ניטור חדש', 'monitoring_report', 'create'),
  ('read_monitoring_report', 'צפייה בדוח ניטור', 'צפייה בדוח ניטור', 'monitoring_report', 'read'),
  ('update_monitoring_report', 'עדכון דוח ניטור', 'עדכון דוח ניטור', 'monitoring_report', 'update'),
  
  ('create_action_report', 'יצירת דוח פעולה', 'יצירת דוח פעולה חדש', 'action_report', 'create'),
  ('read_action_report', 'צפייה בדוח פעולה', 'צפייה בדוח פעולה', 'action_report', 'read'),
  ('update_action_report', 'עדכון דוח פעולה', 'עדכון דוח פעולה', 'action_report', 'update')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Admin permissions
DO $$
DECLARE
  admin_role_id UUID;
  customer_owner_role_id UUID;
  worker_role_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO customer_owner_role_id FROM roles WHERE name = 'customer_owner';
  SELECT id INTO worker_role_id FROM roles WHERE name = 'worker';

  -- Admin: can do everything except create reports
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  WHERE name NOT IN ('create_monitoring_report', 'create_action_report')
  ON CONFLICT DO NOTHING;

  -- Customer Owner: can manage workers, areas, sub-areas, and customer-areas, but not create reports
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT customer_owner_role_id, id FROM permissions
  WHERE name IN (
    'read_customer', 'update_customer',
    'create_worker', 'read_worker', 'update_worker', 'delete_worker',
    'create_area', 'read_area', 'update_area', 'delete_area',
    'create_sub_area', 'read_sub_area', 'update_sub_area', 'delete_sub_area',
    'add_area_to_customer', 'remove_area_from_customer',
    'read_monitoring_report', 'read_action_report'
  )
  ON CONFLICT DO NOTHING;

  -- Worker: can create and read reports
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT worker_role_id, id FROM permissions
  WHERE name IN (
    'read_customer', 'read_worker', 'read_area', 'read_sub_area',
    'create_monitoring_report', 'read_monitoring_report', 'update_monitoring_report',
    'create_action_report', 'read_action_report', 'update_action_report'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- Enable RLS on new tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles and permissions (read-only for authenticated users)
CREATE POLICY "Anyone can read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Helper function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_permission_name TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
    AND p.name = p_permission_name
  );
$$ LANGUAGE sql STABLE;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION has_role(
  p_user_id UUID,
  p_role_name TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.name = p_role_name
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION has_role IS 'Check if a user has a specific role';
