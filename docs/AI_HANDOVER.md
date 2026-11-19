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
- Tenant resolution in `/workspace`: verified tenant, access-pending and workspace-error states. The home page also carries a **Needs attention** queue (deliveries awaiting confirmation, trips with unresolved items including aging, transporter invoices awaiting assessment, storage batches awaiting receipt, members without a role), filtered by the caller's permissions and linking straight to the relevant tab.
- Tenant administration at `/workspace/access`: tabbed members, location access and activity. Member list with roles, role assignment/revocation, location grants, **member invitation** and **deactivation/reactivation**, server-side permission checks and audit triggers on every access change. Invitation uses the service role inside a `users.manage` action to create the auth user and profile, then shows a single-use invitation link for the admin to share; Supply does not send the email itself. Deactivation sets `status = inactive` and `deactivated_at`, keeps roles for reactivation, and refuses self-deactivation. Members without a role are counted, and the activity tab shows the newest access audit events for holders of `audit.view`. A read-only **role preview** at `/workspace/access/preview` (also linked from the members tab) shows exactly which sidebar items and permissions a chosen role would have. Full member impersonation lives in the platform module (DR-27), not in tenant access.
- Recent access activity on the activity tab for holders of `audit.view`, read from the append-only audit log.
- Platform administration at `/platform`: platform admins only, MFA-gated by default, read-only tenant view, 30-minute switch sessions and an append-only platform audit trail. Each active member has an **Impersonate** action: a 30-minute full session under that member's identity and RLS permissions (writes included), with a persistent banner and an exit action. Start and end are written to the platform audit trail; tenant audit entries made during the session are attributed to the target member (DR-27).
- Platform audit viewer at `/platform/audit`: newest 50 platform events with action, administrator, tenant, reason and timestamp; platform admins only.
- Account security at `/account/security`: TOTP enrollment, verification to AAL2 and factor removal. Removing the last factor ends the session so an elevated AAL2 claim cannot persist.
- Procurement at `/workspace/procurement`: tabbed purchase orders, batches, matching, suppliers and catalogue. Purchase orders and lines, supplier/depot/product masters with **edit and activate/deactivate** (records are never deleted), supplier-product links, and append-only batch capture with separate supplier, loaded and received quantities, optional purchase-order line linkage, tenant RLS and audit events. The **matching** tab compares ordered, invoiced (supplier batch quantity) and received quantities per PO line, with signed variances, values at the PO effective rate, invoice/batch references and exact-match status; batches without a PO line are listed separately. No tolerance is applied and invoice unit prices are not captured, so price variance is not calculated. Deactivated masters stay in history and on existing documents but drop out of the option lists used for new purchase orders, batches and links.
- Procurement costs at `/workspace/procurement/costs`: tabbed cost components and cost categories, with configurable categories (type, landed-cost inclusion, allocation method) and append-only components linked to a batch; allocation and approval remain pending decisions.
- Sales at `/workspace/sales`: tabbed orders and customers. Orders and lines are append-only with generated line totals; customers and delivery locations are managed on the customers tab, including **edit and activate/deactivate** (no hard delete). Deactivated customers stay in history but drop out of the option lists used for new sales orders and delivery locations. No invoicing, receivables or revenue recognition yet.
- Fleet at `/workspace/fleet`: tabbed transporters, trucks, compartments and drivers. Transporters, trucks and drivers support **edit and activate/deactivate** (no hard delete); deactivated records stay in history and on past trips but are hidden from new trucks, drivers, dispatch assignments, invoices and payments. Trucks keep the richer status set — maintenance and retired are set in the edit form, and the quick toggle only appears for active/inactive. Third-party trucks and drivers must reference a transporter; third-party drivers create no payroll obligation. Driver licence expiry is surfaced as a reminder, not a dispatch block. Deactivation is also enforced in the assignment action, not just the option list.
- Dispatch at `/workspace/dispatch`: tabbed trips, assignments, loading and allocations. Trucks and drivers cannot hold two active assignments; release is explicit and cancelling a trip releases automatically. Trip closure enforces the operating policy: unresolved reconciliation items block closure under a `block` policy unless the override permission and a reason are supplied, and trips past the aging window are marked.
- Trip P&L at `/workspace/dispatch/trips/[id]`: per-trip operational statement. Volume chain by product, loaded and delivered, reconciled variance and status; revenue from delivered quantity at the order price; purchase cost from allocated lifting at the PO effective price, falling back to the inventory landed cost; transport cost from linked transporter invoices; trip expenses (fuel, tolls, loading, driver allowance, maintenance, other) with optional fuel litres; recoveries; contribution, gross margin, net cost per delivered litre, distance from odometer readings, fuel efficiency in km/L and running cost per km. Transport invoices are also split across compartments by loaded volume, with fill percentage and an optional quoted per-compartment haulage compared against the split. Actual arrival can be recorded or updated here and is audited, giving duration and punctuality. Data gaps (no allocation, no price, no sales price, no linked invoice, no odometer) are listed rather than silently zeroed.
- Deliveries at `/workspace/deliveries`: tabbed deliveries and evidence. Delivery records link to a trip, sales order line, customer location and optional loading record, with customer-confirmed quantities, status, waybill reference and evidence uploads to private tenant storage with signed links.
- Reconciliation at `/workspace/reconciliation`: tabbed overview, reconciliations, discrepancies and investigations. The overview carries the supplier-to-loaded-to-delivered quantity chain and optional tolerance rules; discrepancies support audited landed-cost liability confirmation, rejection and partial recovery. A detail page at `/workspace/reconciliation/[id]` shows one reconciliation's items, discrepancies, investigations and liability actions.
- Inventory at `/workspace/inventory`: tabbed stock, receive and movement views with summary statistics, plus a batch detail page at `/workspace/inventory/batches/[id]` showing the source procurement, every movement and the FIFO allocations that consumed the layer. Receipts are cumulative up to the verified quantity. The receive form shows an indicative landed cost for the selected batch (purchase price plus landed components over batch quantity) and compares it with the cost being entered; it is a preview only and never posts a value.
- Stock fulfilment at `/workspace/inventory/fulfilment`: tabbed reservations, issues and allocations, with the same forms and guards as before. Reservations commit stock without moving it; posting consumes stock FIFO and preserves unit cost; reversals post compensating movements.
- Transporter invoices at `/workspace/transport-invoices`: tabbed invoices and invoice lines, recorded as submitted, with liability status fixed at `not_assessed` until DR-13 is approved.
- Finance at `/workspace/finance`: tabbed payments and profitability. Customer receipts and supplier or transporter payments are recorded as supplied with explicit links, plus an operational profitability view of order revenue against net FIFO cost of sales with a totals row. The payment form only offers directions the user may record.
- Settings at `/workspace/settings`: organisation summary and a danger zone that clears demo transactions after typing the organisation code, keeping users, master data and audit history.
- Business rules at `/workspace/settings/rules`: tabbed approvals, charge categories and operating policy. Approval tiers (action, amount range, required permission) are enforced by the liability confirmation RPC; transporter charge categories feed the invoice line form; trip closure policy, unresolved aging window and default correction method are stored per organisation and applied on dispatch. No thresholds are seeded, so confirmation keeps its previous behaviour until an owner configures a tier. Closure defaults to `warn` until a policy row is saved.

