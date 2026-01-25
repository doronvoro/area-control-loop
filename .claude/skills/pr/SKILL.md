---
name: pr
description: Create a pull request with proper format
argument-hint: [branch-name or description]
disable-model-invocation: true
---

Create a pull request for: $ARGUMENTS

## Steps

1. **Check current state**
   ```bash
   git status
   git log --oneline -5
   ```

2. **Create branch if needed**
   ```bash
   git checkout -b feature/<branch-name>
   ```

3. **Push to remote**
   ```bash
   git push -u origin <branch-name>
   ```

4. **Create PR**
   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   - <bullet points of changes>

   ## Test plan
   - [ ] Tested locally with `npm run dev`
   - [ ] Verified RTL/Hebrew display
   - [ ] Checked RLS policies if data changes
   - [ ] Build passes: `npm run build`

   ## Related issues
   Fixes #<issue-number> (if applicable)

   ---
   Generated with Claude Code
   EOF
   )"
   ```

## PR Title Conventions

- `feat: <description>` - New feature
- `fix: <description>` - Bug fix
- `refactor: <description>` - Code refactoring
- `docs: <description>` - Documentation
- `chore: <description>` - Maintenance

## Checklist

- [ ] Code follows project patterns
- [ ] No console.log or debug code
- [ ] Types updated if needed
- [ ] RTL-aware styling used
