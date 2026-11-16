# PetroCore Supply — Decision Register

**Status:** Open register. Nothing here is a decision unless the status says **Approved**.  
**Owner:** Product owner (Tunde Oladeji).  
**Prepared:** 2026-11-15.  
**Related:** Database v1.2 Reconciliation Report §8–§9, Milestone 1, Migration 1 checklist.

## 1. How to use this register

1. No decision may be implemented from this register while its status is **Open**.
2. A decision becomes implementable only when the owner records **Approved**, the chosen option, the date and any conditions.
3. If work must proceed before approval, it must be structured so the decision can be applied later without rewriting posted history.
4. Approved decisions are copied into the source document that governs the affected area (dictionary, ERD or business rules), not only here.

Status values: **Open**, **Approved**, **Deferred**, **Superseded**.

Already approved: D-001 tenancy and switching, D-002 tenant master, D-003 Super Admin, D-004 location access, D-005 global reference data (see the reconciliation report §9), plus DR-16 and DR-25 below.

## 2. Approved in this revision

### DR-16 — Canonical entity naming

| Field | Detail |
|---|---|
| Status | **Approved** — option (a): retain v1.1 names as canonical |
| Question | Which name is canonical for each concept where the ERD and v1.1 dictionary differ: `purchase_orders` vs `procurement_orders`, `business_locations` vs `locations`, `sales_credit_notes` vs `credit_notes`, `payment_records` vs `payments`, `trip_delivery_records` vs `deliveries`, `business_settings` vs `organisations`? |
| Why it matters | Two names for one concept creates duplicate masters and split reporting. The migration cannot start until each concept has one name. |
| Options | (a) Retain v1.1 names as canonical, map ERD names in documentation. (b) Adopt ERD names and rename with a controlled migration. (c) Mixed: retain v1.1 where data exists, adopt ERD where new. |
| Consequences | (a) smallest migration, ERD readers must translate. (b) clearest long-term model, but renames affect constraints, policies and any existing code. (c) risks exactly the duplicate-source problem the report warns about. |
| Blocks | Migration 1 and every later migration. |
| Recommendation | (a) for Milestone 1 entities, because no data exists yet and renames add risk without benefit. |
| Decision | `purchase_orders`, `business_locations`, `sales_credit_notes`, `payment_records`, `trip_delivery_records` and `business_settings` remain canonical. `organisations` is the approved tenant master (D-002); `business_settings` remains its settings record. ERD alternative names are documentation aliases only. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Approved with the Database Dictionary v1.2 / ERD review pack in the project conversation. |
| Conditions | Do not create alias tables or duplicate masters. A future rename requires a new decision and an approved migration map. |
| Recorded in | Database Dictionary v1.2 §2; ERD v1.2 §5; Migration 1 checklist. |

### DR-25 — Greenfield or legacy migration

| Field | Detail |
|---|---|
| Status | **Approved** — option (a): greenfield |
| Question | Does a pre-existing v1.1 PetroCore Supply database exist that must be inspected, backfilled and migrated? |
| Why it matters | The v1.2 documents instruct "do not build from scratch; migrate only what is missing". If no database exists, that instruction is inapplicable and the migration plan reduces to controlled schema creation. |
| Options | (a) Greenfield: build v1.2 semantics directly, no backfill. (b) Legacy: inspect and migrate additively. |
| Consequences | (a) simpler, no reconciliation queries, but the "baseline verification" step becomes a confirmation that the target is empty. (b) requires full field-level dictionary and live-schema inspection first. |
| Blocks | Every migration. |
| Recommendation | (a) greenfield: no PetroCore Supply database exists and StationOs must remain untouched. |
| Decision | There is no v1.1 database to migrate. Build v1.2 semantics directly in a new, empty Supabase project. No backfill, dual-read or deprecation migrations are required. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Approved with the Database Dictionary v1.2 / ERD review pack in the project conversation. |
| Conditions | Confirm the target project is empty before the first migration. If a v1.1 database is later discovered, stop and reopen this decision. |
| Recorded in | Non-production Supabase plan; Migration 1 checklist; Reconciliation Report decision 25. |

### DR-20 — Approval model

| Field | Detail |
|---|---|
| Status | **Approved** — option (c): defer approvals to the finance milestone |
| Question | How do `approval_rules`, `approval_requests` (ERD) and `approval_records` (v1.1) relate? Is approval needed in Milestone 1 at all? |
| Why it matters | Approval history is part of access administration and later financial controls. Retrofitting an approval model after postings exist is expensive. |
| Options | (a) Single `approval_records` table for Milestone 1, expand later. (b) Full rule/request/decision split now. (c) Defer approvals entirely to the finance milestone. |
| Consequences | (a) simple, but may need migration later. (b) more work now, future-proof. (c) least work now, highest rework risk. |
| Decision | No approval tables in Milestone 1. Access administration is auditable through `audit_logs`. Approval rules, requests and decisions are designed with the finance phase, before any posting that requires approval. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Owner approved all outstanding Milestone 1 decisions in the project conversation. |
| Conditions | No financial or inventory posting may be enabled before the approval model is designed. `audit_logs` must capture access changes in the meantime. |
| Recorded in | Migration 1 physical proposal; dictionary §3.9 and §6; ERD §5. |

