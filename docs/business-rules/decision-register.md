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

## 3. Records still blocking Milestone 1

### DR-20 — Approval model

| Field | Detail |
|---|---|
| Status | Open |
| Question | How do `approval_rules`, `approval_requests` (ERD) and `approval_records` (v1.1) relate? Is approval needed in Milestone 1 at all? |
| Why it matters | Approval history is part of access administration and later financial controls. Retrofitting an approval model after postings exist is expensive. |
| Options | (a) Single `approval_records` table for Milestone 1, expand later. (b) Full rule/request/decision split now. (c) Defer approvals entirely to the finance milestone. |
| Consequences | (a) simple, but may need migration later. (b) more work now, future-proof. (c) least work now, highest rework risk. |
| Blocks | Migration 1 only if tenant/role administration requires approval. |

### DR-24 — Tenant and location ownership coverage

| Field | Detail |
|---|---|
| Status | Open |
| Question | Which tables carry `organisation_id` directly, which inherit ownership through a parent, and which are platform-global? What is the exact RLS predicate model? |
| Why it matters | RLS correctness depends on every tenant-owned row being resolvable to one organisation. A missed table is a cross-tenant leak. |
| Options | (a) Direct `organisation_id` on every tenant table. (b) Direct on aggregate roots, inherited through enforced parents. (c) Hybrid, documented table by table. |
| Consequences | (a) simplest policies, more columns and joins. (b) fewer columns, policies depend on joins being correct. (c) flexible but easiest to get wrong. |
| Blocks | All RLS policies. |
| Note | D-005 fixes the platform-global exception list conceptually, not the table list. |

### DR-10 — Location model and hierarchy

| Field | Detail |
|---|---|
| Status | Open |
| Question | What location types exist (depot, office, customer site, supplier depot), how are they owned, and does access inherit through a hierarchy? |
| Why it matters | D-004 settles *how* access is granted, not *what* a location is. RLS scope and dispatch workflows both depend on it. |
| Options | (a) Flat tenant-owned `business_locations` with a type. (b) Hierarchical locations with inherited access. (c) Separate tables per location kind. |
| Consequences | (a) simplest, no inheritance. (b) powerful, harder policies. (c) clearest semantics, more joins and duplication. |
| Blocks | Migration 1 location grants and policies. |

## 4. Business decisions still open

These come from the v1.2 specification §8. None may be encoded in code or schema until approved.

| ID | Decision | Why it blocks |
|---|---|---|
| DR-01 | Petroleum measurement basis and quantity precision | Determines quantity columns, rounding and tolerances. |
| DR-02 | Temperature/density correction and approved method | Changes recorded volumes and conversion logic. |
| DR-03 | Shortage/excess tolerance thresholds | Determines when a variance becomes a discrepancy. |
| DR-04 | Reservation timing, expiry and release | Determines stock availability semantics. |
| DR-05 | Direct-fulfilment cost recognition | Determines revenue and cost postings. |
| DR-06 | Landed-cost adjustment treatment | Determines how consumed vs remaining inventory is costed. |
| DR-07 | Operational revenue recognition trigger | Determines when revenue is recognised. |
| DR-08 | Partial invoicing, cancellation and credit notes | Determines invoice eligibility and corrections. |
| DR-09 | Offline conflict resolution by transaction type | Determines sync authority and overrides. |
| DR-11 | Approval thresholds (monetary, margin, risk) | Determines approval routing. |
| DR-12 | Document limits, retention and versioning | Determines storage and evidence rules. |
| DR-13 | Transporter dispute and liability treatment | Determines when a dispute becomes a liability. |
| DR-14 | Operational reconciliation tolerances | Determines trip closure rules. |

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
