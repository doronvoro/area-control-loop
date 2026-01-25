---
name: db-migrate
description: Create a new Supabase database migration with proper naming and structure
argument-hint: [migration-name]
disable-model-invocation: true
---

Create a new Supabase migration for: $ARGUMENTS

## Steps

1. Generate timestamp-based filename: `supabase/migrations/YYYYMMDDHHMMSS_<migration-name>.sql`
2. Follow existing migration patterns from `supabase/migrations/`
3. Include proper comments explaining the migration
4. Consider RLS policies if adding/modifying tables
5. Update `types/database.ts` with new types if needed

## Migration Template

```sql
-- Migration: <description>
-- Created: <date>

-- Add your migration SQL here

-- If adding a table, include RLS:
-- ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "policy_name" ON table_name FOR SELECT USING (auth.uid() = user_id);
```

## Reminders

- Use snake_case for table/column names
- Add foreign key constraints where appropriate
- Consider indexes for frequently queried columns
- Test with `npx supabase db reset` after creating
