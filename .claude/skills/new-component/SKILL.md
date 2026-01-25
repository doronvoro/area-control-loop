---
name: new-component
description: Create a new React component with RTL/Hebrew support
argument-hint: [component-name]
disable-model-invocation: true
---

Create a new React component: $ARGUMENTS

## Location

- UI components: `components/ui/`
- Feature components: `components/<feature>/`
- Layout components: `components/layout/`

## Template (Client Component)

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ComponentNameProps {
  // props
}

export function ComponentName({ }: ComponentNameProps) {
  return (
    <div className="space-y-4">
      {/* RTL-aware: use start/end instead of left/right */}
      <div className="text-start ps-4 me-2">
        Content here
      </div>
    </div>
  );
}
```

## Template (Server Component)

```typescript
import { createClient } from '@/lib/supabase/server';

interface ComponentNameProps {
  // props
}

export async function ComponentName({ }: ComponentNameProps) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('table')
    .select('*');

  return (
    <div className="space-y-4">
      {/* Content */}
    </div>
  );
}
```

## RTL Guidelines

Use Tailwind RTL plugin classes:
- `ps-*` / `pe-*` instead of `pl-*` / `pr-*` (padding)
- `ms-*` / `me-*` instead of `ml-*` / `mr-*` (margin)
- `start-*` / `end-*` instead of `left-*` / `right-*`
- `text-start` / `text-end` instead of `text-left` / `text-right`

## Checklist

- [ ] Use RTL-aware Tailwind classes
- [ ] Hebrew text displays correctly
- [ ] Import shadcn/ui components from `@/components/ui/`
- [ ] Add TypeScript props interface
- [ ] Consider mobile responsiveness
