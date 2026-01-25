---
name: new-api
description: Create a new API route following project patterns
argument-hint: [route-name]
disable-model-invocation: true
---

Create a new API route for: $ARGUMENTS

## Location

Create in `app/api/<route-name>/route.ts`

## Template

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your logic here
  const { data, error } = await supabase
    .from('table_name')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate with zod if needed
  // const validated = schema.parse(body);

  const { data, error } = await supabase
    .from('table_name')
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## Checklist

- [ ] Use `createClient()` from `lib/supabase/server.ts`
- [ ] Check authentication
- [ ] Handle errors properly
- [ ] Return appropriate status codes
- [ ] Add zod validation for POST/PUT bodies
- [ ] Consider RLS policies for data access
