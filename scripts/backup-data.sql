-- =============================================================
-- Area Control Loop - Full Data Backup Script
-- Run with: psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/backup-data.sql
-- Or use pg_dump for a complete backup (see below)
-- =============================================================

-- This script exports all table data as COPY statements to stdout.
-- For a full backup, use pg_dump instead:
--
--   # Full backup (schema + data):
--   pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres > backup_full.sql
--
--   # Data only:
--   pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres --data-only -T 'auth.*' -T 'storage.*' -T 'supabase_*.*' -T 'extensions.*' -T 'pgbouncer.*' -T 'pgsodium.*' -T 'vault.*' -T 'realtime.*' > backup_data_only.sql
--
--   # Data only as INSERT statements (portable, easier to edit):
--   pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres --data-only --inserts -T 'auth.*' -T 'storage.*' -T 'supabase_*.*' -T 'extensions.*' -T 'pgbouncer.*' -T 'pgsodium.*' -T 'vault.*' -T 'realtime.*' > backup_inserts.sql
--
--   # Restore from backup:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backup_full.sql

-- =============================================================
-- QUERY: View row counts for all application tables
-- =============================================================
SELECT 'worker_types' AS table_name, COUNT(*) AS row_count FROM public.worker_types
UNION ALL SELECT 'report_area_types', COUNT(*) FROM public.report_area_types
UNION ALL SELECT 'roles', COUNT(*) FROM public.roles
UNION ALL SELECT 'permissions', COUNT(*) FROM public.permissions
UNION ALL SELECT 'role_permissions', COUNT(*) FROM public.role_permissions
UNION ALL SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL SELECT 'customers', COUNT(*) FROM public.customers
UNION ALL SELECT 'workers', COUNT(*) FROM public.workers
UNION ALL SELECT 'crops', COUNT(*) FROM public.crops
UNION ALL SELECT 'findings', COUNT(*) FROM public.findings
UNION ALL SELECT 'crop_findings', COUNT(*) FROM public.crop_findings
UNION ALL SELECT 'materials', COUNT(*) FROM public.materials
UNION ALL SELECT 'unit_types', COUNT(*) FROM public.unit_types
UNION ALL SELECT 'action_types', COUNT(*) FROM public.action_types
UNION ALL SELECT 'areas', COUNT(*) FROM public.areas
UNION ALL SELECT 'sub_areas', COUNT(*) FROM public.sub_areas
UNION ALL SELECT 'customer_areas', COUNT(*) FROM public.customer_areas
UNION ALL SELECT 'report_areas', COUNT(*) FROM public.report_areas
UNION ALL SELECT 'monitoring_area_report', COUNT(*) FROM public.monitoring_area_report
UNION ALL SELECT 'monitoring_treatments', COUNT(*) FROM public.monitoring_treatments
UNION ALL SELECT 'actions_area_report', COUNT(*) FROM public.actions_area_report
UNION ALL SELECT 'action_treatments', COUNT(*) FROM public.action_treatments
UNION ALL SELECT 'recommend_material', COUNT(*) FROM public.recommend_material
UNION ALL SELECT 'invitations', COUNT(*) FROM public.invitations
UNION ALL SELECT 'import_batches', COUNT(*) FROM public.import_batches
UNION ALL SELECT 'pesticide_registry', COUNT(*) FROM public.pesticide_registry
ORDER BY table_name;
