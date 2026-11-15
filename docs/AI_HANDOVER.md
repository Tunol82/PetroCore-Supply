# PetroCore Supply — AI Agent Handover

**Last updated:** 2026-11-15  
**Repository:** https://github.com/Tunol82/PetroCore-Supply  
**Current working branch:** `chore/initial-project-scaffold`  
**Pull request:** https://github.com/Tunol82/PetroCore-Supply/pull/1  
**Product owner:** Tunde Oladeji

> Start here when continuing work with OpenCode or another coding agent. Read this file, then read the linked source documents before changing code or database design. Treat this as a project handover and execution brief, not permission to bypass the documented approval gates.

## 1. Product identity and boundary

- The product/application is **PetroCore Supply**.
- **Deuces is a tenant/customer company**, not the product name.
- PetroCore Supply is a separate application from **PetroCore Operations**. Do not merge their codebases, schemas, authentication assumptions or business records.
- Future integration between the two applications is planned, but no cross-application foreign keys or direct coupling should be introduced now.
- Initial deployment may use a shared PostgreSQL platform, but each application must own a separate database schema and clear ownership boundary.
- Build as a modular monolith. Do not introduce microservices without an explicit architectural decision.
- The platform is multi-tenant from day one. Tenant isolation must be enforced at the database boundary (PostgreSQL RLS and constraints), not merely by filtering UI results.

## 2. Approved technology direction

- Next.js App Router, React and TypeScript.
- Tailwind CSS and accessible shadcn/ui-compatible conventions.
- Supabase PostgreSQL, Auth and Storage.
- Server-side Next.js services/actions; PostgreSQL transactions and constraints are authoritative for critical business operations.
- PWA direction with IndexedDB/Dexie for local drafts and a durable offline sync queue.
- Vercel is the initial hosting target.
- Vitest for unit/integration tests and Playwright for end-to-end tests.
- Use decimal-safe arithmetic for authoritative money and quantity calculations. Never use JavaScript floating-point arithmetic as the source of truth for financial or stock postings.

## 3. Security and integrity rules — non-negotiable

1. Resolve tenant context from authenticated identity and trusted server-side membership, never from an arbitrary browser-supplied tenant ID.
2. Every tenant-owned record must resolve to exactly one organisation, directly or through a rigorously enforced parent relationship.
3. Enable and test RLS on every tenant-owned table. Deny by default.
4. Enforce location access separately from tenant membership. Ordinary users may have explicit grants to multiple locations in their own tenant; tenant-wide visibility is a separate explicit permission.
5. Platform Super Admin is a platform-level identity, not a normal member of every tenant. Tenant entry requires a privileged, server-validated, audited tenant-switch process.
6. Server/database transactions are authoritative for money, inventory, quantities, approvals and official status changes.
7. Use idempotency, immutable audit events, explicit reversals/corrections and concurrency-safe document numbering.
8. Offline actions remain provisional until validated and accepted by the server. Never present a pending offline action as an officially posted transaction.
9. Never commit credentials, service-role keys, customer data or production exports.
10. Do not silently invent unresolved business rules or delete/rename existing business tables as an early migration step.

## 4. Approved logical data-governance decisions

The reconciliation report records these decisions as approved by the product owner:

- **Tenant root:** `organisations` is the single authoritative tenant identity/master.
- **Tenant settings:** retain `business_settings` for settings belonging to an organisation; it must not become a competing tenant master. Intended one-to-one relationship requires exact key/constraint confirmation against the full dictionary.
- **Platform Super Admin:** separate platform-level identity; no default tenant membership. Tenant switching is privileged, server-validated and audited.
- **Location access:** ordinary users can receive explicit access to multiple locations within their own tenant. Access is not automatic from tenant membership or role name. Tenant-wide access requires a distinct explicit permission.
- **Global reference data:** stable shared catalogs (for example units and standard classifications) are platform-owned and centrally governed. Tenant users can read but cannot directly mutate canonical values. Business-specific custom values are tenant-owned and must not shadow or alter global records.
- Tenant-owned products/SKUs and specifications, suppliers, customers, prices, stock and transactions remain tenant-scoped even when they reference global catalogs.

