---
name: rls-policy
description: Create or fix Row Level Security policies for Supabase tables
argument-hint: [table-name]
disable-model-invocation: true
---

Create/fix RLS policy for table: $ARGUMENTS

## Multi-Tenant RLS Pattern

This project uses customer-based multi-tenancy. Workers belong to customers.

## Common Patterns

### Worker Access (via customer_id)

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Select: Workers see their customer's data
CREATE POLICY "Workers can view their customer data"
ON table_name FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id FROM workers WHERE user_id = auth.uid()
  )
);

-- Insert: Workers can insert for their customer
CREATE POLICY "Workers can insert for their customer"
ON table_name FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT customer_id FROM workers WHERE user_id = auth.uid()
  )
);

-- Update: Workers can update their customer's data
CREATE POLICY "Workers can update their customer data"
ON table_name FOR UPDATE
USING (
  customer_id IN (
    SELECT customer_id FROM workers WHERE user_id = auth.uid()
  )
);
```

### Admin Access

```sql
-- Admins can do everything
CREATE POLICY "Admins have full access"
ON table_name FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workers
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
```

## Steps

1. Check existing policies: `SELECT * FROM pg_policies WHERE tablename = 'table_name';`
2. Create migration in `supabase/migrations/`
3. Test with different user roles
4. Run `npx supabase db reset` to apply

## Debug Script

Use `scripts/fix-rls-policies.ts` for common fixes.
