# PetroCore Supply

A multi-tenant operations platform for petroleum procurement, sales, dispatch, haulage, delivery, and operational finance in Nigeria.

## Product and tenant naming

**PetroCore Supply** is the approved product and application name. **Deuces** is a tenant (customer/company account) operating within the platform; it is not the product name. The application must support multiple independent tenants, each with its own users, business records, configuration and access boundaries.

## Project status

**Multi-tenant operations app in active development.** Procurement, procurement costs, inventory and fulfilment, sales orders, fleet, dispatch, deliveries with evidence, reconciliation, transporter invoices, payments with operational profitability, and tenant access administration are implemented against a **non-production** Supabase project. The production database schema is not approved yet and no production database has been touched.

`main` is untouched; development happens on `chore/verification-and-ci-hardening` (PR #1, draft).

This repository is the application source for PetroCore Supply. It is a separate product from PetroCore Operations, with a planned future integration boundary. The initial architecture uses a modular monolith and PostgreSQL.

## Technology foundation

- Next.js (App Router), React and TypeScript
- Tailwind CSS and shadcn/ui-compatible component conventions
- Supabase PostgreSQL, Auth and Storage
- Server-side Next.js services and PostgreSQL transactions for authoritative business operations
- Progressive Web App foundation; IndexedDB/Dexie is reserved for offline queues and local drafts
- Vercel as the initial hosting target
- Vitest and Playwright for automated testing

## Getting started

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

If a dev page sticks on the loading skeleton or Turbopack reports that it is waiting for the filesystem to settle, run `npm run dev:clean`. It stops whatever is listening on port 3000, deletes `.next` and starts the dev server again.

The app can start without Supabase credentials. Supabase-backed features must not be enabled until environment variables and database migrations are configured.

## Demo data

Screenshots and manual review use a demo chain in the non-production project (`BAT-DEMO-1`, `TRIP-DEMO-1`, `SO-DEMO-1` and related master data). The operational rows built on top of it are versioned:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed/demo-tenant.sql          # idempotent, safe to re-run
psql "$SUPABASE_DB_URL" -f supabase/seed/demo-tenant-teardown.sql # removes only those rows
```

The seed covers one delivery with waybill evidence, a customer receipt and supplier payment, a transporter invoice with two charge lines, an inbound-haulage cost category with one batch component, and a demo purchase order (10,000 L at ₦900) linked to the storage batch so purchase cost and the landed-cost preview have a price. It does not create auth users or storage objects. Never run it against production.

## Quality checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript, no emit
npm test            # Vitest unit tests
npm run build       # Next.js production build
npm run test:e2e    # Playwright, chromium (installs the browser on first run)
npx playwright install chromium   # one-off browser install
npm run verify:live # browser checks against the configured project; needs a running dev server
                    # and DEV_TEST_USER_*, DEV_TEST_BETA_*, DEV_TEST_PENDING_* in .env.local
```

CI runs the same checks on pull requests to `main`.

## Repository structure

- `src/app` — routes and application shell
- `src/modules` — business modules, added incrementally
- `src/shared` — shared UI, auth, types and utilities
- `supabase/migrations` — version-controlled database migrations
- `supabase/seed` — demo data seed and teardown scripts for the non-production project
- `supabase/functions` — server-side edge functions where justified
- `supabase/tests` — database/security tests
- `docs` — product, database, ERD, architecture and business rules
- `tests` — application unit and end-to-end tests

## Non-negotiable engineering rules

1. Tenant isolation is enforced in the database with Row Level Security (RLS), not only in the UI.
2. Server/database transactions are authoritative for money, inventory, quantities, approvals and official status changes.
3. Offline actions remain pending until validated and accepted by the server. Offline mode must never silently post official financial or inventory transactions.
4. No production business tables are created until the approved Database Dictionary and ERD have been reconciled into migration-ready definitions.
5. Never commit secrets, service-role keys, customer data or production exports.
6. Preserve auditability; use reversals/corrections rather than silently rewriting posted financial history.
7. Do not invent unresolved business rules. Record them as explicit decisions.

See `docs/architecture/technical-foundation.md` before implementing modules.
