# PetroCore Supply — Technical Foundation

## Product identity and tenancy

- Product: PetroCore Supply.
- Tenant example: Deuces is one tenant/customer company using PetroCore Supply; it is not the product name.
- The platform is multi-tenant. Tenant-owned data, users, settings, permissions and operational records must remain isolated.
- Independence: a separate application from PetroCore Operations, with a planned future integration boundary.
- Data platform: shared PostgreSQL platform initially, with separate application schemas and clear ownership boundaries.
- Application style: modular monolith; avoid premature microservices.
- Web: Next.js App Router, React and TypeScript.
- UI: Tailwind CSS with shadcn/ui-compatible primitives and accessible interaction patterns.
- Backend: server-side Next.js APIs/services and PostgreSQL functions/transactions where appropriate.
- Data/auth/storage: Supabase PostgreSQL, Supabase Auth and Supabase Storage.
- Offline: PWA approach with IndexedDB/Dexie for local drafts and a durable sync queue.
- Hosting: Vercel initially.
- Source control: GitHub.
- Tests: Vitest for unit/integration tests and Playwright for end-to-end flows.

## Authority and integrity

The browser is not authoritative for money, stock, quantities, approvals or official status transitions. Validate inputs on the server and enforce critical invariants again in PostgreSQL. Use transactions, idempotency keys, immutable audit events and explicit reversals.

Offline work is provisional until server validation succeeds. A pending offline operation must not be presented as an officially posted financial or inventory transaction.

## Tenant security

Tenant isolation must be enforced through PostgreSQL RLS and trusted server-side identity resolution. Every tenant-owned table must have a deliberate tenant ownership strategy, appropriate indexes and cross-tenant access tests. Never rely on hiding records in the UI. The tenant context must come from authenticated, trusted membership—not an arbitrary tenant identifier supplied by the browser.

## Database implementation gate

Do not create production business tables until the complete Database Dictionary v1.2 and ERD v1.2 have been reconciled against the Business Rules & Financial Logic Specification and Technical Blueprint. Resolve table names, types, nullability, foreign keys, uniqueness, deletion policy, indexes, RLS policies, triggers and transaction boundaries before migration authorisation.

The initial scaffold intentionally contains no business schema or seed business data.

## User experience principles

- The product shell and navigation use the PetroCore Supply brand.
- Tenant-specific identity (for example, Deuces) may appear within the authenticated tenant workspace where appropriate; it must not replace the product identity.
- Design for fast, clear daily operations, not a generic admin template.
- Make the next action and current status obvious.
- Use plain language, consistent forms, validation and helpful empty states.
- Keep high-risk financial and inventory actions explicit and reviewable.
- Support responsive desktop and mobile layouts.
- Meet accessible keyboard, focus and contrast expectations.

## Suggested implementation sequence

1. Confirm local setup, environment handling, lint, typecheck, test and build.
2. Reconcile and approve the physical database schema and RLS model.
3. Implement authentication, tenant context, roles and location access.
4. Implement shared reference data and audit/idempotency foundations.
5. Implement customer orders and procurement workflows.
6. Implement batch traceability, inventory and direct fulfilment.
7. Implement dispatch, haulage, loading, delivery and reconciliation.
8. Implement operational finance, payment allocations and profitability.
9. Add offline queue/synchronisation, documents, reports and notifications.
10. Run acceptance, security, restore and operational-readiness tests.

Phase 3 general-ledger accounting remains outside the Phase 1 operational-finance implementation.
