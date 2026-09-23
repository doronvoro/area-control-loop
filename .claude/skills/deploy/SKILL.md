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
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only. Required at runtime, not just by
     scripts: `getApiContext()` calls `createAdminClient()`, which throws without it
   - `CRON_SECRET` — Production. Vercel sends it as the `Authorization` header on
     cron invocations; `/api/cron/*` fails closed (401) when it is missing

   Env var changes only apply to deployments created afterwards, so set a new one
   **before** merging the code that needs it.

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
5. **Cron jobs** — Settings → Cron Jobs should list each entry from `vercel.json`
   with a next-run time. An empty list means `vercel.json` never reached the
   deployment. Use the row's run action to trigger one on demand, then **View
   Logs** to confirm it returned 200. No log line at all means the request was
   redirected or never delivered, not that it succeeded.

## Rollback

If issues occur:
```bash
vercel rollback
```

Note: **Instant Rollback does not update cron jobs.** They keep running the
schedule from the rolled-forward config until disabled in Settings → Cron Jobs
or changed in `vercel.json` and redeployed.
