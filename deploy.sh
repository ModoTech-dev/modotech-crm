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

echo "==> Restarting nginx too, even though its image didn't change — backend just got a new"
echo "    internal address, and nginx won't notice that on its own until its DNS cache expires."
echo "    This is exactly the gap that's caused login failures right after past deploys."
docker compose restart nginx

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
    exit 1
fi
echo "    $SITE_URL responded 200 OK."

echo "==> Verifying the API path specifically - the homepage check above is served by the"
echo "    frontend and wouldn't catch a stale nginx->backend connection, which is exactly what"
echo "    caused login failures right after past deploys. This tests the actual backend path."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SITE_URL/api/auth/login/" -H "Content-Type: application/json" -d '{}' || echo "000")
if [ "$API_STATUS" != "400" ]; then
    # 400 (bad request - empty credentials) is the CORRECT response here,
    # confirming the request actually reached Django. Anything else
    # (502, 000, 500) means the backend path itself is still broken.
    echo "WARNING: $SITE_URL/api/auth/login/ returned $API_STATUS, expected 400 (empty credentials"
    echo "correctly rejected). This means requests aren't reaching the backend correctly, even"
    echo "though the homepage loaded fine. Try: docker compose restart nginx"
    exit 1
fi
echo "    API path responded correctly - confirmed reaching the real backend, not stale/cached."

echo "==> Current container status:"
docker compose ps

echo
echo "==> Deploy finished. Migrations applied automatically during backend startup (see docker-entrypoint.sh)."
echo "==> If anything looks wrong: docker compose logs backend --tail=80"
