# Authorization Roles and Permissions

This document describes the role-based authorization system for the area-control-loop application.

## Roles

### 1. Admin (מנהל מערכת)
**Description:** System administrator with full management capabilities (except creating reports)

**Permissions:**
- ✅ Create Customer
- ✅ Read Customer
- ✅ Update Customer
- ✅ Delete Customer
- ✅ Create Worker
- ✅ Read Worker
- ✅ Update Worker
- ✅ Delete Worker
- ✅ Create Area
- ✅ Read Area
- ✅ Update Area
- ✅ Delete Area
- ✅ Create Sub-Area
- ✅ Read Sub-Area
- ✅ Update Sub-Area
- ✅ Delete Sub-Area
- ✅ Add Area to Customer
- ✅ Remove Area from Customer
- ✅ Read Monitoring Report
- ✅ Read Action Report
- ❌ **Cannot** Create Monitoring Report
- ❌ **Cannot** Create Action Report

### 2. Customer Owner (בעל לקוח)
**Description:** Customer owner who manages their own customer's resources

**Permissions:**
- ✅ Read Customer (own)
- ✅ Update Customer (own)
- ✅ Create Worker (for own customer)
- ✅ Read Worker (for own customer)
- ✅ Update Worker (for own customer)
- ✅ Delete Worker (for own customer)
- ✅ Create Area
- ✅ Read Area
- ✅ Update Area
- ✅ Delete Area
- ✅ Create Sub-Area
- ✅ Read Sub-Area
- ✅ Update Sub-Area
- ✅ Delete Sub-Area
- ✅ Add Area to Customer (own customer)
- ✅ Remove Area from Customer (own customer)
- ✅ Read Monitoring Report
- ✅ Read Action Report
- ❌ **Cannot** Create Customer
- ❌ **Cannot** Delete Customer
- ❌ **Cannot** Create Monitoring Report
- ❌ **Cannot** Create Action Report

### 3. Worker (עובד)
**Description:** Worker who can create and view reports

**Permissions:**
- ✅ Read Customer (own customer)
- ✅ Read Worker (own customer)
- ✅ Read Area (accessible areas)
- ✅ Read Sub-Area (accessible sub-areas)
- ✅ Create Monitoring Report
- ✅ Read Monitoring Report
- ✅ Update Monitoring Report (own reports)
- ✅ Create Action Report
- ✅ Read Action Report
- ✅ Update Action Report (own reports)
- ❌ **Cannot** Create/Update/Delete Customer
- ❌ **Cannot** Create/Update/Delete Worker
- ❌ **Cannot** Create/Update/Delete Area
- ❌ **Cannot** Create/Update/Delete Sub-Area
- ❌ **Cannot** Manage Customer-Area links

## Database Tables

### `roles`
Stores role definitions:
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE) - e.g., 'admin', 'customer_owner', 'worker'
- `display_name` (TEXT) - Hebrew display name
- `description` (TEXT)

### `permissions`
Stores permission definitions:
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE) - e.g., 'create_customer', 'read_worker'
- `display_name` (TEXT) - Hebrew display name
- `description` (TEXT)
- `resource` (TEXT) - e.g., 'customer', 'worker', 'area', 'report'
- `action` (TEXT) - e.g., 'create', 'read', 'update', 'delete'

### `role_permissions`
Junction table linking roles to permissions:
- `role_id` (UUID, FK to roles.id)
- `permission_id` (UUID, FK to permissions.id)
- UNIQUE(role_id, permission_id)

### `user_roles`
Junction table linking users to roles:
- `user_id` (UUID, FK to auth.users.id)
- `role_id` (UUID, FK to roles.id)
- UNIQUE(user_id, role_id)

## Helper Functions

### `has_permission(p_user_id UUID, p_permission_name TEXT)`
Returns true if the user has the specified permission.

### `has_role(p_user_id UUID, p_role_name TEXT)`
Returns true if the user has the specified role.

## Usage in Code

```typescript
import { hasPermission, hasRole, requirePermission } from '@/lib/permissions';

// Check permission
const canCreateCustomer = await hasPermission('create_customer');

// Check role
const isAdmin = await hasRole('admin');

// Require permission (throws if not present)
await requirePermission('create_worker');
```

## Assigning Roles

Run the script to assign roles to existing users:

```bash
SUPABASE_SERVICE_ROLE_KEY=<key> npm run assign-roles
```

This will:
- Assign `admin` role to admin@example.com
- Assign `customer_owner` role to all customer owners
- Assign `worker` role to all workers

## Permission Matrix

| Permission | Admin | Customer Owner | Worker |
|------------|-------|----------------|--------|
| create_customer | ✅ | ❌ | ❌ |
| create_worker | ✅ | ✅ | ❌ |
| create_area | ✅ | ✅ | ❌ |
| create_sub_area | ✅ | ✅ | ❌ |
| add_area_to_customer | ✅ | ✅ | ❌ |
| create_monitoring_report | ❌ | ❌ | ✅ |
| create_action_report | ❌ | ❌ | ✅ |
