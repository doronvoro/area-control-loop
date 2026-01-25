---
name: test-user
description: Create a test user with a specific role
argument-hint: [role: inspector|action_worker|admin]
disable-model-invocation: true
---

Create a test user with role: $ARGUMENTS

## Worker Types

- `inspector` - Records findings and recommendations (Monitoring phase)
- `action_worker` - Executes actions based on monitoring (Action phase)
- `admin` - Full access

## Using Existing Scripts

```bash
# Create admin user
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-admin

# Create sample workers (inspectors and action workers)
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-workers

# Create test users
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-test-users
```

## Manual Creation

If you need a specific user, create via Supabase:

1. Create auth user in Supabase Dashboard or via API
2. Insert worker record:

```sql
INSERT INTO workers (user_id, customer_id, name, email, worker_type_id, is_active)
VALUES (
  '<auth-user-uuid>',
  '<customer-uuid>',
  'Test User',
  'test@example.com',
  (SELECT id FROM worker_types WHERE name = 'inspector'),
  true
);
```

## Test Credentials

Default test users (after running seed scripts):
- Admin: `admin@example.com` / `admin123`
