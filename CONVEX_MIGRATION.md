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
     logging, `orgCustomer`, `priceFor`, `distInv`, `geoFields`, `sumBy`.
   - `products.ts` — list / create / update / remove (OWNER-gated writes, ANY_ORG reads).
   - `customers.ts` — list / create / update / reminded / statement (agent-scoped like FastAPI).
   - `sales.ts` — list (ANY_ORG, agent-scoped) + create (AGENT): inventory check, price lists,
     discounts, stock movements, customer balance, invoice numbering — mirrors server.py exactly.
   - `collections.ts` — list + create (ANY_ORG): debt check, balance decrement, receipt numbering.
   - `stats.ts` — `overview` (ANY_ORG dashboard), `agents` (STAFF), `leaderboard` (STAFF, monthly).
   - `auth.ts` — `syncSession`: mirrors the already-authenticated FastAPI session (token+user+org)
     into Convex so the SAME bearer token authenticates Convex functions. Does not change auth.
   - `migrate.ts` — `importBatch` / `clearTable` / `countTable` (secret-guarded dev utilities).
   Verified via `npx convex run` with seeded data — numbers match FastAPI exactly:
   sale 5×10 paid 30 → total 50 / remaining 20; collection 10 → debt 10; overview sales_total 50,
   collections_total 10, gross_profit 20, stock_value 600; leaderboard rank 1; role gates reject
   (agent→403 on leaderboard, bad token→401). See `scripts/verify_convex.sh`.

3. **Migration script** — `scripts/migrate_mongo_to_convex.mjs` (+ `scripts/package.json`).
   Reads every Mongo collection and bulk-inserts into Convex via `migrate:importBatch`, then
   VERIFIES per-table record counts (Mongo vs Convex) and exits non-zero on mismatch.
   ✓ Run against the live Mongo in this environment: migrated the real data (2 users + the
   "Anmira" organization); all count checks passed.

   Run it:
   ```
   cd /app/scripts && npm install
   MONGO_URL="mongodb://localhost:27017" DB_NAME="test_database" \
   CONVEX_URL="https://fearless-ostrich-878.eu-west-1.convex.cloud" \
   CLEAR=1 node migrate_mongo_to_convex.mjs
   ```

4. **Frontend Convex hooks** — `frontend/src/convex.ts` (client), `ConvexProvider` in
   `app/_layout.tsx`, session token from `src/auth.tsx`. `app/convex-check.tsx` is now a LIVE
   Convex dashboard: it mirrors the current session (`auth.syncSession`), then renders
   `stats.overview` + `stats.leaderboard` + `products.list` via `useQuery` and writes via
   `useMutation` — reachable from Owner → الإدارة → ملف المؤسسة → "فحص Convex (تجريبي)".
   Verified in the web preview as the real Anmira owner: dashboard renders live and a product
   added from the UI appeared instantly.

## Deploying Convex changes
```
cd /app/frontend
CONVEX_DEPLOY_KEY='dev:fearless-ostrich-878|...' CONVEX_TMPDIR=/app/frontend/.convex-tmp \
  npx convex dev --once
```
(The deploy key is stored in `backend/.env` as `CONVEX_DEPLOY_KEY`; it is a secret — never bundle it
into the client. Only `EXPO_PUBLIC_CONVEX_URL` is safe for the app.)

## Remaining work for a FULL cutover (not yet done)
Porting the rest of the FastAPI endpoints to Convex functions, then switching the production
screens off FastAPI **all at once**:
- sales-returns, payment-vouchers, warehouse-returns, purchases, purchase-returns
- deliveries, distributor_inventory top-up, stock movements/requests
- GPS tracking + trails, routes + optimize
- employees/invitations, activation + trial, dev (licenses/orgs/plans/payment/upgrades)
- org profile/logo (note: logo upload needs object storage), customer-types/price-lists
- notifications, consent/legal, deletion requests, app-version/update gate
- stats: alerts / finance / full reports (overview + agents + leaderboard are done)
- offline queue/idempotency semantics (src/offline.ts / offlineActions.ts)

Already ported & live: products, customers, **sales, collections, stats.overview, stats.agents,
stats.leaderboard**, plus `auth.syncSession` so the real session authenticates Convex.

⚠️ Important: switching screens one-by-one breaks cross-feature flows (e.g. a product created in
Convex can't be delivered by the FastAPI delivery endpoint). A clean cutover must port all functions
first, then flip the whole frontend data layer together. Until then the app keeps running on
FastAPI + MongoDB (unchanged).