These are logical decisions, not approval of exact SQL columns, keys, nullability, indexes, constraints, policies or migrations.

## 5. Business workflow principles to preserve

### Fulfilment paths are distinct

**Warehouse:** supplier procurement → verified receipt into tenant-controlled storage → inventory batch → reservation → FIFO issue → trip loading → customer delivery.

**Direct fulfilment:** supplier procurement → loading → customer delivery → customer-confirmed receipt.

Direct fulfilment must not create an artificial warehouse receipt or inventory issue. Loading may share a header, but its source allocations must remain explicit and mutually exclusive.

### Quantity evidence

Keep supplier quantity, loaded quantity and received quantity distinct. Do not collapse them into one quantity or silently overwrite earlier measurements. Measurement history, tolerances, correction rules and evidence still require final approval.

### Finance and audit

- Preserve traceability from procurement batch and purchase order line to sales order line, loading, delivery, cost allocation and profitability.
- Receivables/payables are derived or controlled projections reconciled to source invoices, credit notes, payments, allocations and reversals; they are not freely editable balances.
- Keep customer, supplier and transporter payment allocations typed and distinct.
- Preserve posted history. Correct with reversals or controlled adjustments, not silent edits.
- One transporter invoice may cover multiple trips; invoice line items are required.

## 6. Repository state at handover

The initial scaffold is on `chore/initial-project-scaffold`, proposed in draft PR #1 against `main`.

Implemented in the scaffold:
- Next.js/React/TypeScript application shell and PetroCore Supply landing page.
- Email/password sign-in UI, Zod input validation, Supabase SSR browser/server client helpers and request session-refresh proxy.
- Authenticated workspace gate and sign-out action.
- Starter unit test for sign-in validation and a Playwright end-to-end suite covering the product identity and sign-in form.
- GitHub Actions workflow for lint, typecheck, unit tests and production build, plus a separate Playwright end-to-end job.
- Committed `package-lock.json`; CI installs with `npm ci` for reproducible builds.
- Configuration-aware auth states: `/workspace` renders an explicit setup notice instead of failing when Supabase is not configured, and `/login` redirects an already-signed-in user to the workspace.
- Per-field sign-in validation with `aria-invalid`, `aria-describedby` and focus on the first invalid field.
- Supabase settings are read through `getSupabaseConfig()` so the app renders safely before a project is connected.
- Baseline security headers (nosniff, frame denial, referrer policy, permissions policy) and a workspace loading state.
- Technical foundation, Milestone 1 scope, consolidated Database Dictionary v1.2 source document and Database v1.2 Reconciliation Report.

Current verification snapshot (2026-11-15):
- GitHub Actions CI run for the scaffold head completed successfully.
- A local verification pass was completed on Windows against Node 24.16.0 / npm 11.13.0: `npm install`, `npm run lint`, `npm run typecheck`, `npm test` (6 tests) and `npm run build` all passed, and `npm run test:e2e` passed 5 Playwright tests.
- The end-to-end suite currently covers only the unconfigured state; `playwright.config.ts` blanks the Supabase variables for determinism until an approved test project and tenant fixtures exist.
- This does **not** establish that a configured Supabase project, tenant membership, RLS, production database or business transactions work.
- Supabase environment values are not configured/verified in this handover.
- No production business tables or SQL migrations have been created.
- No procurement, inventory, sales, dispatch, delivery or finance transaction flows have been implemented.
- No code has been merged into `main`; PR #1 remains draft.

Local development and review work now happens on `chore/verification-and-ci-hardening`, branched from `chore/initial-project-scaffold`.

## 7. Source documents — read before implementation

1. `docs/architecture/technical-foundation.md` — approved technical direction and integrity boundaries.
2. `docs/database/database-v1.2-reconciliation-report.md` — entity-by-entity reconciliation, approved logical decisions, unresolved design questions and migration gate.
3. `docs/database/consolidated-database-dictionary-v1.2.md` — controlled implementation review draft; preserve unaffected v1.1 definitions and explicit v1.2 amendments.
4. `docs/implementation/milestone-1-auth-tenant-access.md` — Milestone 1 scope and acceptance/release criteria.
5. `docs/database/migration-1-tenant-access-checklist.md` — the questions to close before tenant/access SQL exists.
6. `docs/implementation/non-production-supabase-plan.md` — provisioning and verification plan; not executed.
7. `docs/README.md` and root `README.md`.

