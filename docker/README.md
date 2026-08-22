Dockerfiles live next to the code they build (`backend/Dockerfile`,
`frontend/Dockerfile`) so each stays in sync with its own dependency
files. This folder is reserved for shared build scripts or Compose
profile overlays as the project grows (e.g. `docker/docker-compose.prod.yml`
for a hardened production overlay, `docker/backup.sh` for scheduled
Postgres backups) — nothing needed here yet in Phase 1.
