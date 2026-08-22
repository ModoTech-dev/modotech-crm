#!/bin/bash
# One command to apply an update on the production VPS. Deliberately
# always does a FULL rebuild + migrate + restart, even when a lighter
# restart might technically be enough — this whole project's build
# history has repeated one lesson more than any other: guessing wrong
# about "does this update need a rebuild" is what actually took the
# system down, not the rebuild itself being slow. A few extra minutes
# here is cheap; a live incident in front of real customers isn't.
set -e  # stop immediately on any error, don't limp forward on a half-applied update

cd "$(dirname "$0")"

echo "==> Checking docker-compose.yml exists here..."
if [ ! -f docker-compose.yml ]; then
    echo "ERROR: run this from the project root (where docker-compose.yml lives)."
    exit 1
fi

echo "==> Building fresh images (backend, celery_worker, celery_beat, frontend)..."
docker compose build --no-cache backend celery_worker celery_beat frontend

echo "==> Starting/replacing containers..."
docker compose up -d

echo "==> Waiting for backend to become healthy..."
for i in $(seq 1 30); do
    if docker compose exec -T backend python manage.py check >/dev/null 2>&1; then
        echo "    backend is responding."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: backend did not become healthy within 30 seconds. Check: docker compose logs backend --tail=50"
        exit 1
    fi
    sleep 1
done

echo "==> Current container status:"
docker compose ps

echo
echo "==> Deploy finished. Migrations applied automatically during backend startup (see docker-entrypoint.sh)."
echo "==> If anything looks wrong: docker compose logs backend --tail=80"
