---
name: fix-issue
description: Fix a GitHub issue by number
argument-hint: [issue-number]
disable-model-invocation: true
---

Fix GitHub issue #$ARGUMENTS

## Steps

1. **Read the issue**
   ```bash
   gh issue view $ARGUMENTS
   ```

2. **Understand requirements**
   - What is the expected behavior?
   - What is the current behavior?
   - Are there reproduction steps?

3. **Find relevant code**
   - Search for related files
   - Understand the current implementation

4. **Implement the fix**
   - Follow project patterns
   - Keep changes minimal and focused
   - Consider RTL/Hebrew implications

5. **Test the fix**
   - Run `npm run dev` and test manually
   - Ensure no regressions

6. **Commit with issue reference**
   ```bash
   git add <files>
   git commit -m "Fix #$ARGUMENTS: <description>"
   ```

## Reminders

- Don't over-engineer the solution
- Update types in `types/database.ts` if needed
- Consider RLS policies for data changes
- Test in Hebrew/RTL mode
