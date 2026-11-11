# Deuces Supply, Haulage & Delivery Management System

A multi-tenant operations platform for petroleum procurement, sales, dispatch, haulage, delivery, and operational finance in Nigeria.

## Project status

**Foundation scaffold — no operational modules or production database schema have been implemented yet.**

This repository is the application source for Deuces Supply. It is independent of PetroCore Operations, with a planned future integration boundary. The initial architecture uses a modular monolith and PostgreSQL.

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

The app can start without Supabase credentials. Supabase-backed features must not be enabled until environment variables and database migrations are configured.

## Repository structure

- `src/app` — routes and application shell
- `src/modules` — business modules, added incrementally
- `src/shared` — shared UI, auth, types and utilities
- `supabase/migrations` — version-controlled database migrations
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