The dictionary is a controlled review draft, not final physical-schema approval. The ERD, full v1.1 dictionary, v1.2 amendments, Business Rules & Financial Logic Specification and Technical Blueprint must be reconciled together.

## 8. Outstanding decisions / implementation blockers

Do not guess these or encode irreversible assumptions:

- Measurement model: units, petroleum measurement basis, temperature/density conversion, tolerances, rounding, measurement event history and dispute evidence.
- Procurement quantity discrepancies: which variance states exist, investigation workflow, approval thresholds and when a variance becomes a confirmed loss/liability.
- Direct-fulfilment commercial/accounting treatment: revenue recognition, supplier cost allocation, expense treatment, customer confirmation and profitability basis.
- Invoicing/revenue: invoice eligibility, partial invoicing, invoice numbering, tax/levies and the precise relationship between delivery confirmation and invoicing.
- Offline conflict policy: conflict types, authority, resolution/override rules, retry/idempotency and treatment of stale reference data.
- Location model: operational location types, ownership, depot/customer/supplier location boundaries and exact access/assignment rules.
- Approvals: approval matrix, thresholds, separation of duties, delegation, escalation, rejection and amendment/re-submission history.
- Documents/evidence: required document types, ownership, retention, versioning, access, evidence validation and polymorphic-link safeguards.
- Liabilities and payment controls: supplier/transporter liability creation, invoice matching, payment verification, allocation, reversals and derived AP/AR reconciliation.
- Canonical physical schema: exact table/column names, field types, nullability, FKs, uniqueness, delete policy, indexes, RLS, triggers, transaction boundaries and migration/backfill strategy.
- Greenfield or legacy migration: confirm whether a pre-existing v1.1 PetroCore Supply database exists. The v1.2 documents assume one and require baseline inspection and additive backfill; if the product is greenfield, that instruction needs explicit owner reinterpretation (Reconciliation Report decision 25).

The reconciliation report's implementation gate remains binding: **no production SQL or schema migration until the complete field-level dictionary, ERD and related business/technical specifications are reconciled and approved, and the actual target database has been inspected/backed up.**

## 9. Recommended next steps for the coding agent

Work in small, reviewable commits on a feature branch. Do not merge PR #1 or create production migrations just to make visible progress.

1. ~~Inspect the full repository and current PR head; preserve any user changes.~~ Done 2026-11-15.
2. ~~Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and the Playwright suite locally; fix any failures and report exactly what ran.~~ Done 2026-11-15; see Section 6. Playwright now runs in CI.
3. Review the scaffold for accessibility, error handling, session handling and Next.js/Supabase SSR correctness. Add tests where needed. **Partially done:** signed-in `/login` redirect, unconfigured-Supabase state, per-field validation with accessible errors and focus handling are implemented and covered by tests. Remaining: an explicit no-active-membership state, which needs the approved membership schema.
4. Continue Milestone 1 only within the approved database gate: prepare a detailed schema reconciliation checklist and non-production setup plan; do not invent SQL fields or tenant membership tables. **Done 2026-11-15:** `docs/database/migration-1-tenant-access-checklist.md` and `docs/implementation/non-production-supabase-plan.md`.
5. Turn every unresolved business rule into a named decision record with options, consequences and an explicit owner approval requirement. **Not started.**
6. After the physical schema is approved, implement additive migrations, RLS policies and cross-tenant/cross-location tests before any operational modules.
7. Keep PR descriptions, docs and this handover current. Mark assumptions and unverified integrations clearly.

## 10. How the next agent should begin

Start by telling the user what branch and PR you found, what checks you ran, and any blockers. Then propose the smallest safe next implementation slice. Ask the product owner only for decisions that are genuinely required; do not ask them to repeat decisions already recorded here.

**Primary instruction:** Preserve the approved architecture and business boundaries. PetroCore Supply is independent, multi-tenant from day one, and database security/integrity comes before operational feature breadth.
