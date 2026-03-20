#!/bin/bash
# =============================================================
# Area Control Loop - Database Backup Script
# Usage: ./scripts/backup.sh [full|data|inserts|counts]
# =============================================================

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-54322}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"

# Exclude Supabase internal schemas
EXCLUDE_SCHEMAS="-T 'auth.*' -T 'storage.*' -T 'supabase_*.*' -T 'extensions.*' -T 'pgbouncer.*' -T 'pgsodium.*' -T 'vault.*' -T 'realtime.*' -T 'graphql_public.*' -T '_analytics.*' -T 'pg_*.*'"

mkdir -p "$BACKUP_DIR"

MODE="${1:-full}"

case "$MODE" in
  full)
    echo "Creating full backup (schema + data)..."
    OUTFILE="$BACKUP_DIR/backup_full_${TIMESTAMP}.sql"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --no-owner --no-privileges \
      -N auth -N storage -N supabase_migrations -N supabase_functions \
      -N extensions -N pgbouncer -N pgsodium -N vault -N realtime \
      -N graphql_public -N _analytics \
      > "$OUTFILE"
    echo "Full backup saved to: $OUTFILE"
    ;;
  data)
    echo "Creating data-only backup (COPY format)..."
    OUTFILE="$BACKUP_DIR/backup_data_${TIMESTAMP}.sql"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --data-only --no-owner --no-privileges \
      -N auth -N storage -N supabase_migrations -N supabase_functions \
      -N extensions -N pgbouncer -N pgsodium -N vault -N realtime \
      -N graphql_public -N _analytics \
      > "$OUTFILE"
    echo "Data-only backup saved to: $OUTFILE"
    ;;
  inserts)
    echo "Creating data-only backup (INSERT statements)..."
    OUTFILE="$BACKUP_DIR/backup_inserts_${TIMESTAMP}.sql"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --data-only --inserts --no-owner --no-privileges \
      -N auth -N storage -N supabase_migrations -N supabase_functions \
      -N extensions -N pgbouncer -N pgsodium -N vault -N realtime \
      -N graphql_public -N _analytics \
      > "$OUTFILE"
    echo "INSERT-format backup saved to: $OUTFILE"
    ;;
  counts)
    echo "Table row counts:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -f scripts/backup-data.sql
    exit 0
    ;;
  *)
    echo "Usage: $0 [full|data|inserts|counts]"
    echo ""
    echo "  full    - Schema + data (default)"
    echo "  data    - Data only (COPY format, fast)"
    echo "  inserts - Data only (INSERT statements, portable)"
    echo "  counts  - Show row counts per table"
    exit 1
    ;;
esac

echo ""
echo "To restore: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < $OUTFILE"
