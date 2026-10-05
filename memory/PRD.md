# Smart System (النظام الذكي) — Mobile (Expo) PRD

## Original problem
"clone this mobile app https://github.com/abufuadeid419-glitch/Last-App-code.git"
Restore an existing Emergent-built app exactly as-is into this workspace and get it running.

User choices (this session):
- Restore exactly as-is first, then iterate on request.
- Developer (super-admin) Google email: abufuadeid419@gmail.com (set in backend DEVELOPER_EMAILS).
- Skip Emergent managed storage for now (no EMERGENT_LLM_KEY → logo upload disabled by design).
- Start with an empty database (no demo/seed data).

## What this app is
Arabic RTL sales & distribution ERP. Roles: DEVELOPER, OWNER, ACCOUNTANT, FIELD_AGENT (distributor).
Auth: Emergent Google sign-in (bearer session_token in db.user_sessions). Activation by license
code (LIC-), employee code (EMP-), or a 14-day self-service trial.

## Architecture
- Backend: /app/backend/server.py — FastAPI + Motor (MongoDB). All routes under /api. Role deps:
  OWNER / STAFF / AGENT / ANY_ORG / DEV. Startup creates indexes + runs a weekly debt-digest loop.
- Frontend: Expo Router. Root gate in app/_layout.tsx routes to login / activate / blocked / dev /
  owner / acct / agent areas. Role tab groups via src/RoleTabs.tsx (NativeTabs on iOS 26+, JS Tabs
  elsewhere). UI kit src/ui.tsx. Cairo font, moss-green theme, forced RTL.
- Env: backend/.env (MONGO_URL, DB_NAME, DEVELOPER_EMAILS). frontend/.env (EXPO_PUBLIC_BACKEND_URL +
  protected packager vars — left untouched). INTEGRATION_PROXY_URL injected by supervisor.

## Clone / restore done (2026-06)
- Copied full repo into /app (preserved protected .env, .git, .emergent); yarn install + venv already
  had required backend packages (emergentintegrations/litellm are unused by this app and skipped).
- Set DEVELOPER_EMAILS=abufuadeid419@gmail.com.
- Verified backend serves (GET /api/ → "Smart System API") and Expo bundles (1519 modules); Arabic
  login screen renders on web preview.
- Ran shipped pytest suite serially: 198 passed. Testing agent independently re-verified: 198 passed,
  role gating + core flows OK (report /app/test_reports/iteration_8.json). No code changes needed.
- Wiped DB to empty per user choice. First Google sign-in with the developer email bootstraps DEVELOPER.

## Feature set (inherited, all implemented in source)
- Developer: stats, create/delete licenses, manage orgs (extend/suspend/reactivate), plans, payment
  settings, upgrade approvals, app-version/update gate, monitoring.
- Owner: KPIs (sales/profit/stock value/debts), low-stock alerts, agent performance + leaderboard,
  products CRUD, purchases (stock in), deliveries to distributors, employees (invite by code),
  org profile/logo, GPS agent tracking + maps, route planner, customer price lists, reports.
- Distributor (field agent): own inventory, new sale (cash/credit, discounts), collections, sales
  returns, warehouse returns, payment vouchers, customers CRUD (own), today's route, offline-first
  sync (queue + dedupe), PDF/80mm Bluetooth receipts, WhatsApp debt reminders.
- Accountant: overview, invoices/collections/returns, debts with collect, customer statements.
- Blocked screen for suspended/expired orgs; terms/privacy consent gate; legal screens.

## Known constraints
- Login is Emergent Google OAuth — deep frontend flows cannot be automated; validated via backend
  suite + seeded tokens (see /app/memory/test_credentials.md) and login-screen render check.
- Logo upload needs EMERGENT_LLM_KEY (storage) — intentionally disabled this session.
- Bluetooth thermal printing & background GPS require a native build (not Expo Go / web preview).
- Maps render on native devices; web preview shows list fallbacks.

## Backlog / next (P1/P2)
- P1: enable Emergent storage (add EMERGENT_LLM_KEY) to turn on org logo on invoices.
- P1: seed a demo org + sample data on request for quick exploration.
- P2: push notifications (Emergent managed) — needs user's google-services.json + a native build.
