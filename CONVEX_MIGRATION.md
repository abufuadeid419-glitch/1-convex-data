# MongoDB → Convex migration (Smart System)

Self-managed external Convex deployment: `fearless-ostrich-878`
(`EXPO_PUBLIC_CONVEX_URL=https://fearless-ostrich-878.eu-west-1.convex.cloud`).

The existing Expo + **FastAPI + MongoDB** stack is UNCHANGED and remains the running,
Emergent-deployable backend. Convex has been set up alongside it and proven end-to-end.

## What is in place (done & verified)

1. **Schema** — `frontend/convex/schema.ts` translates all 29 Mongo collections into Convex
   tables with indexes. Original string ids (`org_id`, `user_id`, `customer_id`, `product_id`, …)
   are kept as indexed fields so relationships survive the migration unchanged.
   `schemaValidation: false` lets the bulk import tolerate field drift.
   → Deployed: all 29 tables + indexes created on the Convex deployment.

2. **CRUD functions** — `frontend/convex/`
   - `lib.ts` — shared helpers: bearer-token auth (`getUser`/`require`, same roles as FastAPI:
     OWNER / STAFF / AGENT / ANY_ORG / DEV), counters (`nextNo`), stock-movement + price-history
     logging, id/time helpers, result cleaning.
   - `products.ts` — list / create / update / remove (OWNER-gated writes, ANY_ORG reads),
     with stock-movement + price-history logging, mirroring server.py.
   - `customers.ts` — list / create / update / reminded / statement (agent-scoped like FastAPI).
   - `migrate.ts` — `importBatch` / `clearTable` (secret-guarded dev utilities for the script).
   Verified via `npx convex run`: auth works, role gates reject correctly (agent→403, bad token→401),
   CRUD round-trips.

3. **Migration script** — `scripts/migrate_mongo_to_convex.mjs` (+ `scripts/package.json`).
   Reads every Mongo collection and bulk-inserts into Convex via `migrate:importBatch`
   (drops Mongo `_id`, coerces values to JSON). Verified: moved seeded users/sessions/org
   from Mongo into Convex.

   Run it:
   ```
   cd /app/scripts && npm install
   MONGO_URL="mongodb://localhost:27017" DB_NAME="test_database" \
   CONVEX_URL="https://fearless-ostrich-878.eu-west-1.convex.cloud" \
   CLEAR=1 node migrate_mongo_to_convex.mjs
   ```

4. **Frontend Convex hooks** — `frontend/src/convex.ts` (client), `ConvexProvider` added in
   `app/_layout.tsx`, session token exposed from `src/auth.tsx` (`useAuth().token`).
   `app/convex-check.tsx` is a live screen using `useQuery(api.products.list)` /
   `useMutation(api.products.create/remove)` — reachable from Owner → الإدارة → ملف المؤسسة →
   "فحص Convex (تجريبي)". Verified in the web preview: reads are live/reactive and writes appear
   instantly.

## Deploying Convex changes
```
cd /app/frontend
CONVEX_DEPLOY_KEY='dev:fearless-ostrich-878|...' CONVEX_TMPDIR=/app/frontend/.convex-tmp \
  npx convex dev --once
```
(The deploy key is stored in `backend/.env` as `CONVEX_DEPLOY_KEY`; it is a secret — never bundle it
into the client. Only `EXPO_PUBLIC_CONVEX_URL` is safe for the app.)

## Remaining work for a FULL cutover (not yet done)
Porting the rest of the ~60 FastAPI endpoints to Convex functions, then switching the production
screens off FastAPI **all at once**:
- sales, collections, sales-returns, payment-vouchers, warehouse-returns
- deliveries, distributor_inventory, purchases, purchase-returns, stock movements/requests
- stats (overview / agents / leaderboard / reports), GPS tracking + trails
- employees/invitations, activation + trial, dev (licenses/orgs/plans/payment/upgrades)
- org profile/logo (note: logo upload needs object storage), customer-types/price-lists
- routes + optimize, notifications, consent/legal, deletion requests, app-version/update gate
- offline queue/idempotency semantics (src/offline.ts / offlineActions.ts)

⚠️ Important: switching screens one-by-one breaks cross-feature flows (e.g. a product created in
Convex can't be delivered by the FastAPI delivery endpoint). A clean cutover must port all functions
first, then flip the whole frontend data layer together. Until then the app keeps running on
FastAPI + MongoDB (unchanged).
