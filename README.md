# Modotech CRM

Multi-agent WhatsApp CRM and customer support platform for Modotech
Softwares / Modotech Fiber. One WhatsApp Business number, many agents,
no physical phone required — see the architecture notes below.

## Stack

- **Backend:** Django 6 + Django REST Framework, Django Channels (WebSockets),
  Celery + Redis (background jobs, WhatsApp webhook processing), PostgreSQL
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **WhatsApp:** Meta WhatsApp Cloud API (official Business Platform — no
  browser automation)
- **Infra:** Docker Compose, Nginx (edge reverse proxy)

## Project layout

```
modotech-crm/
├── backend/            Django project (config/) + apps/ (accounts, customers,
│                        conversations, whatsapp, reports, automation, integrations)
├── frontend/            React + TS + Tailwind SPA
├── nginx/                Edge reverse proxy config (routes /api, /ws, /admin -> backend)
├── docker-compose.yml    Production-shaped service definitions
├── docker-compose.override.yml   Local dev overrides (live reload, exposed ports)
└── docker/                Reserved for shared scripts / compose overlays
```

## Quick start (Docker)

```bash
cp backend/.env.example backend/.env      # fill in a real DJANGO_SECRET_KEY etc.
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Frontend (dev): http://localhost:5173
- Backend API (dev, direct): http://localhost:8000/api/
- Everything through the edge proxy (prod-shaped): http://localhost/
  (run `docker compose --profile with-nginx up --build` to include nginx locally)

The backend entrypoint runs migrations and `collectstatic` automatically
on container start. Create your first admin user with:

```bash
docker compose exec backend python manage.py createsuperuser
```

## Quick start (without Docker)

**Backend**

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DB/Redis creds for your machine
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Redis and PostgreSQL must be running locally (or point `.env` at remote
instances). Celery worker, run in a second terminal:

```bash
celery -A config worker --loglevel=info
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/ws` to `http://localhost:8000` in dev (see
`vite.config.ts`), so no CORS setup is needed locally.

## WhatsApp Cloud API setup

1. Create a Meta Developer account and a Business App. When creating it,
   choose the **"Business messaging" → "Set up WhatsApp"** use case if
   offered — it's the most direct path and auto-provisions a free test
   number. (Meta's app-creation wizard changes periodically; if you don't
   see that option, "Other" → "Business" app type also works.)
