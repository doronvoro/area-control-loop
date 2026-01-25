---
name: deploy
description: Deploy the application to Vercel
disable-model-invocation: true
---

Deploy the Area Control Loop application to Vercel.

## Pre-Deploy Checklist

1. **Build check**
   ```bash
   npm run build
   ```

2. **Lint check**
   ```bash
   npm run lint
   ```

3. **Environment variables**
   Ensure these are set in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deploy Commands

### Preview Deploy
```bash
vercel
```

### Production Deploy
```bash
vercel --prod
```

### Using Vercel MCP
If Vercel MCP is configured, use its tools to deploy.

## Post-Deploy

1. Verify the deployment URL works
2. Test authentication flow
3. Check Hebrew/RTL rendering
4. Verify Supabase connection

## Rollback

If issues occur:
```bash
vercel rollback
```