**UI foundation (2026-11-16):** every workspace page is wrapped by an app shell (`src/app/workspace/layout.tsx`, `src/components/shell/app-shell.tsx`) with permission-filtered sidebar navigation, a top bar, and a mobile drawer. Design tokens live in `src/app/globals.css` and mirror the PetroCore.app brand: blue primary (`#1e40af`/`#2563eb`), navy sidebar (`#0b1f3a`), green positive accent (`#1d9e75`), slate neutrals and DM Sans/DM Mono. Supply is tuned denser than the retail app but shares the family palette, logo mark and typography. Reusable primitives live in `src/components/ui` (Button, Card, Field/Input/Select/Textarea, Badge/StatusBadge, Alert, StatCard, PageHeader, EmptyState, Table, Toast). `/workspace/styleguide` is the living reference. All workspace modules now use the shell and primitives.

Navigation uses operator language while pages keep the formal term where it matters: **Stock issues** (fulfilment), **Trip checks** (reconciliation), **Haulage bills** (transporter invoices) and **Money** (payments and margin). Procurement keeps its name. Page eyebrows match the navigation labels.

The app is installable as a PWA: `src/app/manifest.ts` (standalone, navy/blue theme), generated icons in `public/icons`, and `public/sw.js`, registered in production only. The worker precaches `/offline` and icons, serves navigations network-first with the offline page as fallback, and caches only `/_next/static` and `/icons`. **No tenant page, RSC payload or authenticated response is cached, and no offline posting exists** — offline writes wait on DR-09 (offline conflict resolution). `/offline` states plainly that nothing was saved.

