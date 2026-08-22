#!/bin/bash
# Daily database backup, run via cron. Keeps the last 14 days locally —
# protects against accidental deletion, bad migrations, or data
# corruption. This does NOT protect against losing the whole VPS itself
# (fire, disk failure, account issue) — for that, backups need to also
# leave this server, which is the natural next step once this is
# confirmed working.
set -e

cd "$(dirname "$0")"
BACKUP_DIR="$HOME/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="modotech_crm_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Read DB credentials straight from the same .env the app actually
# uses, so this can never silently drift out of sync with reality if
# the database name or user ever changes.
POSTGRES_DB=$(grep '^POSTGRES_DB=' backend/.env | cut -d= -f2)
POSTGRES_USER=$(grep '^POSTGRES_USER=' backend/.env | cut -d= -f2)

if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ]; then
    echo "$(date): ERROR - could not read POSTGRES_DB/POSTGRES_USER from backend/.env" >> "$BACKUP_DIR/backup.log"
    exit 1
fi

echo "==> Backing up database..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/$FILENAME"

# Sanity check: a real backup should never be near-empty. If pg_dump
# failed silently (wrong credentials, container not running, etc.),
# gzip would still "succeed" and produce a tiny, useless file — this
# catches that instead of quietly accumulating broken backups.
SIZE=$(stat -c%s "$BACKUP_DIR/$FILENAME" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 1000 ]; then
    echo "$(date): ERROR - backup file is suspiciously small ($SIZE bytes), likely failed" >> "$BACKUP_DIR/backup.log"
    rm -f "$BACKUP_DIR/$FILENAME"  # don't keep a broken backup around
    exit 1
fi

echo "$(date): OK - backed up to $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))" >> "$BACKUP_DIR/backup.log"
echo "==> Backup created: $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

echo "==> Removing backups older than 14 days..."
find "$BACKUP_DIR" -name "modotech_crm_*.sql.gz" -mtime +14 -delete

echo "==> Current backups on disk:"
ls -lh "$BACKUP_DIR"
