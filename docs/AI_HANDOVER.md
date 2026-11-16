# PetroCore Supply — AI Agent Handover

**Last updated:** 2026-11-15  
**Repository:** https://github.com/Tunol82/PetroCore-Supply  
**Current working branch at latest verification:** `chore/verification-and-ci-hardening`  
**Database design review branch:** `docs/database-v1.2-review-proposal`  
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
- Baseline security headers (nosniff, frame denial, referrer policy, permissions policy), a workspace loading state, a route error boundary and a `/api/health` configuration probe that exposes no secrets.
- Technical foundation, Milestone 1 scope, consolidated Database Dictionary v1.2 source document and Database v1.2 Reconciliation Report.
- Owner-approved design review pack (PR #2, merged 2026-11-15): field-level Database Dictionary v1.2 proposal, reconstructed ERD v1.2, Decision Register, Migration 1 checklist and non-production Supabase plan.
- Tenant access migration applied to the non-production project: organisations, settings, locations, profiles, roles, permissions, role assignments, location grants and audit log, with RLS on every table.
- Tenant resolution in `/workspace`: verified tenant, access-pending and workspace-error states.
- Tenant administration at `/workspace/access`: member list with roles, role assignment/revocation, location grant creation/revocation, server-side permission checks and audit triggers on every access change.
- Recent access activity on the same page for holders of `audit.view`, read from the append-only audit log.
- Platform administration at `/platform`: platform admins only, MFA-gated by default, read-only tenant view, 30-minute switch sessions and an append-only platform audit trail.
- Platform audit viewer at `/platform/audit`: newest 50 platform events with action, administrator, tenant, reason and timestamp; platform admins only.
- Account security at `/account/security`: TOTP enrollment, verification to AAL2 and factor removal. Removing the last factor ends the session so an elevated AAL2 claim cannot persist.
- Procurement at `/workspace/procurement`: supplier, product and supplier-depot master data, purchase orders and line items, supplier-product links, and append-only procurement batch capture with separate supplier, loaded and received quantities, optional purchase-order line linkage, tenant RLS and audit events.
- Procurement costs at `/workspace/procurement/costs`: configurable cost categories and append-only procurement cost components linked to a batch; allocation and approval remain pending decisions.
- Sales at `/workspace/sales`: customers, delivery locations, append-only sales orders and confirmed order lines with generated line totals. No invoicing, receivables or revenue recognition yet.
- Fleet at `/workspace/fleet`: transporters, trucks, compartments and drivers. Third-party trucks and drivers must reference a transporter; third-party drivers create no payroll obligation.
- Dispatch at `/workspace/dispatch`: trips, manual truck/driver assignments, compartment loading records and procurement loading allocations, with database checks for capacity, product match and allocated quantities.
- Deliveries at `/workspace/deliveries`: delivery records linked to a trip, sales order line, customer location and optional loading record, with customer-confirmed quantities, status, waybill reference and evidence uploads to private tenant storage with signed links.
- Reconciliation at `/workspace/reconciliation`: trip reconciliation headers and items with generated variances, delivery discrepancies and append-only investigations. Variance is evidence only; it does not create a loss or liability.
- Inventory at `/workspace/inventory`: verified receipt of storage procurement into a tenant location, creating an inventory batch and an append-only receipt movement. Receipts are cumulative up to the verified quantity.
- Stock fulfilment at `/workspace/inventory/fulfilment`: reservations that commit stock without moving it, draft issues with lines, posting that consumes stock FIFO and preserves the batch unit cost, and audited reversals that post compensating movements and allocations.
- Transporter invoices at `/workspace/transport-invoices`: invoices and lines recorded as submitted, with liability status fixed at `not_assessed` until DR-13 is approved.
- Finance at `/workspace/finance`: customer receipts and supplier or transporter payments recorded as supplied with explicit links, plus an operational profitability view of order revenue against net FIFO cost of sales.
- Dispatch at `/workspace/dispatch`: trips, truck/driver assignments with double-booking prevention, explicit release of an assignment, and automatic release when a trip is cancelled.

Current verification snapshot (2026-11-15):
- GitHub Actions CI run for the scaffold head completed successfully.
- A local verification pass was completed on Windows against Node 24.16.0 / npm 11.13.0: `npm run lint`, `npm run typecheck`, `npm test` (11 tests) and `npm run build` all passed, and `npm run test:e2e` passed 6 Playwright tests.
- The end-to-end suite covers the unconfigured, signed-out and validation states; `playwright.config.ts` blanks the Supabase variables so it stays deterministic.
- A non-production Supabase project now exists. Migration `20261115000100_tenant_access_core` was applied on 2026-11-15 and the tenant-isolation tests passed (see the Migration 1 physical proposal §9).
- Live browser sign-in was verified: `/workspace` resolved the organisation `Alpha` (`ORG-A`) from the authenticated membership, with no console errors.
- `npm run verify:live` verifies three identities end to end: the Alpha administrator (tenant + access administration), a Beta-tenant user (isolation, no admin link, access denied) and a no-membership user (access-pending state). All passed on 2026-11-15.
- Local Supabase values live in `.env.local`, which is git-ignored. No credentials are committed.
- No **production** database has been touched. Procurement, sales, dispatch, delivery, reconciliation, inventory receipt, reservation, issue and FIFO allocation flows are implemented against the non-production project only; finance remains unimplemented.
- No code has been merged into `main`; PR #1 remains draft.

Local development and review work now happens on `chore/verification-and-ci-hardening`, branched from `chore/initial-project-scaffold`.

## 7. Source documents — read before implementation

1. `docs/architecture/technical-foundation.md` — approved technical direction and integrity boundaries.
2. `docs/database/database-v1.2-reconciliation-report.md` — entity-by-entity reconciliation, approved logical decisions, unresolved design questions and migration gate.
3. `docs/database/consolidated-database-dictionary-v1.2.md` — controlled implementation review draft; preserve unaffected v1.1 definitions and explicit v1.2 amendments.
4. `docs/implementation/milestone-1-auth-tenant-access.md` — Milestone 1 scope and acceptance/release criteria.
5. `docs/database/migration-1-tenant-access-checklist.md` — the questions to close before tenant/access SQL exists.
6. `docs/business-rules/decision-register.md` — unresolved decisions and their approval status.
7. `docs/implementation/non-production-supabase-plan.md` — provisioning and verification plan; not executed.
8. `docs/README.md` and root `README.md`.

The dictionary is a controlled review draft, not final physical-schema approval. The ERD, full v1.1 dictionary, v1.2 amendments, Business Rules & Financial Logic Specification and Technical Blueprint must be reconciled together.

## 8. Outstanding decisions / implementation blockers

Do not guess these or encode irreversible assumptions:

- Measurement model: units, petroleum measurement basis, temperature/density conversion, tolerances, rounding, measurement event history and dispute evidence.
- Procurement quantity discrepancies: which variance states exist, investigation workflow, approval thresholds and when a variance becomes a confirmed loss/liability.
- Direct-fulfilment commercial/accounting treatment: revenue recognition, supplier cost allocation, expense treatment, customer confirmation and profitability basis.
- Invoicing/revenue: invoice eligibility, partial invoicing, invoice numbering, tax/levies and the precise relationship between delivery confirmation and invoicing.
- Offline conflict policy: conflict types, authority, resolution/override rules, retry/idempotency and treatment of stale reference data.
- Location model: **resolved (DR-10)** — flat, tenant-owned, typed locations with no inheritance.
- Approvals: **resolved for Milestone 1 (DR-20)** — deferred to the finance milestone; access administration is audited.
- Documents/evidence: required document types, ownership, retention, versioning, access, evidence validation and polymorphic-link safeguards. Still open; Part 2 defines the tables but not the policy.
- Liabilities and payment controls: supplier/transporter liability creation, invoice matching, payment verification, allocation, reversals and derived AP/AR reconciliation. Still open.
- Canonical physical schema: the tenant/access schema is applied (`20261115000100`), with RPC wrappers (`...0200`), access-audit triggers (`...0300`) and platform admin (`...0400`). Ownership is resolved (DR-24: direct `organisation_id`).
- Migration basis is resolved: the product is **greenfield** (DR-25). No v1.1 database exists, so there is no legacy inspection or backfill.

Milestone 1 is complete and applied to the non-production project. The remaining decisions above belong to Milestone 2 and later. The reconciliation report's implementation gate remains binding for production: **no production deployment until the operational modules are implemented against the approved rules.**

## 9. Recommended next steps for the coding agent

Work in small, reviewable commits on a feature branch. Do not merge PR #1 or create production migrations just to make visible progress.

1. ~~Inspect the full repository and current PR head; preserve any user changes.~~ Done 2026-11-15.
2. ~~Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and the Playwright suite locally; fix any failures and report exactly what ran.~~ Done 2026-11-15; see Section 6. Playwright now runs in CI.
3. Review the scaffold for accessibility, error handling, session handling and Next.js/Supabase SSR correctness. Add tests where needed. **Done 2026-11-15:** signed-in `/login` redirect, unconfigured-Supabase state, per-field validation with accessible errors, focus handling, loading, error boundary, and the access-pending state are implemented.
4. Continue Milestone 1 only within the approved database gate: prepare a detailed schema reconciliation checklist and non-production setup plan; do not invent SQL fields or tenant membership tables. **Done 2026-11-15:** `docs/database/migration-1-tenant-access-checklist.md` and `docs/implementation/non-production-supabase-plan.md`.
5. Turn every unresolved business rule into a named decision record with options, consequences and an explicit owner approval requirement. **Done 2026-11-15:** `docs/business-rules/decision-register.md`. All Milestone 1 decisions are approved.
6. ~~Apply the tenant/access migration and run the isolation tests.~~ Done 2026-11-15: version `20261115000100` applied to the non-production project; T-001–T-014 passed; browser sign-in verified.
7. **Milestone 2 in progress.** Procurement, costs, sales orders, fleet, dispatch with double-booking prevention, loading, deliveries with evidence uploads, reconciliation, inventory receipts, reservations, issues with reversals and FIFO allocations, transporter invoices and payment records with operational profitability are implemented. Remaining: approved liability and deduction rules (DR-13), tolerances and variance classification (DR-01/DR-03), automatic payment allocation and ageing, and statutory accounting.
8. Keep PR descriptions, docs and this handover current. Mark assumptions and unverified integrations clearly.

## 10. How the next agent should begin

Start by telling the user what branch and PR you found, what checks you ran, and any blockers. Then propose the smallest safe next implementation slice. Ask the product owner only for decisions that are genuinely required; do not ask them to repeat decisions already recorded here.

**Primary instruction:** Preserve the approved architecture and business boundaries. PetroCore Supply is independent, multi-tenant from day one, and database security/integrity comes before operational feature breadth.


## 11. Database design documents (approved 2026-11-15)

The design review pack was merged from `docs/database-v1.2-review-proposal` (PR #2) into `chore/verification-and-ci-hardening` on 2026-11-15.

- `docs/database/database-dictionary-v1.2-proposal.md` — complete v1.1 field-level baseline plus proposed v1.2 amendments, candidate tenant/membership fields and an ownership review inventory.
- `docs/erd/erd-v1.2-proposal.md` — reconstructed logical ERD based on the v1.1 dictionary, v1.2 amendment specification and reconciliation report.

Approval state:
- The product owner approved the review pack as the working design baseline on 2026-11-15.
- **DR-16 approved:** retain the v1.1 canonical names; ERD names are documentation aliases only.
- **DR-25 approved:** greenfield. No v1.1 database exists; build v1.2 semantics directly in an empty project.
- **DR-10 approved:** flat, tenant-owned, typed locations; no inheritance.
- **DR-20 approved:** approvals deferred to the finance milestone; access administration is audited.
- **DR-24 approved:** direct `organisation_id` on every tenant-owned table, composite tenant keys on junctions.
- The five permission keys (`organisation.manage`, `users.manage`, `locations.manage`, `locations.view_all`, `audit.view`) are approved.
- v1.1 baseline provenance and the field-level amendments are approved. ERD approval applies to the reconstruction; re-verify if the original artefact is produced.
- v1.1 Part 2 (sections 12-25) was supplied on 2026-11-15 and appended to Appendix A, closing the platform-control gap.
- Migration `20261115000100_tenant_access_core` was applied to the non-production project on 2026-11-15. Isolation tests T-001–T-014 passed and browser sign-in resolved the tenant correctly.
- **DR-26 approved and implemented:** migration `20261115000400_platform_admin` adds platform admins, switch sessions and platform audit. PA-001-PA-012 passed. Platform access is read-only and MFA-gated by default.
- Migration `20261115000500_procurement_core` adds suppliers, supplier depots, products and append-only procurement batches, with `procurement.view` / `procurement.manage` permissions.
- Migration `20261115000600_least_privilege_grants` revokes unused write grants that Supabase's defaults had applied; RLS already blocked them, but defence in depth now matches intent.
- Migration `20261115000700_purchase_orders` adds purchase orders, line items with a generated line total, and an optional purchase-order line link on procurement batches. Orders and lines are append-only.
- Migration `20261115000800_procurement_costs` adds supplier-product links, cost categories and append-only procurement cost components with a recorded-cost audit event.
- Migration `20261115000900_sales_core` adds customers, delivery locations, append-only sales orders and confirmed order lines with a generated line total.
- Migration `20261115001000_transport_dispatch` adds transporters, trucks, compartments, drivers, trips and assignments, with one active primary assignment per trip and dispatch audit events.
- Migration `20261115001100_trip_loading` adds compartment loading records and typed procurement loading allocations, with capacity, product-match and quantity validation triggers.
- Migration `20261115001200_deliveries` adds delivery records and evidence metadata, with product, customer-location, cumulative-quantity and confirmed-quantity validation.
- Migration `20261115001300_reconciliation` adds reconciliation headers, items with generated variances, discrepancies and investigations, with audit events.
- Migration `20261115001400_reconciliation_grants` revokes leftover UPDATE grants on reconciliation items and investigations.
- Migration `20261115001500_inventory_receipts` adds inventory batches and an append-only movement ledger, with procurement/product/location/quantity validation and a receipt movement posted by trigger.
- Migration `20261115001600_inventory_cumulative_receipts` replaces the one-receipt-per-procurement rule with cumulative receipts bounded by the verified quantity, serialised by a row lock.
- Migration `20261115001700_inventory_reservations` adds reservations and reservation lines; active reservations cannot exceed a batch's remaining quantity and never reduce physical stock.
- Migration `20261115001800_inventory_issues_fifo` adds issues, issue lines and FIFO allocations plus `post_inventory_issue` and `release_reservation_item` RPCs. Posting locks affected batches, consumes oldest batches first, preserves unit cost and aborts entirely on a shortfall.
- Migration `20261115001900_double_booking` prevents a truck or driver holding two active assignments, locks the truck and driver while checking, adds the audited `release_trip_assignment` RPC and releases assignments when a trip is cancelled.
- Migration `20261115002000_assignment_release_grants` revokes direct UPDATE on trip assignments so release always goes through the audited function.
- Migration `20261115002100_cancelled_trip_assignments` rejects new assignments on a cancelled trip.
- Migration `20261115002200_evidence_storage` creates the private `delivery-evidence` bucket (5 MB; JPEG, PNG, WebP, PDF), adds file metadata columns to `delivery_evidence`, and restricts storage objects to the caller's organisation folder with transport permissions. Evidence has no update or delete policy.
- Migration `20261115002300_issue_reversals` adds `reverse_inventory_issue`: a posted issue is reversed by a compensating movement and allocation per consumed batch, stock returns at the preserved cost, reservation fulfilment is undone, and the issue is frozen as `reversed` with a reason.
- Migration `20261115002400_transporter_invoices` adds append-only transporter invoices and lines with generated totals; liability stays `not_assessed` until DR-13.
- Migration `20261115002500_payments_profitability` adds append-only payment records (receipts need `sales.manage`, payments need `procurement.manage`) and the `security_invoker` view `sales_order_profitability` combining order revenue, net FIFO cost of sales and recorded receipts.
- Batch capture records supplier, loaded and received quantities as supplied and defaults `variance_status` to `not_assessed`; it deliberately does not apply tolerances, temperature correction or variance rules.
- The single non-production platform admin is bootstrapped with `mfa_required = true`; the happy-path test temporarily disabled it and restored it. MFA enrolment is not yet built into the app, so platform switching currently requires an AAL2 session obtained elsewhere.

Milestone 1 is complete: authentication, tenant resolution, access administration, audit visibility, second-tenant isolation, the no-membership state and platform support switching are implemented and verified. Remaining follow-ups are the MFA enrolment UI, a platform audit viewer, and Milestone 2 business-rule approvals.

No **production** database has been touched. `main` and StationOs remain untouched; PR #1 remains draft.
