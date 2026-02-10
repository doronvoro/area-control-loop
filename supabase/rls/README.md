# Row Level Security (RLS) Documentation

This folder contains the consolidated documentation and reference files for the Row Level Security implementation in this project.

## Overview

The application uses a multi-tenant security model where:
- **Customers** own their data and can manage their workers
- **Workers** belong to customers and can access that customer's data
- **Admins** have full access to all data
- **Inspectors** can create/update monitoring reports
- **Action Workers** can create/update action reports

## Files in This Folder

| File | Purpose |
|------|---------|
| `functions.sql` | All RLS helper functions (reference) |
| `policies.sql` | Complete list of all RLS policies (reference) |
| `tests.sql` | RLS test queries for verification |
| `README.md` | This documentation |

> **Note:** These are REFERENCE files, not migrations. The actual policies are created via migrations in `supabase/migrations/`.

## Security Model

### Access Hierarchy

```
Admin (is_admin_user = true)
   ↓ Full access to all data
Customer Owner (customers.user_id = auth.uid())
   ↓ Manages their customer, workers, and areas
Worker (workers.user_id = auth.uid())
   ↓ Access to their customer's data
   ├── Inspector → Can create/update monitoring reports
   └── Action Worker → Can create/update action reports
```

### Table Access Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **customers** | Owner + Admin | Owner | Owner | - |
| **workers** | Customer + Workers + Admin | Customer Owner | Customer Owner | - |
| **customer_areas** | Customer + Workers + Admin | Customer Owner + Admin | Customer Owner + Admin | Customer Owner + Admin |
| **areas** | Via customer_areas + Admin | Admin | Admin | Admin |
| **sub_areas** | Via parent area + Admin | Admin | Admin | Admin |
| **report_areas** | Via areas + Admin | Admin | Admin | Admin |
| **monitoring_area_report** | Via report_areas + Admin | Inspector + Admin | Inspector + Admin | Admin |
| **actions_area_report** | Via report_areas + Admin | Action Worker + Admin | Action Worker + Admin | Admin |
| **user_roles** | All authenticated | - | - | - |
| **Lookup tables** | All authenticated | - | - | - |

## Helper Functions

### `is_admin_user(p_user_id UUID)`
Checks if user has the 'admin' role. Uses `SECURITY DEFINER` to bypass RLS.

```sql
SELECT is_admin_user(auth.uid()); -- Returns true/false
```

### `is_worker_in_customer(p_customer_id UUID, p_user_id UUID)`
Checks if user is a worker in a specific customer. Used to prevent infinite recursion in workers table policies.

```sql
SELECT is_worker_in_customer('customer-uuid', auth.uid());
```

### `has_permission(p_user_id UUID, p_permission_name TEXT)`
Checks if user has a specific permission through their roles.

```sql
SELECT has_permission(auth.uid(), 'create_monitoring_report');
```

### `has_role(p_user_id UUID, p_role_name TEXT)`
Checks if user has a specific role.

```sql
SELECT has_role(auth.uid(), 'admin');
```

## Common Patterns

### 1. Customer Owner Check
```sql
EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = <table>.customer_id
  AND customers.user_id = auth.uid()
)
```

### 2. Worker in Same Customer Check
```sql
EXISTS (
  SELECT 1 FROM workers w
  WHERE w.customer_id = <table>.customer_id
  AND w.user_id = auth.uid()
)
-- OR use the helper function to avoid recursion:
is_worker_in_customer(<table>.customer_id, auth.uid())
```

### 3. Access Via customer_areas (for areas/sub_areas)
```sql
EXISTS (
  SELECT 1 FROM customer_areas ca
  JOIN customers c ON c.id = ca.customer_id
  WHERE ca.area_id = areas.id
  AND (c.user_id = auth.uid() OR is_worker_in_customer(c.id, auth.uid()))
)
```

### 4. Admin Bypass
```sql
is_admin_user(auth.uid())
```

### 5. Worker Type Check (for reports)
```sql
EXISTS (
  SELECT 1 FROM workers w
  JOIN worker_types wt ON wt.id = w.type_id
  WHERE w.user_id = auth.uid()
  AND wt.name = 'inspector'  -- or 'action_worker'
)
```

## Adding New Tables

When adding a new table with RLS:

1. **Enable RLS**:
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

2. **Create policies** using existing patterns:
   - SELECT: Who can view?
   - INSERT: Who can create?
   - UPDATE: Who can modify?
   - DELETE: Who can remove?

3. **Add admin bypass** if admins should have full access:
   ```sql
   CREATE POLICY "Admins can access new_table"
     ON new_table FOR ALL
     USING (is_admin_user(auth.uid()));
   ```

4. **Update this documentation** in `policies.sql` and `README.md`

## Debugging RLS Issues

### Check if RLS is enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### View all policies for a table
```sql
SELECT * FROM pg_policies WHERE tablename = 'areas';
```

### Test as a specific user
```sql
-- In Supabase SQL editor or psql
SET request.jwt.claims = '{"sub": "user-uuid-here"}';
SET ROLE authenticated;
SELECT * FROM areas; -- Will apply RLS
RESET ROLE;
```

### Check why a query returns empty
```sql
-- Test each condition separately
SELECT is_admin_user('user-uuid');
SELECT is_worker_in_customer('customer-uuid', 'user-uuid');
SELECT * FROM customer_areas WHERE customer_id = 'customer-uuid';
```

## Migration History

RLS policies are scattered across these migrations:

1. `002_rls_policies.sql` - Initial RLS setup
2. `006_roles_and_permissions.sql` - Role/permission system
3. `20260124193135_fix_rls_and_admin_access.sql` - Fixed recursion, added `is_worker_in_customer`
4. `20260125000000_fix_admin_rls_policies.sql` - Switched to user_roles, added `is_admin_user`
5. `20260131000000_add_admin_insert_policies.sql` - Admin INSERT for monitoring
6. `20260131200000_add_admin_actions_insert_policies.sql` - Admin INSERT for actions
7. `20260206000000_add_admin_areas_policies.sql` - Admin full access to areas/sub_areas
8. `20260213000000_fix_is_admin_function.sql` - Made user_roles publicly readable
9. `20260214000000_fix_areas_rls_for_reports.sql` - Indirect area access via report_areas

## Best Practices

1. **Use helper functions** - Encapsulate complex logic to avoid duplication
2. **Test policies after changes** - Use `tests.sql` to verify behavior
3. **Document changes** - Update this folder when modifying RLS
4. **Consider infinite recursion** - Be careful with self-referential table checks
5. **Use SECURITY DEFINER carefully** - Only when absolutely needed for bypassing RLS
6. **Keep policies simple** - Complex policies are hard to debug and slow