2. Under WhatsApp > API Setup ("Step 1: Try it out"), note your **Phone
   Number ID** and generate a temporary access token. The **Phone Number
   ID is a numeric ID** (e.g. `1261989706997192`) — it is *not* the phone
   number itself (e.g. `+15556638730`). This is an easy mix-up with a
   confusing downstream error ("Object with ID '+1555...' does not
   exist"); if you hit that, this is why. The correct ID is also visible
   in any inbound webhook payload under `value.metadata.phone_number_id`.
3. Get your **WhatsApp Business Account ID (WABA ID)** — a *third*,
   separate ID from the two above. If it's not obvious in the UI, query
   it directly: `GET {PHONE_NUMBER_ID}?fields=whatsapp_business_account`
   in [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
4. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID` in `backend/.env`.
5. Set `WHATSAPP_APP_SECRET` (App Dashboard > Settings > Basic) — used
   to verify inbound webhook signatures.
6. Choose a `WHATSAPP_VERIFY_TOKEN` (any string you pick) and set it in
   `.env`; use the same value when configuring the webhook in Meta's
   dashboard.
7. Point the webhook URL at `https://<your-domain>/api/whatsapp/webhook/`
   and subscribe to the `messages` field. **Important:** as of late 2025,
   Meta's dashboard doesn't always auto-link a newly created app to its
   WABA even after the webhook shows "verified" and the field shows
   "subscribed" — inbound messages will silently never arrive. Confirm
   the link explicitly with a `POST {WABA_ID}/subscribed_apps` call in
   Graph API Explorer; it should return `{"success": true}`.
8. For local testing before you have a real server, tunnel your backend
   with `ngrok http 8000` and use the resulting HTTPS URL as the webhook
   callback. Free ngrok URLs change on every restart, so you'll need to
   re-verify the webhook in Meta's dashboard each time you restart the tunnel.
9. In Meta's test mode, the **recipient number you add for testing must
   be your own personal phone** — not the Meta-issued test number itself
   (that's the sender, "From"). It also needs to be verified with the
   code Meta texts you, not just entered.
10. **Access tokens from "Try it out" are temporary (24h).** Generating a
    separate token in Graph API Explorer for other tasks (like the
    `subscribed_apps` call above) does not replace it — make sure
    `WHATSAPP_ACCESS_TOKEN` in `.env` holds a *fresh* token from the
    actual API Setup page, not a differently-scoped Explorer token, or
    sends will fail with a 403 `Access denied` / `OAuthException`. Set up
    a permanent System User token once you're past initial testing.
11. **Migrating an existing, actively-used WhatsApp number** — there are
    two real paths, and they have very different consequences:
    - **Direct migration** (delete the WhatsApp Business App account,
      register the number with Cloud API): per Meta's own documentation,
      this **permanently loses existing chat history**, and the number
      can no longer be used in the WhatsApp/WhatsApp Business consumer
      app afterward (unless later deregistered from Cloud API). Since
      group messaging only works through the consumer app — the Cloud
      API doesn't support it — this also means losing practical access
      to any groups on that number. Fine for a number set up exclusively
      for the business with no personal use or groups to preserve; not
      fine otherwise.
    - **Coexistence** (Meta's official, newer alternative): connects the
      same number to *both* the WhatsApp Business App and the Cloud API
      simultaneously — no account deletion, no forced choice. You keep
      using the consumer app normally (groups, channels, status updates,
      calls all keep working there), recent history (roughly the last 6
      months) is preserved rather than wiped, and messages sync between
      the app and the API in real time. This is the right choice if the
      number is genuinely in active personal/group use and you want to
      keep it that way while adding the CRM on top. Available through
      Meta's approved onboarding partners/flows rather than being a
      Cloud API setting you toggle directly — check current options at
      [developers.facebook.com](https://developers.facebook.com) or with
      your onboarding partner, since exact availability has been rolling
      out over 2025–2026.

    Either way, back up the number's chat history before starting, and
    do this during a maintenance window — some downtime during the
    switch is normal regardless of which path you pick.
12. **Whenever you change `.env`**, use `docker compose up -d --force-recreate
    <service>` — not `docker compose restart`, which reuses the
    container's already-baked-in environment and will silently keep
    using the old values.
13. **Whenever you add a new backend Python dependency** (a new line in
    `requirements.txt`), a plain restart or even `docker compose up -d`
    is not enough — the package genuinely isn't installed in the running
    container until you rebuild: `docker compose build --no-cache backend
    celery_worker`, then `docker compose up -d`. Skipping this crashes
    the backend on startup (Django imports every view module — including
    the new one needing the new package — while loading URL routes), and
    since that happens before any request-handling code runs, it takes
    down every endpoint at once, not just the new feature — including
    login, which can look like a credentials problem when it's actually
    a missing dependency. Check `docker compose ps`: if backend shows
    "Restarting" instead of "Up", this is almost always why.

Message templates must be created and approved in Meta Business Manager
before they can be sent; approval can take from minutes to a couple of
days. Outside the 24-hour customer service window (tracked per
conversation as `service_window_expires_at`), only approved templates
can be sent — the inbox composer enforces this automatically.

## Current status

**Verified working against a real WhatsApp number** — a live end-to-end
test confirmed both directions: an inbound message from a real phone
travels through Meta → webhook → Celery → database → CRM inbox (via
WebSocket) and shows up correctly, and a reply typed in the CRM reaches
Meta and is delivered to a real phone.

- ✅ Project scaffolding, Docker Compose, Django/React wiring
- ✅ Data model for all core entities (User, Customer, Conversation,
  Message, ConversationAssignment, InternalNote, Tag, MessageTemplate,
  RoutingRule, AuditLog, Broadcast, Department)
- ✅ JWT auth, role-based permissions, custom User model with roles
- ✅ Customer CRUD + search, ISP service abstraction (mock impl)
- ✅ Conversation inbox: assignment, status, internal notes, messaging,
  keyword-based routing, least-loaded auto-assignment
- ✅ WhatsApp Cloud API client, webhook receiver (signature-verified,
  idempotent, Celery-backed), inbound media download, template model
- ✅ Real-time updates via Django Channels / WebSockets
- ✅ Audit logging (explicit + middleware safety net) — now also
  surfaced in the UI as a live Recent Activity feed on the Dashboard
- ✅ Reports, Settings (routing rules), Agents, Departments, Templates,
  Broadcasts, Leads — every sidebar item is a real, working screen
- ✅ ISP account panel — the inbox's customer profile shows live ISP
  account data pulled through the ISPService abstraction
- ✅ Broadcasts — bulk template sends to a filtered customer segment,
  per-recipient tracking, logged into conversation history
- ✅ **Frontend visual pass**: icons throughout (lucide-react), a proper
  Manrope/Inter type pairing, deterministic-color avatars for every
  person, toast notifications on actions, skeleton loading states, and
  purposeful empty states in place of bare "Loading…" text. Also fixed
  a real accessibility gap — keyboard focus states only changed border
  color before and weren't actually visible.
- ✅ **Login page**: real Modotech logo, an ambient animated circuit
  background (traveling signal pulses along traces, echoing the logo's
  own circuit-node motif) that stays behind a fully solid, readable
  login card — the animation never competes with legibility. Favicon
  also now uses a cropped icon mark from the real logo.
- ✅ **Session timeout**: 15 minutes of inactivity signs the user out
  automatically, with a warning dialog and live countdown in the last
  60 seconds ("Stay signed in" / "Sign out"). This matches PCI DSS
  Requirement 8.2.8 — the standard financial-industry benchmark
  (mandatory as of PCI DSS v4.0) for systems handling sensitive account
  data: no more than 15 minutes idle before re-authentication is
  required. Applies app-wide once logged in; the public login page
  itself is unaffected.
- ✅ **Add contact + start conversation**: agents can now create a new
  customer record and open a conversation with them directly, by
  sending an approved template (the only way to reach someone who
  hasn't messaged in first, per WhatsApp's own rules). Includes a live
  phone-number format check as you type — see the honesty note below on
  what this can and can't actually confirm.
- ✅ **Role-based access control, enforced server-side and tested live**:
  creating agents, adding/editing departments, and assigning roles are
  now Super Admin only — verified with a real non-super Admin account
  getting a genuine 403 on both. Regular Admins keep templates,
  broadcasts, routing rules, and audit logs. The sidebar now shows only
  what a role can actually use — no more dead-end menu items.
- ✅ Failed WhatsApp sends (wrong number, expired token, etc.) now
  return a clean, readable error instead of crashing with a raw 500 —
  fixed in both the existing message composer and the new
  start-conversation flow.

**Honesty note on the phone-number check**: Meta's official WhatsApp
Cloud API does not provide a way to check whether an arbitrary number is
actually registered on WhatsApp — that lookup was removed from the
official API to prevent number-harvesting abuse. Third-party services
that still offer it do so via unofficial, reverse-engineered WhatsApp
access, which this project deliberately avoids (per the original spec's
"no unofficial WhatsApp APIs" requirement). What the popup actually
confirms is phone-number *format* validity (catches typos, wrong
country codes, missing digits) — real and useful, just not the same
claim. The authoritative "can this number actually receive WhatsApp
messages" signal comes from Meta itself, in real time, the moment a
message is actually sent — which is exactly when the new
start-conversation flow surfaces it, clearly, if delivery fails.

### Bugs found and fixed this build (worth knowing before you deploy)

| Bug | Cause | Fix |
|---|---|---|
| Postgres/backend password mismatch | Different `.env` defaults | Postgres now reads the same `.env` as the backend |
| Frontend 502 in Docker | Vite proxy hit `localhost` inside its own container instead of the backend container | Proxy target is now an env var, set to `backend` in Docker |
| Superuser locked out of admin endpoints | `is_superuser` and the CRM's own `role` field could disagree | Superusers now sync to `role=SUPER_ADMIN` automatically |
| Postgres healthcheck always failing | `pg_isready` without `-d` checks a database named after the *user*, not the real one | Healthcheck now explicitly checks `modotech_crm` |
| Broadcast status randomly reverting | View wrote `status=SENDING` *after* enqueuing the task, racing the task's own final write | Task now owns every status transition end-to-end |
| **Celery worker crash-looping** | Startup script ran `collectstatic` for *every* container, including the worker, which lacks permission to write in a bind-mounted dev volume | Skipped for the `celery` command — this had silently broken **all background processing** until fixed |
| Send button appeared to do nothing on failure | Frontend didn't catch/display send errors | Now shows the actual error inline |
| WhatsApp send 400 error | `.env` had the phone number instead of the numeric Phone Number ID | See WhatsApp setup step 2 above |
| Inbound messages never arriving despite a verified webhook | Meta's dashboard doesn't always auto-link the app to the WABA | Manual `POST /subscribed_apps` — see step 7 above |
| WhatsApp send 403 Access denied | Stale/wrong-scoped access token | Fresh token from the API Setup page — see step 10 above |
| **Entire backend down, "wrong password" on every login** | A new Python dependency (`phonenumbers`) was added to `requirements.txt`, but the container was only restarted, not rebuilt — the package was never actually installed, so Django crashed on startup trying to import it. Since URL routing imports every view module up front, this took down *all* endpoints at once, not just the new one — login included, which looked exactly like a credentials problem | Rebuild (not restart) whenever a Python dependency changes — see step 13 above. `docker compose ps` showing "Restarting" instead of "Up" is the tell |
| Form validation errors showed in the wrong place | A generic error-flattening pattern dumped every field's error into one blob near the submit button instead of under the specific field | Errors now map to their actual field across every form with server-side validation (Agents, Templates, Departments, Routing Rules, Broadcasts, New Contact) |
| Agent/Department creation not restricted enough | `IsAdminOrAbove` allowed regular Admins to create agents and departments | New `IsSuperAdminOnly` tier — verified live with a real non-super Admin account getting a genuine 403 on both |
| **Backend crash-loop on `apps/conversations/routing.py` — happened twice** | Windows zip extraction (on at least one machine) intermittently collapsed this file's line breaks into spaces, corrupting it into a single malformed line and crashing the ASGI app on import. This looked identical both times: `ImportError: cannot import name 'websocket_urlpatterns'`. Likely a Docker Desktop/WSL2 file-sharing reliability issue or antivirus interference during the file write, not a problem with the zip contents themselves — `docker compose logs backend` also showed an unrelated `OSError: Input/output error` on `/app/locale` around the same time, consistent with a filesystem-layer issue rather than a code bug | Rewrote the file as a single physical line with no comments — nothing for that specific corruption pattern to collapse, so it can't happen to this file again. If you see `docker compose ps` show "Restarting" after an update, check `docker compose logs backend --tail=80` for an `ImportError` pointing at a specific file — if you find one, that file can likely be rewritten the same way. Also worth doing once, if this keeps happening on other files too: `wsl --shutdown` then restart Docker Desktop, and exclude your project folder from real-time antivirus scanning |
| Inbound attachments (documents/images/etc. sent BY customers) never appeared in the CRM, even though outbound sends worked fine | `download_media()`'s second step tried to fetch the actual file bytes straight from the Facebook CDN URL (`lookaside.fbsbx.com`) that the first step returns, using the 360dialog API key — but that CDN is Facebook's own infrastructure and doesn't accept a `D360-API-KEY`, only Meta's own auth. The download silently failed and got swallowed by the task's own error handling, leaving the Message row with no attached file | For 360dialog specifically, the mid/ext/hash parameters are now extracted from that returned URL and re-requested against 360dialog's own proxied endpoint (`waba-v2.360dialog.io/whatsapp_business/attachments/`), which *does* accept the D360 key — confirmed against 360dialog's own docs and verified with a mocked two-step request showing the correct URL is hit. Direct Meta integrations are unaffected — verified separately that they still use the original lookaside URL unchanged |

**Still not built**: template approval *sync* with Meta (a template's
status is set manually for now, not pulled from the Graph API), AI
assistant wiring, an automated test suite, production hardening
(rate-limit tuning, structured logging/monitoring, backups), and a
permanent (non-24h) access token setup. Say the word on any of these
and we'll build it next.