Server-action forms mirror their success message into a shared toast (`ToastProvider` in the shell, `ToastOnState` in each form) so a result survives navigation; errors stay inline next to the fields. Forms with real data entry carry `UnsavedGuard`, which warns before a full page unload while input is dirty (in-app link interception is not implemented). Delivery, loading, procurement batch and inventory receipt forms also carry `FormDraft`: values are saved to local storage 500 ms after typing, restored on return with a "Draft restored" banner and a discard action, and cleared when the action succeeds. File inputs are never stored.

Printable documents live outside the workspace shell at `/print/delivery/[id]` (A4 delivery waybill with quantities, transport details and a signature block) and `/print/transporter-invoice/[id]` (A4 invoice copy with charge lines and totals). Both check session and permission, rely on tenant RLS, are `noindex`, and use the shared `no-print` toolbar plus the `@media print` rules in `globals.css`. Delivery waybill links sit on the deliveries table; the invoice number links to its copy.

Current verification snapshot (2026-11-18):
- GitHub Actions CI is green on every push to `chore/verification-and-ci-hardening`.
- Local verification on Windows (Node 24.16.0): `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (169 tests) and `npm run test:e2e` (7 Playwright tests) all pass.
- Master-data lifecycle verified in the browser against the non-production project (2026-11-19): create → edit → deactivate → confirm hidden from new purchase orders, batches and sales orders → reactivate → clean up; the same cycle was then run for transporters, trucks and drivers against truck, driver, compartment, invoice, payment and dispatch assignment forms, including the maintenance-status exception for trucks. This flow is not in the Playwright suite yet; authenticated end-to-end tests still need a dedicated test Supabase project and seeded fixtures.
- Three-way match verified in the browser against `PO-DEMO-1` / `BAT-DEMO-1`: 10,000 ordered, 10,000 invoiced, 10,000 received, zero variances, `9,000,000.00` at a `900.00` rate, `Matched` status, with the missing supplier invoice number called out. Variance, awaiting-receipt, partial-receipt and discount cases are covered by unit tests.
- The end-to-end suite covers the unconfigured, signed-out and validation states; `playwright.config.ts` blanks the Supabase variables so it stays deterministic.
- A non-production Supabase project exists with migrations applied through `20261118000100`.
- Live browser checks used the Alpha administrator (`ORG-A`) against seeded demo data; screenshots verified every migrated page in its tabs.
- Performance (2026-11-18): a request-scoped `getWorkspaceContext` (`src/modules/tenant/workspace-context.ts`, React `cache`) now shares auth, tenant resolution and all permission RPCs between the layout and page. Adopted in workspace, dispatch, procurement, inventory, deliveries, sales, reconciliation, transport invoices, fleet and finance. Production-build navigation measured 1.1–2.9 s (home ~2.7 s, dispatch ~2.9 s); dev is slower because each route still compiles on first visit. Remaining pages (access, settings, costs, fulfilment, batch/trip/reconciliation detail, print views) still fetch their own context and can adopt the same helper. Home is the heaviest due to the attention queries and could stream behind Suspense.
- No **production** database has been touched. Procurement, costs, sales, dispatch, loading, deliveries and evidence, reconciliation, inventory receipts, reservations, issues with reversals, FIFO allocations, transporter invoices and payments with operational profitability are implemented against the non-production project only.
- No code has been merged into `main`; PR #1 remains draft.

Local development and review work now happens on `chore/verification-and-ci-hardening`, branched from `chore/initial-project-scaffold`.

**Demo data (non-production only):** `supabase/seed/demo-tenant.sql` recreates the demo rows used for screenshots — one delivery with waybill evidence, a customer receipt and supplier payment, a transporter invoice with two charge lines, and an inbound-haulage cost category with one batch component. It is idempotent because delivery and invoice triggers validate before conflict resolution, so every insert is guarded by a `not exists` check; `supabase/seed/demo-tenant-teardown.sql` removes exactly those rows by id. Master data (`BAT-DEMO-1`, `TRIP-DEMO-1`, `SO-DEMO-1`, suppliers, products, customers, locations) is not created or removed. The seed does not create auth users or storage objects. A stray "RLS test category" left by a security test was deleted on 2026-11-18. The seed also creates `PO-DEMO-1` and links it to `BAT-DEMO-1` (10,000 L at ₦900) so purchase cost and the landed-cost preview have a price.

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

Two decision papers are ready for the owner: transporter liability and charges (DR-13) and measurement, temperature correction and tolerances (DR-01/DR-02/DR-03). Both list options, consequences, data-model impact and a blank decision record, and neither encodes a rule. A third sheet, `docs/business-rules/proposed-defaults-2026-11-18.md`, converts the remaining options into concrete proposals — ₦500,000 / ₦500,000+ approval tiers, 0.20–0.25 % tolerances with 40–50 L floors, a trip-closure guard with a 7-day aging report, and a supplier-factor correction default — with a sign-off table. **Nothing in it is approved or implemented.** Until sign-off, the system records evidence only.

## 9. Recommended next steps for the coding agent

Work in small, reviewable commits on a feature branch. Do not merge PR #1 or create production migrations just to make visible progress.

1. ~~Inspect the full repository and current PR head; preserve any user changes.~~ Done 2026-11-15.
2. ~~Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and the Playwright suite locally; fix any failures and report exactly what ran.~~ Done 2026-11-15; see Section 6. Playwright now runs in CI.
3. Review the scaffold for accessibility, error handling, session handling and Next.js/Supabase SSR correctness. Add tests where needed. **Done 2026-11-15:** signed-in `/login` redirect, unconfigured-Supabase state, per-field validation with accessible errors, focus handling, loading, error boundary, and the access-pending state are implemented.
4. Continue Milestone 1 only within the approved database gate: prepare a detailed schema reconciliation checklist and non-production setup plan; do not invent SQL fields or tenant membership tables. **Done 2026-11-15:** `docs/database/migration-1-tenant-access-checklist.md` and `docs/implementation/non-production-supabase-plan.md`.
5. Turn every unresolved business rule into a named decision record with options, consequences and an explicit owner approval requirement. **Done 2026-11-15:** `docs/business-rules/decision-register.md`. All Milestone 1 decisions are approved.
6. ~~Apply the tenant/access migration and run the isolation tests.~~ Done 2026-11-15: version `20261115000100` applied to the non-production project; T-001-T-014 passed; browser sign-in verified.
7. **Milestone 2 in progress.** Procurement, costs, sales orders, fleet, dispatch with double-booking prevention, loading, deliveries with evidence uploads, reconciliation, inventory receipts, reservations, issues with reversals and FIFO allocations, transporter invoices and payment records with operational profitability are implemented. Approval thresholds, transporter charge categories and operating policy are configurable per organisation and audited; thresholds are enforced on liability confirmation, and the closure policy is enforced on dispatch with an aging view. Remaining: tolerance values (configurable but unseeded), per-boundary tolerances, a temperature-correction method (optional recording only), supplier invoice price capture for the three-way match, automatic payment allocation and ageing, and statutory accounting.
8. Keep PR descriptions, docs and this handover current. Mark assumptions and unverified integrations clearly.

## 10. How the next agent should begin

Start by telling the user what branch and PR you found, what checks you ran, and any blockers. Then propose the smallest safe next implementation slice. Ask the product owner only for decisions that are genuinely required; do not ask them to repeat decisions already recorded here.

**Primary instruction:** Preserve the approved architecture and business boundaries. PetroCore Supply is independent, multi-tenant from day one, and database security/integrity comes before operational feature breadth.


## 11. Database design documents (approved 2026-11-15)

The design review pack was merged from `docs/database-v1.2-review-proposal` (PR #2) into `chore/verification-and-ci-hardening` on 2026-11-15.

- `docs/database/database-dictionary-v1.2-proposal.md` - complete v1.1 field-level baseline plus proposed v1.2 amendments, candidate tenant/membership fields and an ownership review inventory.
- `docs/erd/erd-v1.2-proposal.md` - reconstructed logical ERD based on the v1.1 dictionary, v1.2 amendment specification and reconciliation report.
- `docs/business-rules/decision-paper-dr-13-transporter-liability.md` - options and consequences for transporter liability, valuation, recovery and charge categories.
- `docs/business-rules/decision-paper-dr-01-03-measurement-tolerances.md` - options and consequences for measurement points, precision, temperature correction and tolerance bands.
- `docs/business-rules/proposed-defaults-2026-11-18.md` - proposed numbers for the open decisions (approval tiers, tolerance values, trip closure, correction method) and an owner sign-off table. Proposed, not approved.
- `docs/database/security-audit-2026-11-16.md` - schema-wide privilege audit, fixes and deliberate exceptions.

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
- Migration `20261115002600_least_privilege_sweep` revokes anonymous execution of tenant RPCs, TRUNCATE on all tables, DELETE where no policy allows it, writes on views, and direct UPDATE on inventory batches.
- Migration `20261115002700_revoke_public_execute` removes EXECUTE inherited from PUBLIC so `anon` can call no function. The full findings are in `docs/database/security-audit-2026-11-16.md`.
- Migration `20261115002800_transporter_liability` adds liability confirmation at landed cost (derived from the trip's FIFO allocations, or manual when no issue exists) and optional recovery by invoice deduction or debit note.
- Migration `20261115002900_tolerance_rules` adds optional tolerance rules (percentage, absolute, greater of both) and computes classification when a rule matches.
- Migration `20261115003000_measurement_chain` adds optional temperature/density/correction fields to loading and delivery records and the `trip_quantity_chain` view covering both measurement boundaries.
- Migration `20261115003100_demo_reset` adds `reset_organisation_demo_data`, a single-transaction organisation reset behind a typed organisation-code confirmation and `organisation.manage`; the audit trail and master data are preserved.
- Migration `20261115003200_charge_categories_partial_recovery` adds optional invoice charge categories and partial liability recoveries with an outstanding-balance guard.
- Migration `20261118000100_dynamic_operating_rules` adds `approval_thresholds`, `transporter_charge_categories` and `operating_policies`, resolves the required permission for an amount, seeds the five existing charge categories, audits configuration changes, and makes liability confirmation reject amounts above the caller's configured authority. No thresholds or policies are seeded.
- Migration `20261118000200_trip_closure` adds `close_trip`, which reads the operating policy, counts unresolved reconciliation items, blocks closure under a `block` policy without the override permission and a reason, and audits every closure.
- Migration `20261118000300_trip_expenses` adds append-only trip expenses (fuel, toll, loading, driver allowance, maintenance, other) with optional fuel litres, tenant RLS, insert-only grants and an audit trigger.
- Migration `20261118000400_trip_odometer` adds optional departure and arrival odometer readings with an ordering check.
- Migration `20261118000500_trip_arrival_audit` audits every change to actual arrival or arrival odometer, recording previous and new values.
- Migration `20261118000600_compartment_haulage` adds an optional quoted haulage cost per loading record, compared with the invoice split on the trip statement.
- Batch capture records supplier, loaded and received quantities as supplied and defaults `variance_status` to `not_assessed`; it deliberately does not apply tolerances, temperature correction or variance rules.
- The single non-production platform admin is bootstrapped with `mfa_required = true`; the happy-path test temporarily disabled it and restored it. MFA enrolment is not yet built into the app, so platform switching currently requires an AAL2 session obtained elsewhere.

Milestone 1 is complete: authentication, tenant resolution, access administration, audit visibility, second-tenant isolation, the no-membership state and platform support switching are implemented and verified. Remaining follow-ups are the MFA enrolment UI, a platform audit viewer, and Milestone 2 business-rule approvals.

No **production** database has been touched. `main` and StationOs remain untouched; PR #1 remains draft.
