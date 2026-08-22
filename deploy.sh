#!/bin/bash
# One command to apply an update on the production VPS. Deliberately
# always does a FULL rebuild + migrate + restart, even when a lighter
# restart might technically be enough — this whole project's build
# history has repeated one lesson more than any other: guessing wrong
# about "does this update need a rebuild" is what actually took the
# system down, not the rebuild itself being slow. A few extra minutes
# here is cheap; a live incident in front of real customers isn't.
#
# Also tags the currently-running image as a rollback point BEFORE
# rebuilding, and does a REAL end-to-end health check against the
# actual public HTTPS URL — not just Django's internal system check,
# which is too shallow to catch real issues (a proxy misconfiguration
# and a missing security header setting both slipped past that kind of
# check during this project's own first deployment).
set -e  # stop immediately on any error, don't limp forward on a half-applied update

cd "$(dirname "$0")"
SITE_URL="https://crm.modotech.co.ke"

echo "==> Checking docker-compose.yml exists here..."
if [ ! -f docker-compose.yml ]; then
    echo "ERROR: run this from the project root (where docker-compose.yml lives)."
    exit 1
fi

echo "==> Tagging current images as rollback point (modotech-crm-*:previous)..."
for svc in backend celery_worker celery_beat frontend; do
    if docker image inspect "modotech-crm-$svc:latest" >/dev/null 2>&1; then
        docker tag "modotech-crm-$svc:latest" "modotech-crm-$svc:previous"
    fi
done

echo "==> Building fresh images (backend, celery_worker, celery_beat, frontend)..."
docker compose build --no-cache backend celery_worker celery_beat frontend

echo "==> Starting/replacing containers..."
docker compose up -d

echo "==> Waiting for backend to become healthy (internal check)..."
for i in $(seq 1 30); do
    if docker compose exec -T backend python manage.py check >/dev/null 2>&1; then
        echo "    backend is responding internally."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: backend did not become healthy within 30 seconds. Check: docker compose logs backend --tail=50"
        echo "==> Rolling back to previous images..."
        for svc in backend celery_worker celery_beat frontend; do
            docker image inspect "modotech-crm-$svc:previous" >/dev/null 2>&1 && docker tag "modotech-crm-$svc:previous" "modotech-crm-$svc:latest"
        done
        docker compose up -d
        exit 1
    fi
    sleep 1
done

echo "==> Verifying the REAL public site actually responds (not just an internal check)..."
sleep 3  # give nginx a moment after container restart
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" || echo "000")
if [ "$HTTP_STATUS" != "200" ]; then
    echo "WARNING: $SITE_URL returned $HTTP_STATUS, not 200."
    echo "The backend passed its internal check but the real site isn't responding correctly —"
    echo "this exact gap is what caused real problems during initial deployment. Investigate before"
    echo "considering this deploy successful. Rollback images are tagged ':previous' if needed:"
    echo "  docker tag modotech-crm-backend:previous modotech-crm-backend:latest && docker compose up -d"
else
    echo "    $SITE_URL responded 200 OK — real, end-to-end confirmation, not just an internal check."
fi

echo "==> Current container status:"
docker compose ps

echo
echo "==> Deploy finished. Migrations applied automatically during backend startup (see docker-entrypoint.sh)."
echo "==> If anything looks wrong: docker compose logs backend --tail=80"