### DR-24 — Tenant and location ownership coverage

| Field | Detail |
|---|---|
| Status | **Approved** — option (a): direct `organisation_id` on every tenant-owned table |
| Question | Which tables carry `organisation_id` directly, which inherit ownership through a parent, and which are platform-global? What is the exact RLS predicate model? |
| Why it matters | RLS correctness depends on every tenant-owned row being resolvable to one organisation. A missed table is a cross-tenant leak. |
| Options | (a) Direct `organisation_id` on every tenant table. (b) Direct on aggregate roots, inherited through enforced parents. (c) Hybrid, documented table by table. |
| Consequences | (a) simplest policies, more columns and joins. (b) fewer columns, policies depend on joins being correct. (c) flexible but easiest to get wrong. |
| Decision | Every tenant-owned table carries `organisation_id` directly. Junctions add it and use composite foreign keys to the parents' `(id, organisation_id)` keys so a cross-tenant parent cannot be stored. Platform-global tables carry no `organisation_id`; currently only `permissions` and future approved global catalogs. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Owner approved all outstanding Milestone 1 decisions in the project conversation. |
| Conditions | Every new tenant table must follow the same pattern. A table without `organisation_id` requires an explicit platform-global classification. |
| Recorded in | Migration 1 physical proposal §2; dictionary §4; Migration 1 draft SQL. |

### DR-10 — Location model and hierarchy

| Field | Detail |
|---|---|
| Status | **Approved** — option (a): flat, tenant-owned, typed locations |
| Question | What location types exist (depot, office, customer site, supplier depot), how are they owned, and does access inherit through a hierarchy? |
| Why it matters | D-004 settles *how* access is granted, not *what* a location is. RLS scope and dispatch workflows both depend on it. |
| Options | (a) Flat tenant-owned `business_locations` with a type. (b) Hierarchical locations with inherited access. (c) Separate tables per location kind. |
| Consequences | (a) simplest, no inheritance. (b) powerful, harder policies. (c) clearest semantics, more joins and duplication. |
| Decision | `business_locations` remains the single flat, tenant-owned location entity with `location_type` and `is_storage_location`. There is no parent location and no inherited access. Supplier depots and customer locations remain separate entities. Access is explicit per D-004. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Owner approved all outstanding Milestone 1 decisions in the project conversation. |
| Conditions | Introducing hierarchy later requires a new decision and a migration with backfill. |
| Recorded in | Migration 1 physical proposal §2; dictionary §3.3; ERD §5. |

### DR-13 — Transporter liability and charges (approved subset)

| Field | Detail |
|---|---|
| Status | **Approved in part** — 2026-11-16 |
| Question | When a shortage occurs, who owes what, at what value, and how is it recovered? |
| Decision | Liability is confirmed manually and audited, valued at **landed cost**, and recovery is **optional** — either a deduction against the transporter invoice or a debit note. Only a shortage can become a liability. Excess is never a negative liability. |
| Basis of landed cost | The FIFO allocations actually consumed on that trip for that product: issue cost minus reversal cost, divided by net quantity. If the trip has no posted issue, the confirmer must supply a unit cost and the record is marked `manual`. |
| Recovery | One full-amount recovery per discrepancy, recorded against the confirmed liability. A confirmed liability cannot be rejected, and a discrepancy with a recovery cannot be rejected. |
| Conditions | No automatic liability. No employee deduction. No payment mutation. No journal entry. Transporter invoice charge categories and approval thresholds (DR-11) remain open. |
| Recorded in | Migration `20261115002800_transporter_liability`; `/workspace/reconciliation`; paper `decision-paper-dr-13-transporter-liability.md`. |

### DR-01, DR-02, DR-03 — Measurement and tolerances (approved subset)

| Field | Detail |
|---|---|
| Status | **Approved in part** — 2026-11-16 |
| DR-01 | Variance is measured at **both** boundaries: supplier to loaded, and loaded to delivered. Supplier quantity is apportioned by the loading allocations. No recorded quantity is restated. |
| DR-02 | Temperature and density correction is an **optional feature**. Observed temperature, density at 15 °C, a method and a factor may be recorded; a corrected quantity is derived only when a factor is supplied. No method is applied by the system. |
| DR-03 | Tolerance classification is an **optional feature**. Rules may be percentage, absolute, or the greater of both, per product or organisation-wide. With no rule, items keep the user's status and no tolerance is recorded. |
| Conditions | Threshold values are supplied by the owner as configuration, not code. No historic quantity is corrected or restated. Trip closure rules (DR-14) remain open. |
| Recorded in | Migrations `20261115002900_tolerance_rules` and `20261115003000_measurement_chain`; `/workspace/reconciliation`; paper `decision-paper-dr-01-03-measurement-tolerances.md`. |

## 3. Remaining blockers

No Milestone 1 decision remains open. What remains is environmental and documentary:

1. Provision an empty non-production Supabase project (DR-25 greenfield) and confirm it is empty.
2. Apply `supabase/migrations-draft/0001_tenant_access_core.sql` there and run the RLS and cross-tenant tests.
3. Reconcile the Business Rules & Financial Logic Specification and Technical Blueprint when those documents are available; they are not required for the tenant/access schema but are required before operational modules.
4. Confirm v1.1 Parts 1 and 2 provenance against the owner-signed originals.

These are tracked in the Migration 1 checklist and the non-production Supabase plan.

### DR-26 — Platform Super Admin and tenant switching

| Field | Detail |
|---|---|
| Status | **Approved** — 2026-11-15 |
| Question | How should platform Super Admin identity, tenant switching, privilege scope, session lifetime and audit work, given D-003? |
| Decision | Separate `platform_admins` table keyed by `auth.users.id`, with no tenant membership. Server-side `platform_tenant_sessions` with a 30-minute expiry and a signed httpOnly cookie scoped to `/platform`. MFA AAL2 required by default. Read-only tenant access through a server-side service-role client explicitly scoped to the session tenant. Append-only `platform_audit_logs` for entry, exit, denial and expiry. Existing tenant RLS unchanged. |
| Why it matters | Super Admin can read every tenant. Modelled as ordinary membership it would silently weaken tenant isolation and D-001. |
| Options | (a) Table + server-side switch session (approved). (b) Supabase custom claims. (c) Environment allowlist. |
| Consequences | (a) strongest audit and revocation, but introduces a service-role code path. (b) fewer moving parts, but claims are harder to revoke and audit. (c) simplest, but not auditable per action. |
| Blocks | Any cross-tenant support capability and the platform admin UI. |
| Approved by | Product owner (Tunde Oladeji) |
| Approved on | 2026-11-15 |
| Basis | Owner approved all six DR-26 points in the project conversation. |
| Conditions | MFA required by default; read-only v1; 30-minute expiry; platform audit visible only to platform admins; service-role key server-only and never in the browser. Any write capability requires a new decision. |
| Detail | `docs/database/platform-admin-proposal.md`; migration `0004_platform_admin`; acceptance tests PA-001 to PA-012. |

## 4. Business decisions still open

These come from the v1.2 specification §8. None may be encoded in code or schema until approved.

| ID | Decision | Why it blocks |
|---|---|---|
| DR-01 | Petroleum measurement basis and quantity precision (**both boundaries approved 2026-11-16**) | Determines quantity columns, rounding and tolerances. |
| DR-02 | Temperature/density correction and approved method (**optional recording approved 2026-11-16**; method open) | Changes recorded volumes and conversion logic. |
| DR-03 | Shortage/excess tolerance thresholds (**optional rules approved 2026-11-16**; values open) | Determines when a variance becomes a discrepancy. |
| DR-04 | Reservation timing, expiry and release | Determines stock availability semantics. |
| DR-05 | Direct-fulfilment cost recognition | Determines revenue and cost postings. |
| DR-06 | Landed-cost adjustment treatment | Determines how consumed vs remaining inventory is costed. |
| DR-07 | Operational revenue recognition trigger | Determines when revenue is recognised. |
| DR-08 | Partial invoicing, cancellation and credit notes | Determines invoice eligibility and corrections. |
| DR-09 | Offline conflict resolution by transaction type | Determines sync authority and overrides. |
| DR-11 | Approval thresholds (monetary, margin, risk) | Determines approval routing. |
| DR-12 | Document limits, retention and versioning | Determines storage and evidence rules. |
| DR-13 | Transporter dispute and liability treatment (**core approved 2026-11-16**; charge categories and thresholds open) | Determines when a dispute becomes a liability. |
| DR-14 | Operational reconciliation tolerances | Determines trip closure rules. |

### 4.1 Decision papers prepared

Two papers turn the highest-value open decisions into answerable questions. Each lists options, consequences, data-model impact, sub-questions and a blank decision record. They are proposals, not approvals.

| Paper | Covers | Status |
|---|---|---|
| `docs/business-rules/decision-paper-dr-13-transporter-liability.md` | DR-13, with DR-11 (thresholds) | Awaiting owner |
| `docs/business-rules/decision-paper-dr-01-03-measurement-tolerances.md` | DR-01, DR-02, DR-03, with DR-14 | Awaiting owner |

## 5. Schema decisions still open

| ID | Decision | Status |
|---|---|---|
| DR-17 | Quantity model: current-value columns only, or columns plus immutable measurement events | Open |
| DR-18 | Delivery confirmation: fields and evidence, or a separate confirmation event table | Open |
| DR-19 | Discrepancy model: one typed model or procurement/delivery-specific tables | Open |
| DR-21 | Cost allocation target FK model | Open |
| DR-22 | Transporter invoice header `trip_id` compatibility and authority | Open |
| DR-23 | Payment event model across `financial_transactions`, `payment_records`, `payment_channels`, reversals | Open |

## 6. Record template

Copy this block for each new decision:

```
### DR-XX — Title

| Field | Detail |
|---|---|
| Status | Open |
| Question | |
| Why it matters | |
| Options | |
| Consequences | |
| Blocks | |
| Recommendation | |
| Approved by | |
| Approved on | |
| Conditions | |
```
