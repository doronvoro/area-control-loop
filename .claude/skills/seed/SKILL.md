---
name: seed
description: Seed the database with test data using existing scripts
disable-model-invocation: true
---

Seed the database with test data.

## Available Seed Commands

Run these commands (require SUPABASE_SERVICE_ROLE_KEY):

```bash
# Create admin user (admin@example.com / admin123)
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-admin

# Create sample workers
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-workers

# Seed comprehensive data
SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed-data

# Create test users
SUPABASE_SERVICE_ROLE_KEY=<key> npm run create-test-users
```

## Steps

1. Check if Supabase is running: `npx supabase status`
2. Get the service role key from status output
3. Run the appropriate seed script
4. Verify data was created

## Notes

- Scripts are in the `scripts/` directory
- Run `npx supabase db reset` first for a clean slate
- Worker types: 'inspector' and 'action_worker'
