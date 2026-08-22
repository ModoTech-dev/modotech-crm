#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PYEOF'
import os, time, sys
import psycopg2

for _ in range(30):
    try:
        psycopg2.connect(
            dbname=os.environ.get("POSTGRES_DB", "modotech_crm"),
            user=os.environ.get("POSTGRES_USER", "modotech"),
            password=os.environ.get("POSTGRES_PASSWORD", ""),
            host=os.environ.get("POSTGRES_HOST", "postgres"),
            port=os.environ.get("POSTGRES_PORT", "5432"),
        ).close()
        sys.exit(0)
    except psycopg2.OperationalError:
        time.sleep(1)
sys.exit("Database never became available")
PYEOF

python manage.py migrate --noinput

# Only the actual web server needs static files prepared. Running this
# for the Celery worker/beat containers too was not just wasteful — in
# local dev, where ./backend is bind-mounted over /app, it can fail with
# a permission error (the non-root appuser can't always write into a
# bind-mounted directory) and crash-loop a container that never even
# serves static files in the first place.
case "$1" in
  celery)
    ;;
  *)
    python manage.py collectstatic --noinput
    ;;
esac

exec "$@"
