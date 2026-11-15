# PetroCore Supply — Consolidated Field-Level Database Dictionary v1.2 (Proposal)

**PROPOSAL — NOT APPROVED FOR SQL**

**Document status:** Product-owner review draft  
**Version:** 1.2 proposal  
**Prepared:** 2026-11-15  
**Repository branch:** `docs/database-v1.2-review-proposal`  
**Baseline:** Detailed Database Dictionary v1.1 — Revised Review Draft  
**Amendment source:** Consolidated Database Dictionary v1.2 — Implementation Specification  
**Related controls:** Database v1.2 Reconciliation Report; Decision Register; Migration 1 Tenant & Access Checklist  
**Product:** PetroCore Supply  
**Tenant example:** Deuces is a tenant/customer organisation, not the product name.

## Document control

| Field | Value |
|---|---|
| Document | Consolidated Field-Level Database Dictionary v1.2 (Proposal) |
| Version | 1.2 proposal — review revision 5 (all Milestone 1 decisions approved) |
| Status | Owner-approved design baseline. Physical model approved 2026-11-15. Draft SQL exists in `supabase/migrations-draft/` but has **not** been applied or executed. |
| Owner | Product owner (Tunde Oladeji) |
| Prepared | 2026-11-15 |
| Repository branch | `docs/database-v1.2-review-proposal` |
| Relationship to other documents | Consolidates the v1.1 baseline in Appendix A with the v1.2 amendment specification. Does not replace the ERD, Technical Blueprint, PRD or Business Rules & Financial Logic Specification. |
| Change record | See §8 Amendment log. |

| Approval step | Approved by | Date | Version approved |
|---|---|---|---|
| v1.1 baseline provenance confirmed | Product owner | 2026-11-15 | v1.2 proposal rev 2 |
| Field-level v1.2 amendments | Product owner | 2026-11-15 | v1.2 proposal rev 2 |
| ERD comparison completed | Product owner | 2026-11-15 | Reconstructed ERD rev 2 — original artefact unavailable; re-verify if produced |
| Authorised for migration drafting | Product owner | 2026-11-15 | DR-10, DR-20 and DR-24 approved; conditional on execution and RLS test sign-off |

**Approval basis:** the product owner approved this review pack in the project conversation on 2026-11-15. Because the original ERD artefact was not available, ERD approval applies to the reconstructed proposal and must be re-verified if the original is produced. Approval authorises drafting Migration 1 against this dictionary; it does not approve physical types, constraints, policies or SQL, and it does not close DR-10, DR-20 or DR-24.

## 0. Read this before using the document

This is a **consolidated review proposal**, not an approved physical schema and not permission to create SQL or migrations.

The detailed v1.1 field-level dictionary supplied to the project is reproduced below as the baseline. Its field definitions are retained without alteration; only heading levels and transport formatting were normalised in this presentation.

**Provenance must be confirmed.** The version, date and completeness of the v1.1 baseline have not been verified against an owner-signed original.

**Part 2 supplied and included.** Appendix A now reproduces v1.1 Parts 1 and 2 (sections 1–25): incidents and compliance, finance and payments, documents, reporting, imports, notifications, document numbering, offline synchronisation, audit and idempotency, plus the deferred accounting, constraints, integrity rules and implementation phases. The earlier completeness gap is resolved. Part 2 provenance is the text supplied on 2026-11-15 and must be confirmed against the authoritative original in the same way as Part 1.

If the baseline does not match the authoritative Detailed Database Dictionary v1.1, the appendix must be replaced rather than amended, and any already-approved v1.2 amendment re-checked against the corrected baseline.

The original ERD v1.2 source artefact was **not located in the current repository or the accessible Library material during this preparation**. The companion ERD file is therefore a reconstructed logical proposal based on the v1.1 dictionary, the repository reconciliation report and the v1.2 amendment specification. It must be compared against the original owner-supplied ERD before final approval.

### Decision status

- D-001 to D-005 are recorded as approved logical decisions in the reconciliation report and decision register.
- DR-16 (naming), DR-25 (greenfield), DR-10 (flat locations), DR-20 (approvals deferred) and DR-24 (direct ownership) are **Approved** as of 2026-11-15; see the Decision Register.
- Field-level amendments remain review items until the physical proposal and Migration 1 draft are signed off.
- No SQL, migration, seed data, RLS policy or database change has been applied. The draft SQL lives in `supabase/migrations-draft/` and is not executable by tooling.

### How to interpret the combined dictionary

1. The complete v1.1 dictionary below remains the field-level baseline.
2. The v1.2 proposal sections after the baseline describe additive changes, candidate structures and decisions requiring confirmation.
3. Unless a v1.2 amendment is explicitly approved, retain the v1.1 definition and do not implement an alias as a second table.
4. Do not treat this document as a substitute for the original ERD, Technical Blueprint, PRD or Business Rules & Financial Logic Specification.
5. If a proposed amendment conflicts with a v1.1 definition, record the conflict and obtain owner approval; do not resolve it by assumption.

---

## 1. Approved logical boundaries to carry into v1.2

These are logical decisions already recorded as approved; they do not approve exact SQL details.

| Decision | Approved logical rule | Still requires field-level approval |
|---|---|---|
| D-001 — Tenant identity and switching | An ordinary user belongs to one tenant only. Ordinary users cannot switch tenants. Super Admin tenant switching is a separate privileged, audited path. | Exact profile-to-tenant membership implementation, platform admin authority model, session/MFA controls and audit fields. |
| D-002 — Tenant master | `organisations` is the authoritative tenant identity. `business_settings` is tenant configuration, not a competing tenant master. | Exact organisation fields, business_settings key, one-to-one constraint and migration treatment. |
| D-003 — Platform Super Admin | Platform-level identity is separate from ordinary tenant membership. | Exact platform identity/role storage and privileged-session design. |
| D-004 — Location access | Ordinary users may receive explicit access to multiple locations within their one tenant. Tenant-wide visibility is a separate explicit permission. | Exact permission key, location type model, direct ownership columns and RLS predicate. |
| D-005 — Global reference data | Stable standard reference catalogs are platform-owned; operational/commercial data remains tenant-owned. | Exact global catalog list, custom-value design, versioning and per-table ownership mapping. |

## 2. Canonical naming reconciliation — DR-16 approved: retain v1.1 names

**Decision (2026-11-15):** retain the v1.1 names as canonical. ERD alternative names are documentation aliases only and must never become a second table.

These are now the approved canonical names. The table records the alias mapping so ERD readers can translate terms without creating duplicate entities.

| Concept | v1.1 baseline name | ERD / alternative name | Proposal treatment |
|---|---|---|---|
| Supplier purchasing commitment | `purchase_orders` | `procurement_orders` | Canonical. Do not create a second order master. |
| Tenant operating/storage location | `business_locations` | `locations` | Canonical. Supplier depots and customer locations remain distinct entities. |
| Sales credit note | `sales_credit_notes` / `sales_credit_note_items` | `credit_notes` | Canonical. |
| Payment record | `payment_records` | `payments` | Canonical. |
| Delivery record | `trip_delivery_records` | `deliveries` | Canonical. |
| Tenant identity/settings | `business_settings` | `organisations` | Approved logical separation: `organisations` is tenant master; `business_settings` remains settings. |

**Do not create both names for one business concept.** A future rename would require a new decision, an old-name mapping and an approved migration plan covering FKs, indexes, policies and code references.

## 3. Proposed additive field-level changes

### 3.1 `organisations` — new authoritative tenant master

**Status:** Logical table approved by D-002; exact fields and constraints are **Proposed / owner review**.

| Field candidate | Candidate type | Candidate requirement | Purpose / open point |
|---|---|---|---|
| `id` | UUID | Required; PK candidate | Stable tenant identity. Confirm key convention against the platform baseline. |
| `organisation_code` | VARCHAR(40) | Required; unique within platform candidate | Human-readable tenant reference. Confirm code generation and immutability. |
| `legal_name` | VARCHAR(250) | Required candidate | Registered legal name. Confirm if this is mandatory at tenant creation. |
| `display_name` | VARCHAR(200) | Required candidate | Name displayed in the product. |
| `status` | VARCHAR(20) | Required candidate | Tenant lifecycle state; exact allowed states and transitions require approval. |
| `created_at` | TIMESTAMPTZ | Required candidate | Creation timestamp. |
| `updated_at` | TIMESTAMPTZ | Required candidate | Last update timestamp. |

**Not yet defined:** registered address/contact, tax identifiers, subscription/plan, tenant activation/suspension rules, deletion/retention, tenant code format and whether a tenant may have multiple legal entities. Do not add these by assumption.

### 3.2 `business_settings` — existing v1.1 settings record

The complete v1.1 field list is retained in the baseline section below.

**Proposed amendment:** add `organisation_id UUID` as the tenant owner reference, with a unique constraint candidate to enforce one settings record per organisation.

- **Status:** Approved amendment under DR-24 (direct ownership); field-level definition is implemented in the Migration 1 draft.
- The existing `id` must not be assumed to equal `organisations.id` without inspection and explicit approval.
- Confirm whether the relationship is one-to-one and whether the FK should be the primary key or a separate unique column.
- Keep business configuration fields (currency, timezone, costing preferences, offline setting) on `business_settings`; do not use them as tenant identity.

### 3.3 `business_locations` — existing v1.1 location entity

The complete v1.1 field list is retained in the baseline section below.

**Approved amendment (DR-24):** add `organisation_id UUID` as a direct tenant owner reference.

The location model is DR-10, approved as flat: `business_locations` remains the single tenant-owned location entity with `location_type` and `is_storage_location`. Do not add parent-location or inherited-access columns.

Supplier depots (`supplier_depots`) and customer delivery locations (`customer_locations`) remain separate entities. They must not be merged into tenant-owned `business_locations` merely because they are physical places.

### 3.4 User identity, tenant membership and platform authority

The v1.1 `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles` and `user_location_access` field definitions are retained.

**Proposed membership relationship (not yet an approved table):**

| Candidate entity | Candidate fields | Status / unresolved |
|---|---|---|
| `organisation_memberships` | `id UUID`, `organisation_id UUID`, `profile_id UUID`, `status VARCHAR(20)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | Proposed only. Confirm whether a distinct membership table is needed or whether `profiles` carries the tenant FK. D-001 requires one tenant per ordinary user; exact implementation remains open. |
| Platform Super Admin authority | No table or fields proposed here | D-003 requires a separate platform-level authority path. Do not model Super Admin as an ordinary member of every tenant. Exact identity/role/session design remains open for security review. |

**Required invariants, regardless of final physical model:**
- Authentication credentials remain in Supabase Auth.
- An ordinary profile resolves to no more than one active tenant.
- Client-supplied tenant IDs never override authenticated server-side membership.
- A location grant must resolve to a location belonging to the same tenant as the user.
- Tenant-wide access requires a distinct explicit permission.
- Platform Super Admin access is separately authorised, time-bounded where appropriate, and audited.

### 3.5 Procurement traceability — existing `procurement_batches`

Add or verify the following v1.2 field candidates:

| Field | Type | Required | Purpose | Status |
|---|---|---|---|---|
| `sales_order_item_id` | UUID | No | Identifies the customer order line served by this procurement batch. | Amendment candidate; confirm FK and when mandatory. |
| `procurement_order_item_id` | UUID | No | Proposed explicit reference to purchase-order line if the existing `purchase_order_item_id` does not already serve this purpose. | Do **not** add if it duplicates `purchase_order_item_id`. DR-16 is approved: the v1.1 field remains the only reference. |

Retain `purchase_order_item_id` and `sales_order_id` from v1.1 unless a controlled, approved rename/mapping is adopted.

Preserve three distinct measures: supplier quantity, loaded quantity and received/customer-confirmed quantity. Do not collapse them or overwrite earlier evidence.

### 3.6 `trip_loading_procurement_allocations` — new typed direct-loading table

**Status:** Required by the v1.2 amendment specification; DR-24 ownership is resolved (direct `organisation_id`), field-level definition is in the Migration 1 draft.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `trip_loading_record_id` | UUID | Yes | FK to `trip_loading_records` |
| `procurement_batch_id` | UUID | Yes | FK to `procurement_batches` |
| `sales_order_item_id` | UUID | Yes | FK to `sales_order_items` |
| `product_id` | UUID | Yes | FK to `products` |
| `allocated_quantity` | NUMERIC(18,3) | Yes | Quantity loaded from direct procurement |
| `created_at` | TIMESTAMPTZ | Yes | Creation timestamp |
| `created_by` | UUID | Yes | User responsible |

Rules retained from v1.2:
- This records direct procurement loading without a warehouse inventory movement.
- It must not compete with `trip_loading_batch_allocations` as a second source of truth.
- Direct and warehouse source paths remain mutually exclusive.
- Do not drop or repurpose the existing allocation table in place. Classify, migrate, reconcile and sign off before deprecation.

### 3.7 `direct_fulfilment_cost_allocations` — new typed cost-allocation table

**Status:** Required by the v1.2 amendment specification; exact source FK exclusivity, ownership and accounting treatment remain open.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `procurement_batch_id` | UUID | Yes | FK to `procurement_batches` |
| `sales_order_item_id` | UUID | Yes | FK to `sales_order_items` |
| `cost_component_id` | UUID | No | FK to `procurement_cost_components`, where applicable |
| `expense_record_id` | UUID | No | FK to `expense_records`, where applicable |
| `cost_category_id` | UUID | No | FK to `cost_categories`, where applicable |
| `allocated_amount` | NUMERIC(18,2) | Yes | Allocated cost |
| `allocation_method` | VARCHAR(40) | Yes | Approved allocation method |
| `allocation_basis` | JSONB | No | Calculation evidence |
| `allocation_version` | INTEGER | Yes | Allocation version |
| `created_at` | TIMESTAMPTZ | Yes | Creation timestamp |
| `created_by` | UUID | Yes | User |

**Open validation:** three source references are optional — `cost_component_id`, `expense_record_id` and `cost_category_id`. Whether exactly one source is required, which combinations are permitted, whether `cost_category_id` is always required as a classification, what allocation methods are allowed, how versions supersede earlier allocations, and how the cost is recognised remain undecided under DR-05, DR-06 and DR-21. Do not implement an XOR constraint, a polymorphic target or a default source rule until that decision is recorded. If a rule is later approved, it must be enforced by constraint or trusted service, not only by the UI.

### 3.8 `transporter_invoice_items` — new multi-trip invoice detail

**Status:** Required by the v1.2 amendment specification; exact header compatibility is DR-22 (Open).

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `transporter_invoice_id` | UUID | Yes | FK to `transporter_invoices` |
| `trip_id` | UUID | Yes | FK to `trips` |
| `description` | TEXT | No | Invoice line description |
| `quantity` | NUMERIC(18,3) | No | Charge quantity, where applicable |
| `rate` | NUMERIC(18,4) | No | Agreed rate, where applicable |
| `amount` | NUMERIC(18,2) | Yes | Line amount |
| `created_at` | TIMESTAMPTZ | Yes | Creation timestamp |

A transporter invoice may cover multiple trips. Invoice item totals must reconcile to the header total, with any separately approved adjustments identified. The existing header `trip_id` must not become a competing source of truth. Do not remove it until DR-22 and a migration map are approved.

### 3.9 Approval structures — DR-20 approved: deferred to the finance milestone

The v1.1 dictionary contains `approval_records`; the ERD/reconciliation material refers to `approval_rules` and `approval_requests`.

No physical definitions are created for `approval_rules` or `approval_requests` in Migration 1 because DR-20 is approved as deferred: approvals are designed with the finance phase, before any posting that requires them. `audit_logs` records access administration in the meantime.

Do not create both models in parallel. Preserve existing approval history if a future migration is approved. Define separation of duties, approver eligibility, delegation, escalation, rejection, resubmission and audit history before implementation.

### 3.10 Quantity measurement events — DR-17 remains Open

The existing v1.1 `procurement_batches` quantities remain the current baseline. The ERD concept `procurement_quantity_records` is not automatically added as a physical table.

Owner must decide whether:
- current-value columns alone are sufficient; or
- the columns remain the controlling current values and an immutable event table stores repeated readings, corrections, evidence and measurement method.

If an event table is approved, define measurement type, measured value, unit, measurement time, source/equipment, recorded-by, evidence reference, correction/supersession and approval status. These are candidate attributes only, not an approved schema.

### 3.11 Delivery confirmation and discrepancies — DR-18 / DR-19 remain Open

Retain v1.1 `trip_delivery_records`, `delivery_evidence`, `trip_reconciliations`, `trip_reconciliation_items`, `delivery_discrepancies` and `discrepancy_investigations`.

Do not add an alternative `deliveries` master table or a second discrepancy master until naming and model decisions are approved.

Open choices:
- confirmation fields and evidence on the existing delivery row versus a separate immutable confirmation event;
- shared typed discrepancy model versus procurement- and delivery-specific discrepancy tables;
- which measurements are authoritative and when a discrepancy is considered resolved;
- evidence requirements, customer acknowledgement authority and correction history.

A quantity variance is not automatically a loss, driver debt, transporter debt or employee deduction.

### 3.12 Payment model — DR-23 remains Open

Retain the v1.1 typed allocation tables:
- `invoice_payment_allocations`
- `supplier_payment_allocations`
- `transporter_payment_allocations`

Retain `payment_records`, `payment_reversals`, `accounts_receivable` and `accounts_payable` as defined in v1.1, subject to reconciliation.

Do not introduce a second `payments` table or a generic polymorphic allocation table. The exact relationship among `financial_transactions`, `payment_records`, `payment_channels`, settlement, reversals and the three typed allocations remains open under DR-23.

Balances remain derived or controlled projections reconciled to authoritative invoices, credit notes, allocations, adjustments and reversals. They must not be freely editable.

## 4. Tenant ownership and RLS classification register — DR-24 approved: direct ownership

D-002 establishes `organisations` as the tenant root and D-005 establishes platform-global reference data. DR-24 (approved 2026-11-15) fixes the ownership model: every tenant-owned table carries `organisation_id` directly, junctions use composite tenant keys, and only explicitly approved reference catalogs are platform-global.

The inventory below is extracted from the v1.1 Part 1 table headings and classifies each as direct tenant-owned under DR-24. Part 2 tables are listed separately as pending classification for their own migrations.

| Existing v1.1 table | Current classification |
|---|---|
| `business_settings` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `business_locations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `profiles` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `roles` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `permissions` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `role_permissions` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `user_roles` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `user_location_access` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `approval_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `suppliers` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `supplier_depots` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `supplier_depot_bays` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `products` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `supplier_products` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `purchase_orders` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `purchase_order_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `procurement_batches` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `cost_categories` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `procurement_cost_components` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `cost_allocations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `procurement_cost_adjustments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_cost_adjustments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_batches` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_reservations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_reservation_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_issues` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_movements` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `fifo_allocations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `inventory_adjustments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `stock_transfers` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `stock_transfer_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `customers` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `customer_locations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `product_selling_prices` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `customer_product_prices` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `pricing_rules` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_orders` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_order_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `pricing_approvals` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_invoices` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_invoice_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_credit_notes` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_credit_note_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `customer_credit_reviews` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `sales_profitability_snapshots` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_profitability_snapshots` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `profitability_snapshot_allocations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `transporters` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `transporter_contracts` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `transporter_rate_cards` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `transporter_invoices` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `employees` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `drivers` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_documents` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_compensation_profiles` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_compensation_history` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_salary_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_trip_allowances` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_advances` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `driver_expense_retirements` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trucks` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_ownership_history` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_compartments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `compartment_calibrations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `compartment_seals` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_documents` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_assignments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_maintenance_history` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_fuel_logs` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_odometer_logs` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_tyre_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `truck_parts_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trips` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_assignments` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_sales_orders` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_sales_order_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_loading_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_loading_batch_allocations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_delivery_records` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `delivery_evidence` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_expenses` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_reconciliations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `trip_reconciliation_items` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `delivery_discrepancies` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |
| `discrepancy_investigations` | Existing v1.1 entity | **Direct** — organisation_id on the table (DR-24 approved). |

**Part 2 tables.** DR-24 applies to Part 2 as well: every tenant-owned Part 2 table will carry `organisation_id` directly, and platform-global reference catalogs will be classified explicitly. The following are not yet implemented in a migration: `incidents`, `incident_participants`, `incident_evidence`, `incident_investigations`, `incident_actions`, `insurance_policies`, `insurance_claims`, `compliance_requirements`, `compliance_records`, `product_quality_checks`, `financial_transactions`, `payment_records`, `payment_channels`, `invoice_payment_allocations`, `supplier_payment_allocations`, `transporter_payment_allocations`, `payment_reversals`, `accounts_receivable`, `accounts_payable`, `expense_records`, `documents`, `document_links`, `document_requirements`, `report_definitions`, `saved_report_views`, `report_schedules`, `data_import_jobs`, `data_import_errors`, `notifications`, `notification_preferences`, `notification_delivery_logs`, `document_number_sequences`, `offline_devices`, `offline_sync_sessions`, `offline_operation_log`, `offline_sync_conflicts`, `audit_logs`, `idempotency_records`, `chart_of_accounts`, `accounting_periods`, `journal_entries`, `journal_entry_lines`.

`audit_logs` is classified as **direct tenant-owned** and is included in the Migration 1a draft. The deferred accounting tables are out of scope for the initial release.

Under the approved DR-24 model, each new table must satisfy:
1. direct `organisation_id` ownership;
2. composite foreign keys to every tenant parent, so cross-tenant references cannot be stored;
3. an explicit platform-global classification for any table without `organisation_id`;
4. RLS enabled with deny-by-default predicates and a trusted server-side access path;
5. location scope stated, and enforced where the row is location-bound.

**Security baseline:** deny by default; no client-supplied tenant ID is authoritative; every tenant-owned row resolves to exactly one organisation; cross-tenant FKs are blocked; location grants are validated within the user's tenant; platform administrators use a separate audited privileged path.

## 5. Data integrity and relationship rules carried forward

The following invariants are preserved from the v1.1 and v1.2 specifications:
- A purchase order does not create inventory.
- Direct fulfilment does not create artificial warehouse receipts or inventory issues.
- Only verified receipt into tenant-controlled storage creates an inventory batch.
- Reservations do not reduce physical stock; posted issues do.
- FIFO allocations identify actual consumed inventory batches and posted issue movements.
- Supplier, loaded and received/customer-confirmed quantities remain distinct.
- A sales order item may be fulfilled over multiple trips; a trip may carry multiple orders.
- Loading allocations reconcile to physical loading records and compartment capacity.
- Dispatch selects transporters manually; no automatic transporter assignment.
- Third-party transporter drivers do not automatically become tenant employees or payroll recipients.
- Customer, supplier and transporter payment allocations remain typed and separate.
- Allocations cannot exceed verified/settled funds or eligible outstanding liabilities.
- Reversals preserve original payments and cannot exceed the unreversed amount.
- Receivable/payable balances reconcile to source transactions and are not freely editable.
- Inbound procurement haulage and outbound customer delivery haulage remain distinct cost categories.
- The same expense is not independently counted in `expense_records` and `trip_expenses`.
- Profitability snapshots preserve estimate/actual distinction, version and calculation basis.
- Posted financial, inventory, delivery, approval and audit history is not silently overwritten or ordinarily deleted.
- Offline operations remain provisional until server validation; idempotency prevents duplicate posting.

## 6. Open decision gate — no implied approvals

The current Decision Register is authoritative for status. The following remain Open:
- DR-01 measurement basis and quantity precision.
- DR-02 temperature/density correction method.
- DR-03 shortage/excess tolerances.
- DR-04 reservation timing, expiry and release.
- DR-05 direct-fulfilment cost recognition.
- DR-06 landed-cost adjustment treatment.
- DR-07 revenue recognition trigger.
- DR-08 partial invoicing, cancellation and credit notes.
- DR-09 offline conflict resolution.
- DR-11 approval thresholds.
- DR-12 document limits, retention and versioning.
- DR-13 transporter disputes and liability.
- DR-14 operational reconciliation tolerances.
- DR-17 quantity model and measurement event history.
- DR-18 delivery confirmation model.
- DR-19 discrepancy model.
- DR-21 cost-allocation target FK model.
- DR-22 transporter invoice header `trip_id` authority/compatibility.
- DR-23 payment event model.

**Approved and therefore not listed above:** D-001 to D-005, DR-16 (retain v1.1 names), DR-25 (greenfield), DR-10 (flat locations), DR-20 (approvals deferred) and DR-24 (direct ownership). No Milestone 1 decision remains open.

## 7. Required approval and implementation sequence

1. ~~Resolve DR-25 (greenfield) and DR-16 (canonical names).~~ **Approved 2026-11-15.**
2. ~~Resolve DR-10 (flat locations) and DR-24 (direct ownership).~~ **Approved 2026-11-15.**
3. ~~Resolve DR-20.~~ **Approved 2026-11-15: deferred to the finance milestone.**
4. Complete and approve every remaining field-level amendment and relationship/cardinality.
5. Re-verify this reconstructed ERD against the original ERD v1.2 if that artefact becomes available.
6. Reconcile the final dictionary and ERD against the Technical Blueprint, PRD and Business Rules & Financial Logic Specification.
7. Confirm the target Supabase project is **empty** (DR-25 greenfield) and review its configuration, roles and extensions.
8. Provision the empty project and take a baseline backup before the first migration; no legacy backup is required.
9. Only then prepare migrations and security/acceptance tests.

**Until DR-10, DR-24 and DR-20 are resolved, do not generate tenant/access SQL, migrations, seeds, triggers or RLS policies.**

## 8. Amendment log

| Revision | Date | Change | Author |
|---|---|---|---|
| 1 | 2026-11-15 | Initial consolidated proposal: v1.1 baseline plus v1.2 amendments, decision markers and ownership inventory. | Repository review |
| 2 | 2026-11-15 | Added document control and approval block; made v1.1 provenance and verification requirements explicit; clarified that all three direct-fulfilment cost sources remain undecided; corrected §3.9 formatting; normalised appendix heading levels and removed pasted transport brackets; added this log. | Repository review |
| 3 | 2026-11-15 | Recorded product-owner approval of the review baseline, v1.1 provenance, DR-16 (retain v1.1 names) and DR-25 (greenfield); updated the naming section, open-decision gate and implementation sequence to reflect the approvals; kept DR-10, DR-20 and DR-24 open. | Repository review |
| 4 | 2026-11-15 | Appended the supplied v1.1 Part 2 (sections 12–25) to Appendix A: incidents and compliance, finance and payments, documents, reporting, imports, notifications, numbering, offline sync, audit, idempotency, deferred accounting, constraints and implementation phases. Resolved the earlier Part 2 completeness gap. | Repository review |
| 5 | 2026-11-15 | Recorded approval of DR-10 (flat locations), DR-20 (approvals deferred) and DR-24 (direct ownership) and the five permission keys; updated decision status, ownership register and implementation sequence. | Repository review |
| 6 | 2026-11-15 | Recorded the implemented inventory fulfilment additions: `inventory_issue_lines` (issue intent per sales order line, with product derived from the order line) and the composite tenant key on `inventory_movements` required by FIFO allocation references. Both are physical additions to the proposed schema; the field-level definitions in §6.4 and §6.6 remain unchanged. | Repository review |

---

# Appendix A — Detailed Database Dictionary v1.1, Parts 1–2 (sections 1–25), retained verbatim

**Provenance:** supplied to the project as the Detailed Database Dictionary v1.1 (Revised Review Draft), **Parts 1 and 2**. Field definitions are reproduced without alteration; heading levels and transport formatting are normalised, the pasted transport brackets are removed, and the two separate title lines are combined into one heading.

**Reading note:** the v1.1 text was written for a single-business deployment, so it refers to "Deuces" and "the business" in the singular. Under D-001 and D-002 every such record is tenant-scoped: read "the business" as "the tenant" and "Deuces" as the example tenant. This note is editorial and does not change any v1.1 field definition.

**Verification required:** confirm this appendix against the authoritative v1.1 document before approval. The presence of a field here does not approve it for the v1.2 physical schema.

## Deuces Supply, Haulage & Delivery Management System — Detailed Database Dictionary v1.1

Retained from the supplied v1.1 document. The definitions below are the baseline; apply only the explicit, approved v1.2 amendments above.

**Document status:** Technical Design – Revised Review Draft  
**Version:** 1.1  
**Supersedes:** Detailed Database Dictionary v1.0  
**Database:** PostgreSQL  
**Database platform:** Supabase  
**Architecture:** Modular Monolith  
**Inventory costing:** FIFO  
**Initial currency:** NGN  
**Accounting scope:** Operational finance and profitability; double-entry accounting deferred  
**Inventory model:** Direct-to-customer fulfilment and future storage support  
**Offline capability:** Full offline capability across operational modules, subject to synchronisation and server-side validation

---

### 1. Purpose and scope

This document defines the revised proposed database structure for the Deuces Supply, Haulage & Delivery Management System.

It expands the approved Entity Relationship Diagram and incorporates the decisions recorded in the Business Rules & Financial Logic Specification v1.0.

It is intended to guide:
- Database implementation and SQL migrations.
- Application development.
- Financial and inventory transaction processing.
- Operational workflows.
- Reporting and profitability calculations.
- Security, permissions and auditability.
- Testing and future system expansion.

This is a technical design specification, not executable SQL. Database migrations must not be generated until the remaining critical business rules have been confirmed and the related project documents have passed a consistency review.

#### 1.1 Key v1.1 improvements

The following improvements distinguish this revision from v1.0:

1. Separates supplier depots from Deuces business and storage locations.
2. Records supplier quantity, loading quantity and received quantity independently.
3. Supports direct-to-customer fulfilment without creating artificial warehouse stock.
4. Separates inventory reservations from actual inventory issues.
5. Connects FIFO allocations to actual posted inventory issues.
6. Supports subsequent landed-cost adjustments and their financial impact.
7. Introduces transporter contracts, rate cards and transporter invoices.
8. Supports multiple orders on one trip and multiple trips for one order at order-line level.
9. Supports compartment loading from multiple inventory batches.
10. Introduces detailed trip reconciliation records.
11. Replaces the original generic payment-allocation approach with target-specific allocation tables.
12. Supports payment reversals without overwriting original payment records.
13. Separates estimated profitability from actual profitability and preserves calculation versions.
14. Clarifies third-party driver compensation to prevent automatic salary or allowance obligations where the transporter supplies the driver.
15. Adds multiple business locations, configurable access and company-wide reporting.
16. Adds document management, reporting, notifications, imports, offline synchronisation and document numbering structures.
17. Strengthens transaction integrity, concurrency protection, idempotency and audit controls.

---

### 2. Database standards

#### 2.1 Data types

| Data type | Usage |
|---|---|
| UUID | Primary and foreign keys |
| VARCHAR | Names, codes and short text |
| TEXT | Descriptions and longer notes |
| NUMERIC(18,2) | Monetary amounts |
| NUMERIC(18,4) | Unit prices and rates |
| NUMERIC(18,3) | Petroleum quantities |
| NUMERIC(9,4) | Percentages |
| DATE | Business dates |
| TIMESTAMPTZ | Date and time |
| BOOLEAN | True/false values |
| JSONB | Structured metadata where justified |
| INET | IP addresses |
| BIGINT | Sequence counters and suitable technical identifiers |

All monetary and quantity calculations must use exact numeric arithmetic. Floating-point types must not be used for money, petroleum quantities or financial calculations.

Quantity precision remains subject to final confirmation of the applicable petroleum measurement and operational standards.

#### 2.2 Standard database conventions

- Every primary key uses UUID.
- Business records use unique human-readable references where appropriate.
- `created_at` and `updated_at` are maintained automatically where applicable.
- `created_by` and `updated_by` reference authenticated application profiles where applicable.
- Posted financial and inventory records are protected against ordinary updates and deletions.
- Foreign keys enforce valid relationships.
- Database constraints prevent invalid quantities, amounts and statuses.
- Database migrations manage schema changes.
- Important business operations use database transactions.
- Financial posting operations must be idempotent.
- Historical records must remain traceable after master records are deactivated.
- Time values are stored consistently using `TIMESTAMPTZ`; the configured business timezone is used for display and business-date interpretation.

#### 2.3 Business entity and location model

The initial implementation supports one Deuces business entity with multiple operating locations.

The design should avoid unnecessary multi-company complexity at launch, but should not prevent a future controlled expansion.

`business_settings` represents the initial company configuration.

`business_locations` represents Deuces operating locations, offices and future storage locations.

Supplier-owned depots are represented separately by `supplier_depots`. A supplier depot must not automatically be treated as a Deuces-owned inventory location.

#### 2.4 Status conventions

Statuses must be controlled using PostgreSQL enums or validated reference values.

Unrestricted status text is not acceptable for important business workflows.

A status transition must be validated by the application service and, where appropriate, by database constraints or triggers.

#### 2.5 Deletion and historical preservation

- Financial and inventory records must not be physically deleted through ordinary application operations.
- Posted records must be corrected using reversal or adjustment transactions.
- Master records should normally be deactivated rather than deleted.
- Foreign keys for important historical records should use `RESTRICT`.
- `CASCADE` is appropriate only for safe dependent draft records or non-financial junction records.
- Audit logs must remain append-only.

---

### 3. Organisation, locations and user management

#### 3.1 business_settings

Stores the primary business configuration.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| business_name | VARCHAR(200) | Yes | Business name |
| registered_name | VARCHAR(250) | No | Registered legal name |
| business_address | TEXT | No | Business address |
| phone | VARCHAR(30) | No | Business phone |
| email | VARCHAR(150) | No | Business email |
| default_currency | VARCHAR(3) | Yes | NGN initially |
| timezone | VARCHAR(60) | Yes | Configured business timezone |
| financial_year_start | DATE | No | Financial year start |
| default_costing_method | VARCHAR(20) | Yes | FIFO initially |
| offline_enabled | BOOLEAN | Yes | Whether offline capability is enabled |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Constraint: initial currency must be NGN. Multi-currency transactions are outside the initial release.

#### 3.2 business_locations

Represents Deuces operating locations and future storage facilities.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| location_code | VARCHAR(40) | Yes | Unique location code |
| location_name | VARCHAR(150) | Yes | Location name |
| location_type | VARCHAR(40) | Yes | Office, operating location, storage or other configured type |
| address | TEXT | No | Physical address |
| contact_person | VARCHAR(150) | No | Contact person |
| phone | VARCHAR(30) | No | Contact phone |
| is_storage_location | BOOLEAN | Yes | Whether inventory may be held here |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

A location must not be treated as a storage facility unless `is_storage_location` is enabled and the relevant storage controls are configured.

#### 3.3 profiles

Connects authenticated users to their business profiles.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| auth_user_id | UUID | Yes | Supabase Auth user ID |
| full_name | VARCHAR(200) | Yes | User's full name |
| email | VARCHAR(150) | Yes | Email |
| phone | VARCHAR(30) | No | Phone |
| status | VARCHAR(20) | Yes | Active, suspended or inactive |
| last_login_at | TIMESTAMPTZ | No | Last successful login |
| deactivated_at | TIMESTAMPTZ | No | Deactivation date |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Constraints:
- `auth_user_id` must be unique.
- Email uniqueness should follow the business account policy.
- Authentication credentials remain in Supabase Auth.
- A deactivated user cannot access the application.
- Historical records created by the user must remain intact.

#### 3.4 roles

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| name | VARCHAR(100) | Yes | Role name |
| description | TEXT | No | Role description |
| is_system_role | BOOLEAN | Yes | Protected system role |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 3.5 permissions

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| permission_key | VARCHAR(150) | Yes | Unique permission identifier |
| description | TEXT | No | Permission description |

Examples:
- `procurement.create`
- `procurement.approve`
- `inventory.adjust`
- `sales.price_override`
- `finance.payment_approve`
- `fleet.maintenance_manage`
- `reports.view`
- `locations.manage`

#### 3.6 role_permissions

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| role_id | UUID | Yes | FK to roles |
| permission_id | UUID | Yes | FK to permissions |

Unique constraint: `(role_id, permission_id)`.

#### 3.7 user_roles

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | FK to profiles |
| role_id | UUID | Yes | FK to roles |
| assigned_by | UUID | No | FK to profiles |
| assigned_at | TIMESTAMPTZ | Yes | Assignment timestamp |

A user may hold multiple authorised roles.

#### 3.8 user_location_access

Controls location-level access.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | FK to profiles |
| location_id | UUID | Yes | FK to business_locations |
| access_level | VARCHAR(30) | Yes | View, operate, approve or manage |
| assigned_by | UUID | No | FK to profiles |
| assigned_at | TIMESTAMPTZ | Yes | Assignment timestamp |
| status | VARCHAR(20) | Yes | Active or inactive |

Unique constraint: `(user_id, location_id, access_level)`.

Authorised management users may have company-wide visibility. Location restrictions must be enforced through application permissions and Supabase Row Level Security.

#### 3.9 approval_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transaction_type | VARCHAR(60) | Yes | Transaction category |
| transaction_id | UUID | Yes | Related transaction |
| approval_level | INTEGER | Yes | Approval level |
| requested_by | UUID | Yes | Requesting user |
| assigned_approver | UUID | No | Designated approver |
| approved_by | UUID | No | Actual decision-maker |
| decision | VARCHAR(20) | Yes | Pending, approved, rejected or cancelled |
| reason | TEXT | No | Explanation |
| comments | TEXT | No | Approver comments |
| requested_at | TIMESTAMPTZ | Yes | Request timestamp |
| decided_at | TIMESTAMPTZ | No | Decision timestamp |

The application must enforce approval thresholds, separation of duties, delegated approval and escalation rules. Self-approval must be blocked where prohibited.

---

### 4. Supplier, product and procurement management

#### 4.1 suppliers

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| supplier_code | VARCHAR(40) | Yes | Unique supplier code |
| name | VARCHAR(200) | Yes | Supplier name |
| contact_person | VARCHAR(150) | No | Contact person |
| phone | VARCHAR(30) | No | Phone |
| email | VARCHAR(150) | No | Email |
| address | TEXT | No | Address |
| tax_identifier | VARCHAR(60) | No | Tax reference, where applicable |
| payment_terms | VARCHAR(40) | No | Agreed payment terms |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

#### 4.2 supplier_depots

Represents depots owned or operated by suppliers or other product sources.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| supplier_id | UUID | Yes | FK to suppliers |
| depot_code | VARCHAR(40) | Yes | Depot reference |
| name | VARCHAR(200) | Yes | Depot name |
| address | TEXT | No | Address |
| location_description | VARCHAR(200) | No | Location |
| contact_person | VARCHAR(150) | No | Contact |
| phone | VARCHAR(30) | No | Phone |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

A supplier may operate or use multiple depots.

#### 4.3 supplier_depot_bays

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| supplier_depot_id | UUID | Yes | FK to supplier_depots |
| bay_name | VARCHAR(100) | Yes | Loading bay |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 4.4 products

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| product_code | VARCHAR(40) | Yes | Unique product code |
| product_name | VARCHAR(120) | Yes | Product name |
| product_type | VARCHAR(60) | Yes | Product classification |
| description | TEXT | No | Product description |
| unit_of_measure | VARCHAR(20) | Yes | Initially litres |
| quality_requirements | TEXT | No | Configured product quality requirements |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Initial products include PMS, AGO and DPK. Future products must be configurable.

#### 4.5 supplier_products

Links suppliers to products they can supply.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| supplier_id | UUID | Yes | FK to suppliers |
| product_id | UUID | Yes | FK to products |
| supplier_product_code | VARCHAR(60) | No | Supplier product code |
| status | VARCHAR(20) | Yes | Active or inactive |

Unique constraint: `(supplier_id, product_id)`.

#### 4.6 purchase_orders

Represents the supplier purchasing commitment. It does not itself create inventory.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| po_number | VARCHAR(50) | Yes | Unique purchase order number |
| supplier_id | UUID | Yes | FK to suppliers |
| supplier_depot_id | UUID | No | FK to supplier_depots |
| sales_order_id | UUID | No | FK to sales_orders when customer-backed |
| order_date | DATE | Yes | Order date |
| expected_date | DATE | No | Expected loading or receipt date |
| currency | VARCHAR(3) | Yes | NGN initially |
| payment_terms | VARCHAR(40) | No | Supplier payment arrangement |
| status | VARCHAR(30) | Yes | Draft, submitted, approved, partially fulfilled, fulfilled, cancelled or other controlled status |
| notes | TEXT | No | Additional notes |
| created_by | UUID | Yes | FK to profiles |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

A purchase order may be associated with a confirmed customer order. Future speculative procurement may be supported without requiring a sales order.

#### 4.7 purchase_order_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| purchase_order_id | UUID | Yes | FK to purchase_orders |
| product_id | UUID | Yes | FK to products |
| ordered_quantity | NUMERIC(18,3) | Yes | Quantity ordered |
| agreed_unit_price | NUMERIC(18,4) | Yes | Supplier unit price |
| discount_amount | NUMERIC(18,2) | Yes | Default zero |
| line_total | NUMERIC(18,2) | Yes | Calculated line value |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Quantity must be greater than zero. Prices and discounts must be validated.

#### 4.8 procurement_batches

Represents a specific supplier procurement and loading event.

This table is deliberately designed to retain three separate quantity measurements.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| batch_number | VARCHAR(60) | Yes | Unique batch reference |
| supplier_id | UUID | Yes | FK to suppliers |
| supplier_depot_id | UUID | Yes | FK to supplier_depots |
| purchase_order_item_id | UUID | No | FK to purchase_order_items |
| sales_order_id | UUID | No | FK to sales_orders when customer-backed |
| product_id | UUID | Yes | FK to products |
| supplier_quantity | NUMERIC(18,3) | Yes | Quantity stated by supplier |
| loaded_quantity | NUMERIC(18,3) | No | Quantity measured at supplier depot |
| received_quantity | NUMERIC(18,3) | No | Quantity physically confirmed at destination |
| received_at_location_id | UUID | No | FK to business_locations |
| direct_customer_location_id | UUID | No | FK to customer_locations |
| fulfilment_type | VARCHAR(30) | Yes | Storage receipt or direct customer delivery |
| supplier_invoice_number | VARCHAR(80) | No | Supplier invoice reference |
| supplier_loading_ticket | VARCHAR(100) | No | Depot loading ticket |
| loading_date | TIMESTAMPTZ | No | Loading timestamp |
| receipt_date | TIMESTAMPTZ | No | Actual receipt or customer delivery timestamp |
| supplier_loading_variance | NUMERIC(18,3) | No | Supplier quantity less loaded quantity |
| loading_receipt_variance | NUMERIC(18,3) | No | Loaded quantity less received quantity |
| total_quantity_variance | NUMERIC(18,3) | No | Total quantity variance |
| variance_status | VARCHAR(30) | Yes | Not assessed, within tolerance, flagged, under investigation or resolved |
| status | VARCHAR(30) | Yes | Procurement batch status |
| created_by | UUID | Yes | Receiving or recording user |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Rules:
- Supplier quantity, loading quantity and received quantity must never be treated as interchangeable.
- The received quantity is the controlling quantity for actual storage inventory.
- For direct customer fulfilment, the customer-confirmed received quantity is the controlling delivered quantity.
- A direct fulfilment batch must not create a fictitious Deuces warehouse inventory receipt.
- Quantity variances must be retained and investigated.
- A variance is not automatically a confirmed financial loss or driver liability.

---

### 5. Landed cost management

#### 5.1 cost_categories

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| category_name | VARCHAR(120) | Yes | Cost category |
| category_type | VARCHAR(40) | Yes | Acquisition, inbound transport, handling, inspection, documentation, security or other configured category |
| landed_cost_inclusion | BOOLEAN | Yes | Whether included in landed cost |
| allocation_method | VARCHAR(30) | Yes | Per litre, percentage, fixed, product value or manual |
| requires_approval | BOOLEAN | Yes | Approval requirement |
| requires_evidence | BOOLEAN | Yes | Evidence requirement |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Cost category configuration must have effective dates and an audit history. General administration expenses must not automatically become landed cost.

#### 5.2 procurement_cost_components

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| cost_category_id | UUID | Yes | FK to cost_categories |
| description | TEXT | No | Expense description |
| amount | NUMERIC(18,2) | Yes | Cost amount |
| supplier_id | UUID | No | Related supplier |
| transporter_id | UUID | No | Related transporter |
| reference_number | VARCHAR(100) | No | Invoice or payment reference |
| evidence_path | TEXT | No | Document reference |
| approval_status | VARCHAR(20) | Yes | Pending, approved or rejected |
| recorded_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Inbound procurement transportation belongs here only where configured as a landed-cost component. Outbound customer delivery haulage must be recorded separately.

The acquisition cost must not be counted twice.

#### 5.3 cost_allocations

Allocates approved cost components to inventory batches or other supported cost targets.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| cost_component_id | UUID | Yes | FK to procurement_cost_components |
| inventory_batch_id | UUID | No | FK to inventory_batches |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| allocation_method | VARCHAR(30) | Yes | Applied method |
| allocation_basis_value | NUMERIC(18,4) | No | Value used in calculation |
| allocated_amount | NUMERIC(18,2) | Yes | Allocated cost |
| allocated_quantity | NUMERIC(18,3) | No | Allocation quantity |
| created_at | TIMESTAMPTZ | Yes | Allocation date |

Allocation totals must reconcile to the source component amount, subject to documented rounding rules.

For direct-to-customer procurement, cost allocation must be linked to the relevant procurement and sales fulfilment records without creating warehouse inventory.

#### 5.4 procurement_cost_adjustments

Records subsequent approved changes to procurement cost.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| adjustment_type | VARCHAR(30) | Yes | Additional cost, credit or correction |
| amount | NUMERIC(18,2) | Yes | Adjustment amount |
| reason | TEXT | Yes | Explanation |
| effective_date | DATE | Yes | Effective date |
| requested_by | UUID | Yes | Requesting user |
| approved_by | UUID | No | Approver |
| approval_status | VARCHAR(20) | Yes | Pending, approved or rejected |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

An adjustment must not silently rewrite the original landed cost.

#### 5.5 inventory_cost_adjustments

Tracks the effect of an approved landed-cost adjustment on existing stock and previously issued product.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_cost_adjustment_id | UUID | Yes | FK to procurement_cost_adjustments |
| inventory_batch_id | UUID | No | FK to inventory_batches |
| adjustment_scope | VARCHAR(30) | Yes | Remaining inventory, consumed inventory or direct fulfilment |
| quantity_affected | NUMERIC(18,3) | No | Affected quantity |
| amount_affected | NUMERIC(18,2) | Yes | Cost impact |
| treatment | VARCHAR(30) | Yes | Inventory value, cost of sales or approved operational treatment |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

The treatment must be approved and auditable. The original posted cost and previous profitability snapshots must remain available.

---

### 6. Inventory management

#### 6.1 inventory_batches

Represents product physically received into a Deuces-controlled storage location.

It is not created for direct-to-customer fulfilment.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| product_id | UUID | Yes | FK to products |
| location_id | UUID | Yes | FK to business_locations |
| original_quantity | NUMERIC(18,3) | Yes | Verified quantity received |
| remaining_quantity | NUMERIC(18,3) | Yes | Remaining quantity |
| landed_cost_per_unit | NUMERIC(18,4) | Yes | Current controlled unit cost |
| received_at | TIMESTAMPTZ | Yes | Receipt timestamp |
| status | VARCHAR(25) | Yes | Available, held, exhausted or closed |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

The source procurement batch must have `fulfilment_type = storage receipt`.

#### 6.2 inventory_reservations

Represents stock reserved for an approved sales order without physically issuing it.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| reservation_number | VARCHAR(50) | Yes | Unique reference |
| sales_order_id | UUID | Yes | FK to sales_orders |
| location_id | UUID | Yes | FK to business_locations |
| reservation_date | TIMESTAMPTZ | Yes | Reservation timestamp |
| expiry_at | TIMESTAMPTZ | No | Reservation expiry |
| status | VARCHAR(25) | Yes | Active, partially fulfilled, fulfilled, released or cancelled |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Reservations must not reduce physical on-hand inventory. They reduce available-to-promise inventory.

#### 6.3 inventory_reservation_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| reservation_id | UUID | Yes | FK to inventory_reservations |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| inventory_batch_id | UUID | Yes | FK to inventory_batches |
| reserved_quantity | NUMERIC(18,3) | Yes | Reserved quantity |
| released_quantity | NUMERIC(18,3) | Yes | Released quantity |
| fulfilled_quantity | NUMERIC(18,3) | Yes | Quantity actually issued |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

The system must prevent total active reservations from exceeding the available quantity of a batch.

#### 6.4 inventory_issues

Represents an authorised actual stock issue or dispatch from Deuces-controlled storage.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| issue_number | VARCHAR(50) | Yes | Unique issue reference |
| sales_order_id | UUID | Yes | FK to sales_orders |
| trip_id | UUID | No | FK to trips |
| issue_date | TIMESTAMPTZ | Yes | Issue timestamp |
| status | VARCHAR(25) | Yes | Draft, posted, reversed or cancelled |
| posted_by | UUID | No | Posting user |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |
| created_by | UUID | Yes | User |

Only a posted issue reduces physical inventory.

#### 6.5 inventory_movements

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| product_id | UUID | Yes | FK to products |
| location_id | UUID | Yes | FK to business_locations |
| inventory_batch_id | UUID | Yes | FK to inventory_batches |
| movement_type | VARCHAR(30) | Yes | Receipt, issue, transfer, adjustment or reversal |
| quantity_in | NUMERIC(18,3) | Yes | Incoming quantity |
| quantity_out | NUMERIC(18,3) | Yes | Outgoing quantity |
| reference_type | VARCHAR(50) | Yes | Originating business record |
| reference_id | UUID | Yes | Originating record ID |
| movement_date | TIMESTAMPTZ | Yes | Posting date |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

A movement cannot have both incoming and outgoing quantities greater than zero. A movement must be traceable to a source record.

Movements are append-only through normal application operations.

#### 6.6 fifo_allocations

FIFO allocations must be attached to actual posted inventory issues, not merely to order reservations.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| inventory_movement_id | UUID | Yes | FK to inventory_movements representing an issue |
| inventory_batch_id | UUID | Yes | FK to inventory_batches |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| allocated_quantity | NUMERIC(18,3) | Yes | Quantity consumed |
| allocated_unit_cost | NUMERIC(18,4) | Yes | Historical unit cost |
| total_cost | NUMERIC(18,2) | Yes | Allocated cost |
| allocation_date | TIMESTAMPTZ | Yes | Allocation timestamp |

Rules:
- Allocation quantity must reconcile with the corresponding issue quantity.
- A batch cannot be consumed beyond its available quantity.
- Concurrent issues must lock or otherwise safely protect the affected inventory rows.
- The allocated unit cost is preserved at posting.
- Corrections use reversal or compensating allocations.
- Reservations alone do not create FIFO cost-of-sales records.

#### 6.7 inventory_adjustments

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| product_id | UUID | Yes | FK to products |
| location_id | UUID | Yes | FK to business_locations |
| inventory_batch_id | UUID | No | FK to inventory_batches |
| adjustment_quantity | NUMERIC(18,3) | Yes | Signed adjustment |
| reason | TEXT | Yes | Reason |
| approval_status | VARCHAR(20) | Yes | Approval status |
| approved_by | UUID | No | Approver |
| created_by | UUID | Yes | Requesting user |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |

An adjustment must produce an appropriate inventory movement when posted.

#### 6.8 stock_transfers

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transfer_number | VARCHAR(50) | Yes | Unique reference |
| source_location_id | UUID | Yes | FK to business_locations |
| destination_location_id | UUID | Yes | FK to business_locations |
| transfer_date | TIMESTAMPTZ | Yes | Transfer date |
| status | VARCHAR(30) | Yes | Draft, in transit, received, cancelled or other controlled status |
| created_by | UUID | Yes | User |
| approved_by | UUID | No | Approver |

#### 6.9 stock_transfer_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| stock_transfer_id | UUID | Yes | FK to stock_transfers |
| inventory_batch_id | UUID | Yes | Source batch |
| quantity | NUMERIC(18,3) | Yes | Transfer quantity |
| received_quantity | NUMERIC(18,3) | No | Confirmed quantity at destination |
| received_at | TIMESTAMPTZ | No | Receipt timestamp |

Transfers must preserve the originating inventory batch and its cost. Transfer movements must be posted using a controlled transaction.

---

### 7. Customers, pricing and sales

#### 7.1 customers

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| customer_code | VARCHAR(40) | Yes | Unique customer code |
| name | VARCHAR(200) | Yes | Customer name |
| customer_category | VARCHAR(50) | Yes | Individual, business, petrol station, distributor or other configured type |
| phone | VARCHAR(30) | No | Phone |
| email | VARCHAR(150) | No | Email |
| address | TEXT | No | Address |
| credit_limit | NUMERIC(18,2) | Yes | Default zero |
| payment_terms | VARCHAR(40) | No | Agreed payment terms |
| credit_status | VARCHAR(25) | Yes | Active, on hold, suspended or closed |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Credit availability must be calculated from validated balances and commitments, not maintained as an unverified manually edited number.

#### 7.2 customer_locations

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| customer_id | UUID | Yes | FK to customers |
| location_name | VARCHAR(150) | Yes | Delivery location name |
| address | TEXT | Yes | Delivery address |
| contact_person | VARCHAR(150) | No | Contact |
| phone | VARCHAR(30) | No | Contact phone |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 7.3 product_selling_prices

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| product_id | UUID | Yes | FK to products |
| selling_price | NUMERIC(18,4) | Yes | Unit price |
| effective_from | TIMESTAMPTZ | Yes | Start date |
| effective_to | TIMESTAMPTZ | No | End date |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 7.4 customer_product_prices

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| customer_id | UUID | Yes | FK to customers |
| product_id | UUID | Yes | FK to products |
| selling_price | NUMERIC(18,4) | Yes | Negotiated price |
| effective_from | TIMESTAMPTZ | Yes | Start date |
| effective_to | TIMESTAMPTZ | No | End date |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_by | UUID | Yes | User |

Overlapping active price periods must be prevented unless an explicit priority rule exists.

#### 7.5 pricing_rules

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| product_id | UUID | Yes | FK to products |
| minimum_selling_price | NUMERIC(18,4) | No | Minimum price |
| minimum_margin | NUMERIC(9,4) | No | Minimum margin percentage |
| approval_required | BOOLEAN | Yes | Override approval requirement |
| effective_from | TIMESTAMPTZ | Yes | Start date |
| effective_to | TIMESTAMPTZ | No | End date |
| created_by | UUID | Yes | User |

#### 7.6 sales_orders

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| order_number | VARCHAR(50) | Yes | Unique order reference |
| customer_id | UUID | Yes | FK to customers |
| customer_location_id | UUID | No | FK to customer_locations |
| order_source | VARCHAR(40) | Yes | Sales representative, phone, WhatsApp or other configured source |
| sales_representative_id | UUID | No | FK to profiles or designated sales representative record |
| order_date | TIMESTAMPTZ | Yes | Order date |
| requested_delivery_date | TIMESTAMPTZ | No | Customer's preferred date |
| payment_arrangement | VARCHAR(30) | Yes | Full prepayment, deposit/balance or credit |
| payment_terms | VARCHAR(40) | No | Agreed payment terms |
| status | VARCHAR(30) | Yes | Controlled order status |
| notes | TEXT | No | Additional notes |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

Order source, representative, agreed price and terms must remain historically traceable.

#### 7.7 sales_order_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| sales_order_id | UUID | Yes | FK to sales_orders |
| product_id | UUID | Yes | FK to products |
| quantity | NUMERIC(18,3) | Yes | Ordered quantity |
| selling_price | NUMERIC(18,4) | Yes | Confirmed unit price |
| discount_amount | NUMERIC(18,2) | Yes | Default zero |
| delivery_fee | NUMERIC(18,2) | Yes | Delivery charge allocated to the line, where applicable |
| line_total | NUMERIC(18,2) | Yes | Calculated amount |
| pricing_rule_id | UUID | No | FK to pricing_rules |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Confirmed selling prices must not change when current price lists change.

#### 7.8 pricing_approvals

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| sales_order_id | UUID | Yes | FK to sales_orders |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| proposed_price | NUMERIC(18,4) | Yes | Proposed price |
| approved_price | NUMERIC(18,4) | No | Approved price |
| reason | TEXT | Yes | Override reason |
| requested_by | UUID | Yes | Requesting user |
| approved_by | UUID | No | Approver |
| status | VARCHAR(20) | Yes | Pending, approved or rejected |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 7.9 sales_invoices

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| invoice_number | VARCHAR(50) | Yes | Unique invoice reference |
| sales_order_id | UUID | Yes | FK to sales_orders |
| customer_id | UUID | Yes | FK to customers |
| invoice_date | DATE | Yes | Invoice date |
| due_date | DATE | No | Due date |
| total_amount | NUMERIC(18,2) | Yes | Invoice total |
| status | VARCHAR(25) | Yes | Draft, issued, partially paid, paid, overdue, disputed, cancelled or other controlled status |
| invoice_trigger | VARCHAR(30) | Yes | Order, loading, delivery or manual |
| created_by | UUID | Yes | User |
| issued_at | TIMESTAMPTZ | No | Issue timestamp |

Invoice creation must follow the configured invoice trigger. Partial delivery and partial invoicing must be supported.

#### 7.10 sales_invoice_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| sales_invoice_id | UUID | Yes | FK to sales_invoices |
| sales_order_item_id | UUID | No | FK to sales_order_items |
| product_id | UUID | Yes | FK to products |
| quantity | NUMERIC(18,3) | Yes | Invoiced quantity |
| selling_price | NUMERIC(18,4) | Yes | Historical price |
| revenue | NUMERIC(18,2) | Yes | Line revenue |
| delivery_revenue | NUMERIC(18,2) | Yes | Separately charged delivery revenue, if applicable |
| allocated_landed_cost | NUMERIC(18,2) | No | Cost snapshot |

The system must prevent invoicing more than the eligible unbilled quantity unless an authorised adjustment workflow applies.

#### 7.11 sales_credit_notes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| credit_note_number | VARCHAR(50) | Yes | Unique credit note number |
| sales_invoice_id | UUID | Yes | FK to sales_invoices |
| customer_id | UUID | Yes | FK to customers |
| credit_date | DATE | Yes | Credit date |
| reason | TEXT | Yes | Reason |
| total_amount | NUMERIC(18,2) | Yes | Credit amount |
| status | VARCHAR(25) | Yes | Draft, pending approval, approved, posted or cancelled |
| created_by | UUID | Yes | User |
| approved_by | UUID | No | Approver |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |

Credit notes must reference the original invoice and preserve its history.

#### 7.12 sales_credit_note_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| credit_note_id | UUID | Yes | FK to sales_credit_notes |
| invoice_item_id | UUID | Yes | FK to sales_invoice_items |
| quantity | NUMERIC(18,3) | No | Credited quantity where relevant |
| amount | NUMERIC(18,2) | Yes | Credit amount |
| reason | TEXT | No | Line-level explanation |

#### 7.13 customer_credit_reviews

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| customer_id | UUID | Yes | FK to customers |
| previous_limit | NUMERIC(18,2) | Yes | Previous limit |
| proposed_limit | NUMERIC(18,2) | Yes | Proposed limit |
| effective_date | DATE | Yes | Effective date |
| review_reason | TEXT | Yes | Reason |
| requested_by | UUID | Yes | Requesting user |
| approved_by | UUID | No | Approver |
| status | VARCHAR(20) | Yes | Pending, approved or rejected |

Credit limit changes must be auditable. Exceptions to credit controls require authorised approval.

---

### 8. Profitability and cost snapshots

#### 8.1 sales_profitability_snapshots

Stores versioned profitability calculations at sales order item level.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| snapshot_version | INTEGER | Yes | Sequential version |
| calculation_type | VARCHAR(20) | Yes | Estimated or actual |
| calculation_basis | VARCHAR(30) | Yes | Order estimate, dispatch, delivery or final reconciliation |
| product_revenue | NUMERIC(18,2) | Yes | Product revenue |
| delivery_revenue | NUMERIC(18,2) | Yes | Delivery revenue |
| landed_product_cost | NUMERIC(18,2) | Yes | Allocated landed cost |
| outbound_haulage_cost | NUMERIC(18,2) | Yes | Outbound transport cost |
| direct_delivery_expenses | NUMERIC(18,2) | Yes | Other direct delivery expenses |
| gross_product_margin | NUMERIC(18,2) | Yes | Product revenue less product cost |
| delivery_contribution | NUMERIC(18,2) | Yes | Delivery-related contribution |
| total_contribution | NUMERIC(18,2) | Yes | Overall contribution |
| margin_percentage | NUMERIC(9,4) | No | Calculated margin |
| calculation_notes | TEXT | No | Explanation |
| calculated_at | TIMESTAMPTZ | Yes | Calculation timestamp |
| calculated_by | UUID | No | User or system process |

Unique constraint: `(sales_order_item_id, snapshot_version)`.

Historical snapshots must not be overwritten when actual costs become available.

#### 8.2 trip_profitability_snapshots

Stores trip-level profitability.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| snapshot_version | INTEGER | Yes | Sequential version |
| calculation_type | VARCHAR(20) | Yes | Estimated or actual |
| delivery_revenue | NUMERIC(18,2) | Yes | Delivery revenue allocated to trip |
| product_revenue | NUMERIC(18,2) | Yes | Product revenue allocated to trip |
| inbound_cost | NUMERIC(18,2) | Yes | Included only where relevant to the selected reporting basis |
| outbound_haulage_cost | NUMERIC(18,2) | Yes | Transport cost |
| trip_expenses | NUMERIC(18,2) | Yes | Direct trip expenses |
| total_contribution | NUMERIC(18,2) | Yes | Calculated contribution |
| calculated_at | TIMESTAMPTZ | Yes | Calculation timestamp |
| calculated_by | UUID | No | User or system process |

The system must not double-count inbound procurement transport and outbound delivery haulage.

#### 8.3 profitability_snapshot_allocations

Explains how shared trip costs are allocated to order items.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_profitability_snapshot_id | UUID | Yes | FK to trip_profitability_snapshots |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| allocation_method | VARCHAR(30) | Yes | Quantity, distance, fixed, negotiated or manual |
| allocation_basis | NUMERIC(18,4) | No | Basis value |
| allocated_amount | NUMERIC(18,2) | Yes | Allocated amount |

The sum of allocations must reconcile to the source trip cost, subject to documented rounding.

---

### 9. Transporter, driver and employee management

#### 9.1 transporters

Represents third-party haulage providers.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_code | VARCHAR(40) | Yes | Unique code |
| business_name | VARCHAR(200) | Yes | Transporter name |
| contact_person | VARCHAR(150) | No | Contact |
| phone | VARCHAR(30) | No | Phone |
| email | VARCHAR(150) | No | Email |
| address | TEXT | No | Address |
| payment_terms | VARCHAR(40) | No | Agreed payment terms |
| status | VARCHAR(20) | Yes | Active or inactive |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 9.2 transporter_contracts

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_id | UUID | Yes | FK to transporters |
| contract_number | VARCHAR(60) | Yes | Contract reference |
| effective_from | DATE | Yes | Start date |
| effective_to | DATE | No | End date |
| payment_terms | VARCHAR(40) | Yes | Contract payment terms |
| terms_document_path | TEXT | No | Contract document |
| status | VARCHAR(20) | Yes | Draft, active, expired or terminated |
| approved_by | UUID | No | Approver |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 9.3 transporter_rate_cards

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_id | UUID | Yes | FK to transporters |
| contract_id | UUID | No | FK to transporter_contracts |
| rate_name | VARCHAR(120) | Yes | Rate card name |
| origin_location_id | UUID | No | FK to business_locations where applicable |
| destination_description | VARCHAR(200) | No | Destination or route |
| product_id | UUID | No | FK to products |
| truck_capacity_min | NUMERIC(18,3) | No | Minimum capacity |
| truck_capacity_max | NUMERIC(18,3) | No | Maximum capacity |
| pricing_method | VARCHAR(30) | Yes | Fixed trip, per litre, distance, capacity or negotiated |
| rate_amount | NUMERIC(18,4) | Yes | Rate amount |
| effective_from | DATE | Yes | Start date |
| effective_to | DATE | No | End date |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 9.4 transporter_invoices

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_id | UUID | Yes | FK to transporters |
| trip_id | UUID | No | FK to trips |
| invoice_number | VARCHAR(80) | Yes | Transporter invoice reference |
| invoice_date | DATE | Yes | Invoice date |
| due_date | DATE | No | Due date |
| amount | NUMERIC(18,2) | Yes | Invoice amount |
| approved_amount | NUMERIC(18,2) | No | Approved payable |
| status | VARCHAR(25) | Yes | Received, under review, approved, partially paid, paid, disputed or cancelled |
| evidence_path | TEXT | No | Invoice document |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Transporter invoices and payments must reconcile with the approved haulage cost and trip records.

#### 9.5 employees

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| employee_code | VARCHAR(40) | Yes | Unique employee code |
| full_name | VARCHAR(200) | Yes | Name |
| phone | VARCHAR(30) | No | Phone |
| email | VARCHAR(150) | No | Email |
| department | VARCHAR(100) | No | Department |
| employment_status | VARCHAR(30) | Yes | Employment status |
| employment_date | DATE | No | Start date |
| exit_date | DATE | No | Exit date |

#### 9.6 drivers

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| employee_id | UUID | No | Optional FK to employees |
| transporter_id | UUID | No | FK to transporters where third-party |
| driver_code | VARCHAR(40) | Yes | Unique driver code |
| full_name | VARCHAR(200) | Yes | Name |
| phone | VARCHAR(30) | No | Phone |
| licence_number | VARCHAR(80) | Yes | Licence reference |
| licence_expiry | DATE | No | Expiry date |
| driver_type | VARCHAR(30) | Yes | Employee or third-party |
| status | VARCHAR(20) | Yes | Active or inactive |

A driver is a separate operational record. A third-party driver must not automatically be treated as a Deuces employee.

#### 9.7 driver_documents

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| document_type | VARCHAR(60) | Yes | Document type |
| document_number | VARCHAR(100) | No | Reference |
| expiry_date | DATE | No | Expiry |
| file_path | TEXT | No | Storage reference |

#### 9.8 driver_compensation_profiles

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| compensation_type | VARCHAR(30) | Yes | Trip, salary or hybrid |
| salary_amount | NUMERIC(18,2) | No | Salary |
| salary_frequency | VARCHAR(20) | No | Weekly, monthly or configured |
| default_trip_allowance | NUMERIC(18,2) | No | Default allowance |
| effective_from | DATE | Yes | Start date |
| effective_to | DATE | No | End date |
| status | VARCHAR(20) | Yes | Active or inactive |

This table applies only where Deuces has an actual compensation obligation to the driver.

For third-party transporter drivers, compensation is normally included in the transporter's agreed haulage fee. No automatic Deuces salary or allowance obligation should be created.

#### 9.9 driver_compensation_history

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| compensation_type | VARCHAR(30) | Yes | Compensation arrangement |
| salary_amount | NUMERIC(18,2) | No | Applicable salary |
| trip_allowance | NUMERIC(18,2) | No | Applicable allowance |
| effective_from | DATE | Yes | Start date |
| effective_to | DATE | No | End date |
| approved_by | UUID | No | Approver |

#### 9.10 driver_salary_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| payroll_period_start | DATE | Yes | Period start |
| payroll_period_end | DATE | Yes | Period end |
| gross_amount | NUMERIC(18,2) | Yes | Salary earned |
| deductions | NUMERIC(18,2) | Yes | Approved deductions |
| net_amount | NUMERIC(18,2) | Yes | Payable |
| payment_status | VARCHAR(20) | Yes | Unpaid, partially paid or paid |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Unique constraint: `(driver_id, payroll_period_start, payroll_period_end)` unless a controlled adjustment process is used.

#### 9.11 driver_trip_allowances

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| trip_id | UUID | Yes | FK to trips |
| allowance_amount | NUMERIC(18,2) | Yes | Allowance earned |
| payment_status | VARCHAR(20) | Yes | Unpaid, partially paid or paid |
| approved_by | UUID | No | Approver |

Unique constraint: `(driver_id, trip_id)` for a standard single allowance.

#### 9.12 driver_advances

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| driver_id | UUID | Yes | FK to drivers |
| advance_amount | NUMERIC(18,2) | Yes | Advance issued |
| issue_date | DATE | Yes | Issue date |
| purpose | TEXT | Yes | Purpose |
| status | VARCHAR(20) | Yes | Outstanding, partially retired, retired or cancelled |

#### 9.13 driver_expense_retirements

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| advance_id | UUID | Yes | FK to driver_advances |
| amount_spent | NUMERIC(18,2) | Yes | Approved expenses |
| amount_returned | NUMERIC(18,2) | Yes | Returned cash |
| outstanding_amount | NUMERIC(18,2) | Yes | Outstanding balance |
| evidence_path | TEXT | No | Receipt evidence |
| status | VARCHAR(20) | Yes | Pending, approved or rejected |

Multiple retirement records may be allowed against one advance. Cumulative spending and returns must not exceed the approved advance without an authorised exception.

---

### 10. Fleet management

#### 10.1 trucks

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_id | UUID | No | FK to transporters for third-party trucks |
| registration_number | VARCHAR(40) | Yes | Unique registration |
| vin | VARCHAR(80) | No | Chassis/VIN |
| make | VARCHAR(100) | No | Manufacturer |
| model | VARCHAR(100) | No | Model |
| year | INTEGER | No | Manufacturing year |
| capacity | NUMERIC(18,3) | Yes | Truck capacity |
| ownership_type | VARCHAR(30) | Yes | Company or third-party |
| status | VARCHAR(25) | Yes | Active, inactive, maintenance or retired |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Third-party trucks must be linked to their transporter where known. Company-owned fleet records may be expanded with asset and depreciation functionality later.

#### 10.2 truck_ownership_history

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| ownership_type | VARCHAR(30) | Yes | Ownership category |
| owner_name | VARCHAR(200) | No | Owner |
| effective_from | DATE | Yes | Start |
| effective_to | DATE | No | End |

#### 10.3 truck_compartments

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| compartment_number | VARCHAR(30) | Yes | Compartment reference |
| capacity | NUMERIC(18,3) | Yes | Compartment capacity |
| product_compatibility | TEXT | No | Permitted product information |
| status | VARCHAR(20) | Yes | Active or inactive |

Unique constraint: `(truck_id, compartment_number)`.

#### 10.4 compartment_calibrations

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| compartment_id | UUID | Yes | FK to truck_compartments |
| calibration_date | DATE | Yes | Calibration date |
| certificate_reference | VARCHAR(100) | No | Certificate |
| expiry_date | DATE | No | Expiry |
| file_path | TEXT | No | Certificate storage |

#### 10.5 compartment_seals

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| compartment_id | UUID | Yes | FK to truck_compartments |
| seal_number | VARCHAR(100) | Yes | Seal reference |
| installed_at | TIMESTAMPTZ | Yes | Installation |
| removed_at | TIMESTAMPTZ | No | Removal |
| removal_reason | TEXT | No | Reason |

#### 10.6 truck_documents

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| document_type | VARCHAR(60) | Yes | Document type |
| document_number | VARCHAR(100) | No | Document reference |
| issue_date | DATE | No | Issue date |
| expiry_date | DATE | No | Expiry |
| file_path | TEXT | No | Storage reference |

#### 10.7 truck_assignments

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| driver_id | UUID | Yes | FK to drivers |
| assigned_from | TIMESTAMPTZ | Yes | Assignment start |
| assigned_to | TIMESTAMPTZ | No | Assignment end |

#### 10.8 truck_maintenance_history

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| maintenance_type | VARCHAR(80) | Yes | Maintenance category |
| description | TEXT | Yes | Work performed |
| workshop | VARCHAR(150) | No | Workshop |
| labour_cost | NUMERIC(18,2) | Yes | Labour cost |
| parts_cost | NUMERIC(18,2) | Yes | Parts cost |
| service_date | DATE | Yes | Service date |
| next_service_date | DATE | No | Next service |

#### 10.9 truck_fuel_logs

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| trip_id | UUID | No | FK to trips |
| quantity | NUMERIC(18,3) | Yes | Fuel quantity |
| amount | NUMERIC(18,2) | Yes | Fuel cost |
| odometer_reading | NUMERIC(18,2) | No | Odometer |
| recorded_at | TIMESTAMPTZ | Yes | Record time |
| evidence_path | TEXT | No | Receipt |

#### 10.10 truck_odometer_logs

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| odometer_reading | NUMERIC(18,2) | Yes | Recorded reading |
| recorded_at | TIMESTAMPTZ | Yes | Timestamp |
| source | VARCHAR(40) | Yes | Inspection, trip or service |

#### 10.11 truck_tyre_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| tyre_serial | VARCHAR(100) | No | Tyre serial |
| brand | VARCHAR(100) | No | Brand |
| position | VARCHAR(40) | No | Wheel position |
| installation_date | DATE | Yes | Installation |
| removal_date | DATE | No | Removal |
| mileage_at_installation | NUMERIC(18,2) | No | Odometer |
| mileage_at_removal | NUMERIC(18,2) | No | Odometer |
| removal_reason | TEXT | No | Reason |

#### 10.12 truck_parts_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| truck_id | UUID | Yes | FK to trucks |
| part_type | VARCHAR(100) | Yes | Part category |
| serial_number | VARCHAR(100) | No | Serial |
| installation_date | DATE | Yes | Installation |
| removal_date | DATE | No | Removal |
| cost | NUMERIC(18,2) | Yes | Cost |

---

### 11. Trip, dispatch and delivery

#### 11.1 trips

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_number | VARCHAR(50) | Yes | Unique trip number |
| origin_supplier_depot_id | UUID | No | FK to supplier_depots |
| origin_location_id | UUID | No | FK to business_locations |
| destination_location_id | UUID | No | FK to business_locations where applicable |
| departure_time | TIMESTAMPTZ | No | Departure |
| expected_arrival | TIMESTAMPTZ | No | Expected arrival |
| actual_arrival | TIMESTAMPTZ | No | Actual arrival |
| status | VARCHAR(30) | Yes | Controlled trip status |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

The trip origin and destination must support supplier depot to customer, supplier depot to storage, and storage to customer journeys.

#### 11.2 trip_assignments

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| truck_id | UUID | Yes | FK to trucks |
| driver_id | UUID | Yes | FK to drivers |
| transporter_id | UUID | No | FK to transporters |
| assignment_role | VARCHAR(20) | Yes | Primary or additional |
| assigned_at | TIMESTAMPTZ | Yes | Assignment time |
| released_at | TIMESTAMPTZ | No | Assignment end |

A trip must have one designated primary truck and driver before loading. Historical assignments must remain preserved.

Dispatch selects the transporter manually. The system may show rate, capacity, availability, reliability and performance information but must not automatically assign a transporter.

#### 11.3 trip_sales_orders

Connects sales orders to trips.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| sales_order_id | UUID | Yes | FK to sales_orders |
| assigned_quantity | NUMERIC(18,3) | Yes | Total quantity assigned to this trip |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Unique constraint: `(trip_id, sales_order_id)` where one trip-order relationship is intended.

#### 11.4 trip_sales_order_items

Allocates individual order lines to trips.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_sales_order_id | UUID | Yes | FK to trip_sales_orders |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| assigned_quantity | NUMERIC(18,3) | Yes | Quantity assigned to trip |
| status | VARCHAR(25) | Yes | Assigned, loaded, partially delivered, delivered or cancelled |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

This table is essential for partial fulfilment and multiple products. A sales order item may be allocated across multiple trips.

The sum of active assignments must not exceed the eligible order quantity.

#### 11.5 trip_loading_records

Represents a physical loading event into a truck compartment.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| compartment_id | UUID | Yes | FK to truck_compartments |
| product_id | UUID | Yes | FK to products |
| loaded_quantity | NUMERIC(18,3) | Yes | Measured loading quantity |
| loading_ticket | VARCHAR(100) | No | Depot loading ticket |
| seal_number | VARCHAR(100) | No | Seal |
| loading_time | TIMESTAMPTZ | Yes | Loading time |
| officer_id | UUID | No | Loading officer |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 11.6 trip_loading_batch_allocations

Links one compartment loading record to one or more inventory batches.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_loading_record_id | UUID | Yes | FK to trip_loading_records |
| inventory_batch_id | UUID | No | FK to inventory_batches |
| procurement_batch_id | UUID | No | FK to procurement_batches for direct procurement |
| allocated_quantity | NUMERIC(18,3) | Yes | Quantity from source |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Exactly one supported source path must be supplied for each allocation. The sum of allocated quantities must reconcile to the loading record quantity.

For direct supplier-to-customer fulfilment, the procurement batch provides the source traceability. For storage dispatch, the inventory batch provides the source traceability.

#### 11.7 trip_delivery_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| trip_sales_order_item_id | UUID | Yes | FK to trip_sales_order_items |
| trip_loading_record_id | UUID | No | FK to trip_loading_records |
| customer_location_id | UUID | Yes | FK to customer_locations |
| product_id | UUID | Yes | FK to products |
| delivered_quantity | NUMERIC(18,3) | Yes | Quantity measured at delivery |
| customer_confirmed_quantity | NUMERIC(18,3) | No | Customer-confirmed quantity |
| delivery_time | TIMESTAMPTZ | Yes | Delivery time |
| customer_acknowledgement | VARCHAR(150) | No | Acknowledgement reference |
| delivery_status | VARCHAR(25) | Yes | Complete, partial, rejected, disputed or failed |
| waybill_reference | VARCHAR(100) | No | Delivery note/waybill |
| created_by | UUID | Yes | Recording user |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

A delivery must be linked to its trip, order-line allocation and relevant loading record where applicable.

#### 11.8 delivery_evidence

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_delivery_record_id | UUID | Yes | FK to trip_delivery_records |
| evidence_type | VARCHAR(40) | Yes | Signature, photo, waybill or other |
| file_path | TEXT | Yes | Secure storage reference |
| uploaded_by | UUID | Yes | User |
| uploaded_at | TIMESTAMPTZ | Yes | Timestamp |
| notes | TEXT | No | Evidence description |

Required evidence is configurable by transaction type. Evidence must be stored securely with role-based access.

#### 11.9 trip_expenses

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| expense_category | VARCHAR(100) | Yes | Expense type |
| amount | NUMERIC(18,2) | Yes | Expense amount |
| description | TEXT | No | Explanation |
| evidence_path | TEXT | No | Evidence |
| approval_status | VARCHAR(20) | Yes | Pending, approved or rejected |
| recorded_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 11.10 trip_reconciliations

Trip-level reconciliation header.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_id | UUID | Yes | FK to trips |
| reconciliation_number | VARCHAR(50) | Yes | Unique reference |
| status | VARCHAR(30) | Yes | Pending, under review, completed or disputed |
| completed_by | UUID | No | User |
| completed_at | TIMESTAMPTZ | No | Completion timestamp |
| approved_by | UUID | No | Approver |
| notes | TEXT | No | Reconciliation notes |

#### 11.11 trip_reconciliation_items

Detailed product and delivery-level reconciliation.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| reconciliation_id | UUID | Yes | FK to trip_reconciliations |
| trip_loading_record_id | UUID | No | FK to trip_loading_records |
| trip_delivery_record_id | UUID | No | FK to trip_delivery_records |
| product_id | UUID | Yes | FK to products |
| loaded_quantity | NUMERIC(18,3) | Yes | Loaded quantity |
| delivered_quantity | NUMERIC(18,3) | Yes | Delivered quantity |
| variance_quantity | NUMERIC(18,3) | Yes | Calculated variance |
| tolerance_quantity | NUMERIC(18,3) | No | Approved tolerance |
| provisional_financial_impact | NUMERIC(18,2) | No | Estimated financial impact |
| reconciliation_status | VARCHAR(30) | Yes | Within tolerance, flagged, investigated or resolved |
| notes | TEXT | No | Explanation |

A trip may contain multiple products and multiple delivery legs. Reconciliation must therefore be performed at the appropriate product and delivery allocation level.

#### 11.12 delivery_discrepancies

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| reconciliation_item_id | UUID | Yes | FK to trip_reconciliation_items |
| discrepancy_type | VARCHAR(40) | Yes | Supplier, loading, transport, customer measurement or other |
| expected_quantity | NUMERIC(18,3) | Yes | Expected quantity |
| actual_quantity | NUMERIC(18,3) | Yes | Actual quantity |
| variance | NUMERIC(18,3) | Yes | Difference |
| provisional_financial_impact | NUMERIC(18,2) | No | Estimated impact |
| status | VARCHAR(30) | Yes | Open, under investigation, resolved or approved loss |
| reported_at | TIMESTAMPTZ | Yes | Report date |
| reported_by | UUID | Yes | Reporting user |

#### 11.13 discrepancy_investigations

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| discrepancy_id | UUID | Yes | FK to delivery_discrepancies |
| findings | TEXT | No | Findings |
| responsible_party_type | VARCHAR(40) | No | Supplier, transporter, customer, internal or unresolved |
| responsible_party_id | UUID | No | Related party where applicable |
| responsibility_status | VARCHAR(30) | Yes | Undetermined, confirmed or cleared |
| resolution | TEXT | No | Resolution |
| investigator_id | UUID | No | Investigator |
| approved_by | UUID | No | Approver |
| completed_at | TIMESTAMPTZ | No | Completion timestamp |

A discrepancy must never automatically become a driver debt, transporter debt or employee deduction. Liability requires investigation and authorised confirmation.

---


### 12. Incident and compliance management

#### 12.1 incidents

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_number | VARCHAR(50) | Yes | Unique reference |
| incident_type | VARCHAR(80) | Yes | Incident category |
| incident_date | TIMESTAMPTZ | Yes | Date and time |
| location_description | TEXT | No | Location |
| business_location_id | UUID | No | FK to business_locations |
| description | TEXT | Yes | Details |
| severity | VARCHAR(20) | Yes | Severity |
| status | VARCHAR(30) | Yes | Incident status |
| created_by | UUID | Yes | Reporting user |

#### 12.2 incident_participants

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_id | UUID | Yes | FK to incidents |
| driver_id | UUID | No | FK to drivers |
| truck_id | UUID | No | FK to trucks |
| employee_id | UUID | No | FK to employees |
| transporter_id | UUID | No | FK to transporters |
| trip_id | UUID | No | FK to trips |
| involvement_type | VARCHAR(50) | No | Role in incident |

#### 12.3 incident_evidence

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_id | UUID | Yes | FK to incidents |
| file_path | TEXT | Yes | Evidence reference |
| evidence_type | VARCHAR(50) | Yes | Photograph, document or other |
| uploaded_by | UUID | Yes | User |
| uploaded_at | TIMESTAMPTZ | Yes | Timestamp |

#### 12.4 incident_investigations

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_id | UUID | Yes | FK to incidents |
| findings | TEXT | No | Investigation findings |
| responsibility_status | VARCHAR(30) | Yes | Undetermined, confirmed or cleared |
| investigator_id | UUID | No | Investigator |
| completed_at | TIMESTAMPTZ | No | Completion |

#### 12.5 incident_actions

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_id | UUID | Yes | FK to incidents |
| action_description | TEXT | Yes | Required action |
| assigned_to | UUID | No | Responsible user |
| due_date | DATE | No | Due date |
| status | VARCHAR(20) | Yes | Action status |

#### 12.6 insurance_policies

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| policy_number | VARCHAR(100) | Yes | Policy reference |
| truck_id | UUID | No | FK to trucks |
| insurer | VARCHAR(150) | Yes | Insurance provider |
| start_date | DATE | Yes | Policy start |
| expiry_date | DATE | Yes | Expiry |
| status | VARCHAR(20) | Yes | Status |

#### 12.7 insurance_claims

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| incident_id | UUID | Yes | FK to incidents |
| policy_id | UUID | Yes | FK to insurance_policies |
| claim_amount | NUMERIC(18,2) | Yes | Claim amount |
| settlement_amount | NUMERIC(18,2) | No | Settlement |
| status | VARCHAR(30) | Yes | Claim status |

#### 12.8 compliance_requirements

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| requirement_name | VARCHAR(150) | Yes | Requirement |
| requirement_type | VARCHAR(80) | Yes | Document or compliance type |
| applicable_entity | VARCHAR(50) | Yes | Truck, driver, depot or business |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 12.9 compliance_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| requirement_id | UUID | Yes | FK to compliance_requirements |
| entity_type | VARCHAR(50) | Yes | Related entity type |
| entity_id | UUID | Yes | Related entity ID |
| document_reference | VARCHAR(100) | No | Document number |
| expiry_date | DATE | No | Expiry |
| status | VARCHAR(30) | Yes | Compliance status |
| file_path | TEXT | No | Document |

The entity reference must be validated by the application because a generic entity ID cannot be protected by a conventional foreign key.

#### 12.10 product_quality_checks

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_batch_id | UUID | No | FK to procurement_batches |
| inventory_batch_id | UUID | No | FK to inventory_batches |
| inspection_date | TIMESTAMPTZ | Yes | Date |
| test_type | VARCHAR(80) | Yes | Test type |
| result | TEXT | Yes | Result |
| status | VARCHAR(30) | Yes | Passed, failed or pending |
| inspected_by | UUID | No | Inspector |
| evidence_path | TEXT | No | Test evidence |

---

### 13. Finance and payments

#### 13.1 financial_transactions

Represents the operational financial transaction record.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transaction_number | VARCHAR(60) | Yes | Unique reference |
| transaction_type | VARCHAR(50) | Yes | Receipt, supplier payment, expense, transfer or other |
| transaction_date | TIMESTAMPTZ | Yes | Date |
| description | TEXT | No | Description |
| amount | NUMERIC(18,2) | Yes | Amount |
| currency | VARCHAR(3) | Yes | NGN initially |
| status | VARCHAR(25) | Yes | Draft, pending, posted, reversed or cancelled |
| source_type | VARCHAR(50) | No | Source document type |
| source_id | UUID | No | Source record |
| created_by | UUID | Yes | User |
| posted_by | UUID | No | Posting user |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |

This table is an operational transaction register, not a substitute for a double-entry general ledger.

#### 13.2 payment_records

A common record for actual or pending payment events.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transaction_id | UUID | No | FK to financial_transactions |
| payment_direction | VARCHAR(20) | Yes | Inbound or outbound |
| party_type | VARCHAR(30) | Yes | Customer, supplier, transporter, employee or other configured party |
| party_id | UUID | Yes | Related party ID |
| payment_method | VARCHAR(30) | Yes | Bank transfer, cash, POS or other |
| payment_channel_id | UUID | No | FK to payment_channels |
| payment_reference | VARCHAR(120) | No | Payment reference |
| amount | NUMERIC(18,2) | Yes | Payment amount |
| payment_date | TIMESTAMPTZ | Yes | Payment date |
| verification_status | VARCHAR(20) | Yes | Pending, verified or rejected |
| settlement_status | VARCHAR(20) | Yes | Pending, settled, failed or reversed |
| evidence_path | TEXT | No | Payment evidence |
| created_by | UUID | Yes | User |
| verified_by | UUID | No | Verifier |
| verified_at | TIMESTAMPTZ | No | Verification timestamp |

`party_type` and `party_id` form a polymorphic party reference and therefore require strict application-service validation. Where stronger relational enforcement is required, use separate party-specific payment detail tables.

A POS transaction must not be treated as settled cash until settlement is confirmed.

#### 13.3 payment_channels

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| channel_name | VARCHAR(100) | Yes | Bank account, cash account, POS or other |
| channel_type | VARCHAR(30) | Yes | Bank, cash, POS or other |
| institution_name | VARCHAR(150) | No | Bank or provider |
| account_name | VARCHAR(150) | No | Account name |
| account_identifier | VARCHAR(100) | No | Account reference, securely stored |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 13.4 invoice_payment_allocations

Allocates inbound customer payments to sales invoices.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| payment_record_id | UUID | Yes | FK to payment_records |
| sales_invoice_id | UUID | Yes | FK to sales_invoices |
| allocated_amount | NUMERIC(18,2) | Yes | Amount allocated |
| allocated_at | TIMESTAMPTZ | Yes | Allocation timestamp |
| allocated_by | UUID | Yes | User |

The payment must be inbound and associated with the relevant customer. Total allocations cannot exceed the verified, settled and available payment amount, subject to the configured treatment of pending settlement.

#### 13.5 supplier_payment_allocations

Allocates outbound supplier payments to supplier liabilities.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| payment_record_id | UUID | Yes | FK to payment_records |
| accounts_payable_id | UUID | Yes | FK to accounts_payable |
| allocated_amount | NUMERIC(18,2) | Yes | Amount allocated |
| allocated_at | TIMESTAMPTZ | Yes | Allocation timestamp |
| allocated_by | UUID | Yes | User |

The payment must be outbound and associated with the supplier liability.

#### 13.6 transporter_payment_allocations

Allocates transporter payments to transporter invoices.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| payment_record_id | UUID | Yes | FK to payment_records |
| transporter_invoice_id | UUID | Yes | FK to transporter_invoices |
| allocated_amount | NUMERIC(18,2) | Yes | Amount allocated |
| allocated_at | TIMESTAMPTZ | Yes | Allocation timestamp |
| allocated_by | UUID | Yes | User |

#### 13.7 payment_reversals

Preserves the original payment and records a compensating reversal.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| original_payment_id | UUID | Yes | FK to payment_records |
| reversal_payment_id | UUID | No | FK to payment_records where a separate reversal payment is created |
| reversal_amount | NUMERIC(18,2) | Yes | Reversed amount |
| reversal_reason | TEXT | Yes | Reason |
| requested_by | UUID | Yes | Requesting user |
| approved_by | UUID | No | Approver |
| reversed_at | TIMESTAMPTZ | No | Reversal timestamp |
| status | VARCHAR(20) | Yes | Pending, approved, posted or rejected |

A reversal must not erase the original payment or its historical allocations. The application must recalculate outstanding balances from valid posted records.

#### 13.8 accounts_receivable

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| customer_id | UUID | Yes | FK to customers |
| invoice_id | UUID | Yes | FK to sales_invoices |
| original_amount | NUMERIC(18,2) | Yes | Original amount |
| outstanding_amount | NUMERIC(18,2) | Yes | Current balance |
| due_date | DATE | No | Due date |
| status | VARCHAR(20) | Yes | Outstanding, overdue, paid or disputed |
| updated_at | TIMESTAMPTZ | Yes | Last balance update |

Balances must reconcile with posted invoices, credit notes, receipts and reversals.

#### 13.9 accounts_payable

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| supplier_id | UUID | No | FK to suppliers |
| transporter_id | UUID | No | FK to transporters |
| reference_type | VARCHAR(50) | Yes | Source transaction type |
| reference_id | UUID | Yes | Source record |
| original_amount | NUMERIC(18,2) | Yes | Amount owed |
| outstanding_amount | NUMERIC(18,2) | Yes | Outstanding amount |
| due_date | DATE | No | Due date |
| status | VARCHAR(20) | Yes | Outstanding, partially paid, paid, overdue or disputed |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Exactly one appropriate supplier or transporter party relationship must be established for each payable. Source record references must be validated.

#### 13.10 expense_records

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| expense_category | VARCHAR(100) | Yes | Expense category |
| transaction_date | DATE | Yes | Expense date |
| amount | NUMERIC(18,2) | Yes | Amount |
| description | TEXT | Yes | Description |
| location_id | UUID | No | FK to business_locations |
| trip_id | UUID | No | FK to trips |
| cost_treatment | VARCHAR(30) | Yes | Operating expense, inbound landed cost or direct delivery cost |
| approval_status | VARCHAR(20) | Yes | Approval status |
| evidence_path | TEXT | No | Evidence |
| created_by | UUID | Yes | User |

Expense treatment must follow the configured cost category. A cost must not be recorded both as an expense and as a landed-cost component without an explicit adjustment process.

---

### 14. Document management

#### 14.1 documents

Central document metadata table. Actual file contents are stored in secure cloud object storage.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| document_number | VARCHAR(60) | No | Document reference |
| document_type | VARCHAR(60) | Yes | Invoice, loading ticket, receipt, waybill, contract, evidence or other |
| file_name | VARCHAR(255) | Yes | Original file name |
| storage_path | TEXT | Yes | Secure storage path |
| mime_type | VARCHAR(120) | Yes | File type |
| file_size_bytes | BIGINT | Yes | File size |
| version_number | INTEGER | Yes | Version number |
| uploaded_by | UUID | Yes | FK to profiles |
| uploaded_at | TIMESTAMPTZ | Yes | Upload timestamp |
| checksum | VARCHAR(128) | No | File integrity checksum |
| status | VARCHAR(20) | Yes | Active, archived or superseded |

#### 14.2 document_links

Links documents to business records without storing duplicate file copies.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| document_id | UUID | Yes | FK to documents |
| entity_type | VARCHAR(60) | Yes | Related record type |
| entity_id | UUID | Yes | Related record ID |
| relationship_type | VARCHAR(60) | No | Supporting, primary, evidence or other |
| linked_by | UUID | Yes | User |
| linked_at | TIMESTAMPTZ | Yes | Timestamp |

Because `entity_id` is polymorphic, the application must validate the referenced record.

#### 14.3 document_requirements

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| document_type | VARCHAR(60) | Yes | Required document type |
| transaction_type | VARCHAR(60) | Yes | Relevant transaction |
| is_mandatory | BOOLEAN | Yes | Mandatory flag |
| applies_from | DATE | Yes | Effective date |
| applies_to | DATE | No | End date |
| status | VARCHAR(20) | Yes | Active or inactive |

Missing mandatory documents must be flagged before the relevant transaction can be completed.

---

### 15. Reporting, imports and notifications

#### 15.1 report_definitions

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| report_name | VARCHAR(150) | Yes | Report name |
| report_category | VARCHAR(60) | Yes | Operational, finance, inventory, sales, haulage or other |
| description | TEXT | No | Description |
| default_filters | JSONB | No | Default report filters |
| required_permission | VARCHAR(150) | Yes | Permission required |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 15.2 saved_report_views

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| report_definition_id | UUID | Yes | FK to report_definitions |
| user_id | UUID | Yes | FK to profiles |
| view_name | VARCHAR(120) | Yes | Saved view name |
| filter_configuration | JSONB | Yes | Saved filters |
| column_configuration | JSONB | No | Selected columns |
| is_shared | BOOLEAN | Yes | Shared view flag |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Custom report views must respect role and location access restrictions.

#### 15.3 report_schedules

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| report_definition_id | UUID | Yes | FK to report_definitions |
| created_by | UUID | Yes | FK to profiles |
| frequency | VARCHAR(20) | Yes | Daily, weekly or monthly |
| delivery_channel | VARCHAR(30) | Yes | Application, email or WhatsApp |
| recipient_configuration | JSONB | Yes | Approved recipient details |
| export_format | VARCHAR(10) | Yes | PDF, XLSX or CSV |
| next_run_at | TIMESTAMPTZ | No | Next scheduled run |
| status | VARCHAR(20) | Yes | Active, paused or cancelled |

On-demand reports do not require a recurring schedule record.

#### 15.4 data_import_jobs

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| import_type | VARCHAR(60) | Yes | Customer, supplier, product, opening balance or other |
| file_name | VARCHAR(255) | Yes | Uploaded file |
| storage_path | TEXT | Yes | Secure file path |
| file_format | VARCHAR(10) | Yes | CSV or XLSX |
| column_mapping | JSONB | No | Mapping configuration |
| total_rows | INTEGER | No | Total rows |
| valid_rows | INTEGER | No | Valid rows |
| rejected_rows | INTEGER | No | Rejected rows |
| status | VARCHAR(25) | Yes | Uploaded, previewed, validated, processing, completed or failed |
| created_by | UUID | Yes | User |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| completed_at | TIMESTAMPTZ | No | Completion timestamp |

Imports must support templates, preview, validation, duplicate detection and import history.

#### 15.5 data_import_errors

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| import_job_id | UUID | Yes | FK to data_import_jobs |
| row_number | INTEGER | Yes | Source row |
| field_name | VARCHAR(100) | No | Problem field |
| error_code | VARCHAR(60) | Yes | Validation error |
| error_message | TEXT | Yes | Explanation |
| source_values | JSONB | No | Relevant source data |

#### 15.6 notifications

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| recipient_user_id | UUID | No | FK to profiles |
| recipient_contact | VARCHAR(200) | No | External recipient |
| notification_type | VARCHAR(60) | Yes | Notification category |
| priority | VARCHAR(20) | Yes | Critical, high, normal or low |
| title | VARCHAR(200) | Yes | Notification title |
| message | TEXT | Yes | Notification message |
| channel | VARCHAR(30) | Yes | In-app, email or WhatsApp |
| related_entity_type | VARCHAR(60) | No | Related record type |
| related_entity_id | UUID | No | Related record |
| status | VARCHAR(20) | Yes | Pending, sent, failed or read |
| sent_at | TIMESTAMPTZ | No | Send timestamp |
| read_at | TIMESTAMPTZ | No | Read timestamp |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 15.7 notification_preferences

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | FK to profiles |
| notification_type | VARCHAR(60) | Yes | Notification category |
| channel | VARCHAR(30) | Yes | In-app, email or WhatsApp |
| enabled | BOOLEAN | Yes | Preference |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

#### 15.8 notification_delivery_logs

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| notification_id | UUID | Yes | FK to notifications |
| attempt_number | INTEGER | Yes | Delivery attempt |
| provider_reference | VARCHAR(150) | No | External provider reference |
| delivery_status | VARCHAR(20) | Yes | Pending, delivered or failed |
| error_message | TEXT | No | Failure explanation |
| attempted_at | TIMESTAMPTZ | Yes | Attempt timestamp |

Notifications must support deduplication, retry handling, read/unread state and escalation where configured.

---

### 16. Document numbering and offline synchronisation

#### 16.1 document_number_sequences

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| document_type | VARCHAR(60) | Yes | Order, invoice, trip, payment or other |
| location_id | UUID | No | Optional FK to business_locations |
| prefix | VARCHAR(30) | No | Configured prefix |
| suffix | VARCHAR(30) | No | Configured suffix |
| number_format | VARCHAR(100) | Yes | Configured numbering pattern |
| next_number | BIGINT | Yes | Next sequence value |
| padding_length | INTEGER | Yes | Number padding |
| reset_frequency | VARCHAR(20) | Yes | Never, yearly or configured |
| status | VARCHAR(20) | Yes | Active or inactive |

Sequence allocation must be concurrency-safe. Issued numbers must not be reused after cancellation.

#### 16.2 offline_devices

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | FK to profiles |
| device_identifier | VARCHAR(150) | Yes | Device reference |
| device_name | VARCHAR(150) | No | Friendly device name |
| last_sync_at | TIMESTAMPTZ | No | Last successful sync |
| status | VARCHAR(20) | Yes | Active, suspended or revoked |
| registered_at | TIMESTAMPTZ | Yes | Registration timestamp |

Device identifiers must not expose unnecessary personal information.

#### 16.3 offline_sync_sessions

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| device_id | UUID | Yes | FK to offline_devices |
| user_id | UUID | Yes | FK to profiles |
| started_at | TIMESTAMPTZ | Yes | Session start |
| completed_at | TIMESTAMPTZ | No | Completion |
| records_uploaded | INTEGER | Yes | Uploaded count |
| records_downloaded | INTEGER | Yes | Downloaded count |
| records_rejected | INTEGER | Yes | Rejected count |
| status | VARCHAR(25) | Yes | Started, completed, partial or failed |
| error_summary | TEXT | No | Error summary |

#### 16.4 offline_operation_log

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| device_id | UUID | Yes | FK to offline_devices |
| user_id | UUID | Yes | FK to profiles |
| client_operation_id | UUID | Yes | Client-generated idempotency key |
| entity_type | VARCHAR(60) | Yes | Record type |
| local_record_id | UUID | Yes | Local record reference |
| operation_type | VARCHAR(30) | Yes | Create, update or supported action |
| payload | JSONB | Yes | Submitted operation data |
| server_record_id | UUID | No | Server record after acceptance |
| sync_status | VARCHAR(25) | Yes | Pending, accepted, rejected or conflict |
| conflict_details | JSONB | No | Conflict information |
| submitted_at | TIMESTAMPTZ | Yes | Submission timestamp |
| processed_at | TIMESTAMPTZ | No | Processing timestamp |

The `client_operation_id` must be unique within the relevant device or account scope to prevent duplicate processing.

#### 16.5 offline_sync_conflicts

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| offline_operation_id | UUID | Yes | FK to offline_operation_log |
| entity_type | VARCHAR(60) | Yes | Record type |
| entity_id | UUID | No | Server record |
| conflict_type | VARCHAR(40) | Yes | Concurrent update, stale data, permission or validation |
| local_version | JSONB | No | Local submitted version |
| server_version | JSONB | No | Current server version |
| resolution | VARCHAR(30) | Yes | Pending, accepted local, retained server or manually resolved |
| resolved_by | UUID | No | User |
| resolved_at | TIMESTAMPTZ | No | Resolution timestamp |

Offline records must not be represented as officially posted financial or inventory transactions until server validation and successful synchronisation have completed.

Sensitive approvals, payments, stock postings and other controlled financial actions require additional server-side safeguards.

---

### 17. Audit and system controls

#### 17.1 audit_logs

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | No | FK to profiles |
| action | VARCHAR(80) | Yes | Action performed |
| entity_type | VARCHAR(80) | Yes | Record type |
| entity_id | UUID | No | Record ID |
| old_values | JSONB | No | Previous values |
| new_values | JSONB | No | New values |
| reason | TEXT | No | Reason |
| ip_address | INET | No | Request IP where appropriate |
| device_id | UUID | No | FK to offline_devices |
| correlation_id | UUID | No | Related operation identifier |
| created_at | TIMESTAMPTZ | Yes | Event timestamp |

Audit logs must be append-only and protected from normal application modification.

Audit coverage includes:
- Authentication and failed login attempts.
- Role and permission changes.
- Financial and inventory transactions.
- Procurement and pricing changes.
- Approval decisions.
- Document uploads and access-sensitive actions.
- User suspension and deactivation.
- Offline synchronisation and conflict resolution.
- Important administrative configuration changes.

#### 17.2 idempotency_records

Prevents duplicate processing of important operations.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| idempotency_key | VARCHAR(150) | Yes | Unique operation key |
| operation_type | VARCHAR(80) | Yes | Operation category |
| request_hash | VARCHAR(128) | Yes | Request fingerprint |
| response_reference | UUID | No | Resulting record |
| status | VARCHAR(20) | Yes | Processing, completed or failed |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| completed_at | TIMESTAMPTZ | No | Completion timestamp |

Idempotency must be enforced for payment posting, inventory posting, reversals, imports and other operations where duplicate execution could cause financial or operational harm.

---

### 18. Deferred double-entry accounting module

Full double-entry accounting is outside the initial release.

The following tables should be designed as a later accounting phase, not improvised into the operational payment tables.

#### 18.1 chart_of_accounts

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| account_code | VARCHAR(40) | Yes | Unique account code |
| account_name | VARCHAR(150) | Yes | Account name |
| account_type | VARCHAR(30) | Yes | Asset, liability, equity, income or expense |
| parent_account_id | UUID | No | FK to chart_of_accounts |
| status | VARCHAR(20) | Yes | Active or inactive |

#### 18.2 accounting_periods

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| period_name | VARCHAR(80) | Yes | Period name |
| start_date | DATE | Yes | Period start |
| end_date | DATE | Yes | Period end |
| status | VARCHAR(20) | Yes | Open, closed or locked |

#### 18.3 journal_entries

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| journal_number | VARCHAR(60) | Yes | Unique journal number |
| accounting_period_id | UUID | Yes | FK to accounting_periods |
| journal_date | DATE | Yes | Journal date |
| description | TEXT | Yes | Description |
| source_type | VARCHAR(60) | No | Originating transaction |
| source_id | UUID | No | Originating record |
| status | VARCHAR(20) | Yes | Draft, posted or reversed |
| posted_by | UUID | No | Posting user |
| posted_at | TIMESTAMPTZ | No | Posting timestamp |

#### 18.4 journal_entry_lines

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| journal_entry_id | UUID | Yes | FK to journal_entries |
| account_id | UUID | Yes | FK to chart_of_accounts |
| debit_amount | NUMERIC(18,2) | Yes | Debit |
| credit_amount | NUMERIC(18,2) | Yes | Credit |
| description | TEXT | No | Line description |

A posted journal must balance: total debits equal total credits. Posted journals must not be silently edited.

---

### 19. Critical constraints, indexes and relationships

#### 19.1 Unique constraints

At minimum:

- `profiles.auth_user_id`
- `business_locations.location_code`
- `suppliers.supplier_code`
- `supplier_depots.depot_code` within the supplier
- `products.product_code`
- `purchase_orders.po_number`
- `procurement_batches.batch_number`
- `customers.customer_code`
- `sales_orders.order_number`
- `sales_invoices.invoice_number`
- `sales_credit_notes.credit_note_number`
- `transporters.transporter_code`
- `trucks.registration_number`
- `drivers.driver_code`
- `trips.trip_number`
- `incidents.incident_number`
- `financial_transactions.transaction_number`
- `document_number_sequences` for each configured document type and location combination
- `offline_operation_log.client_operation_id` within the appropriate scope
- `idempotency_records.idempotency_key`

#### 19.2 Quantity and financial constraints

- Purchased, reserved, allocated, loaded and delivered quantities must be positive where applicable.
- Signed adjustments are permitted only in controlled adjustment records.
- Monetary amounts must not be negative unless a specific adjustment or credit structure explicitly allows it.
- Truck and compartment capacities must be positive.
- Payment allocations must be positive.
- Allocated payments must not exceed the available verified payment amount.
- Outstanding balances must not become negative without an explicitly supported credit balance.
- A batch cannot be issued beyond its available quantity.
- A compartment cannot be loaded beyond its validated capacity.
- Order-line trip allocations cannot exceed eligible quantities.
- Invoice quantities cannot exceed eligible unbilled quantities.
- A reversal cannot exceed the unreversed original transaction amount.

#### 19.3 Important indexes

Create appropriate indexes for:

- All frequently joined foreign keys.
- Business references and document numbers.
- Supplier, customer, transporter, product, truck and driver codes.
- Invoice, purchase order, trip and payment dates.
- Inventory batch status, product, location and receipt date.
- FIFO batch selection fields.
- Active reservations and reservation expiry.
- Payment allocation target fields.
- Approval status and assigned approver.
- Trip status, departure and expected arrival.
- Notification recipient, status and creation date.
- Audit entity type, entity ID and timestamp.
- Offline device, sync status and submitted timestamp.
- Effective dates on pricing, contracts and compensation records.

Index design must be validated against actual query patterns rather than adding indexes indiscriminately.

#### 19.4 Deletion rules

Financial, inventory, payment, invoice, delivery, approval and audit history must not be deleted through ordinary user operations.

Use:
- `RESTRICT` for important historical references.
- `CASCADE` only for safe draft dependencies and suitable junction records.
- Reversal or archival workflows for posted transactions.
- Soft deactivation for master records no longer in use.

---

### 20. Critical integrity and transaction rules

#### 20.1 Procurement and quantity integrity

1. Every procurement batch must identify its supplier, supplier depot and product.
2. Supplier quantity, loading quantity and received quantity must be recorded independently.
3. Storage inventory is based on verified received quantity.
4. Direct customer fulfilment uses customer-confirmed receipt quantity.
5. A direct-to-customer procurement batch must not create artificial storage inventory.
6. Quantity differences must be calculated and investigated.
7. A discrepancy must not automatically become a confirmed loss or liability.

#### 20.2 Inventory integrity

1. Purchase orders do not create stock.
2. Only actual receipts into Deuces-controlled storage create inventory batches.
3. Direct fulfilment does not create a warehouse receipt and subsequent warehouse issue.
4. Reservations do not reduce physical stock.
5. Actual posted issues reduce stock.
6. FIFO allocations must reference actual inventory issue movements.
7. Concurrent issues must be protected by transaction locks or equivalent database-safe controls.
8. A batch cannot be consumed beyond its available quantity.
9. Stock movements must be traceable to source records.
10. Reversals must reference original movements.

#### 20.3 Landed-cost integrity

1. Acquisition cost must not be counted twice.
2. Inbound procurement transport must be separate from outbound customer delivery haulage.
3. Only configured landed-cost categories enter inventory or direct procurement cost.
4. Cost allocations must reconcile to source cost components.
5. Later cost adjustments require approval and an auditable impact record.
6. Historical landed-cost snapshots must not be silently rewritten.

#### 20.4 Sales and pricing integrity

1. Confirmed selling prices must be preserved on sales order items.
2. Current price changes must not alter historical orders.
3. Price overrides must follow configured approval thresholds.
4. Credit limits and overdue balances must be checked before order confirmation according to the customer's credit policy.
5. Customer payment status and delivery status must remain separate.
6. Partial delivery and partial invoicing must be supported.
7. Sales revenue, delivery revenue and product cost must be distinguishable.

#### 20.5 Payment integrity

1. Payment records must preserve the original payment event.
2. Payments requiring verification must not be allocated before verification.
3. POS payments may remain pending until settlement.
4. Allocation totals must not exceed the available payment amount.
5. Customer receipts and supplier payments must use appropriate allocation relationships.
6. Reversals must be compensating records, not deletion or overwriting.
7. Outstanding balances must reconcile to invoices, credit notes, payments and reversals.
8. Payment posting must be idempotent.

#### 20.6 Transporter and driver integrity

1. Dispatch manually selects the transporter.
2. The system may display cost, capacity, reliability, availability and performance.
3. Truck and driver availability must be checked to prevent double-booking.
4. Third-party drivers are not automatically Deuces employees.
5. Transporter haulage fees normally include the third-party driver's compensation.
6. A separate Deuces driver salary or allowance must exist only where an actual Deuces obligation has been established.
7. Driver advances, salary and trip allowances must remain separate.
8. Driver deductions require documented approval.

#### 20.7 Trip and delivery integrity

1. A trip requires a valid primary truck and driver before loading.
2. A trip may carry multiple orders.
3. An order may be fulfilled by multiple trips.
4. Order-line allocation must be maintained at the appropriate level.
5. Loading must reconcile with compartment capacity.
6. A compartment may be supplied by multiple batches where supported.
7. Deliveries must link to the relevant order-line allocation and loading record.
8. Partial, rejected, disputed and failed deliveries must be supported.
9. Mandatory delivery evidence must be captured.
10. A trip cannot close while mandatory reconciliation remains incomplete.

#### 20.8 Profitability integrity

1. Estimated profitability must be distinguishable from actual profitability.
2. Historical snapshots must be versioned and retained.
3. Product margin must be reported separately from delivery contribution.
4. Inbound procurement cost and outbound delivery cost must not be double-counted.
5. Shared trip expenses must use an explicit allocation method.
6. Operational profitability must not be presented as a complete statutory profit-and-loss statement.

#### 20.9 Offline integrity

1. Offline operations must have unique client-generated operation identifiers.
2. Duplicate submissions must not create duplicate business records.
3. Server-side validation is mandatory before official posting.
4. Conflicts must be recorded and resolved explicitly.
5. Financial posting must not be assumed successful merely because a device saved a local record.
6. Access permissions must be revalidated during synchronisation.
7. Sensitive operations require additional safeguards.

---

### 21. Reporting and operational visibility

The schema must support:

- Procurement and supplier performance.
- Supplier quantity versus loading and received quantity.
- Procurement cost and landed cost per litre.
- Inventory on hand, reserved and available quantities.
- FIFO inventory valuation.
- Sales orders and fulfilment status.
- Customer outstanding balances and credit utilisation.
- Sales revenue and product gross margin.
- Delivery revenue and delivery contribution.
- Trip performance and reconciliation.
- Transporter rate and performance comparisons.
- Supplier and transporter liabilities.
- Customer receipts and supplier payments.
- Cash, bank and POS tracking.
- Operating expenses.
- Driver compensation where applicable.
- Incident and compliance monitoring.
- Location-level and consolidated company reporting.

Reports must support on-demand, daily, weekly and monthly scheduling where configured, with PDF, Excel and CSV exports.

Report access must follow role and location permissions.

---

### 22. Technical implementation controls

#### 22.1 Transactional posting

The following operations must execute through controlled database transactions:

- Procurement receipt posting.
- Inventory receipt posting.
- Inventory issue and FIFO allocation.
- Stock transfer posting.
- Payment posting and allocation.
- Payment reversal.
- Invoice posting.
- Credit note posting.
- Landed-cost adjustment.
- Trip reconciliation completion.
- Other operations that affect financial or inventory balances.

A failed transaction must not leave partially updated financial or inventory records.

#### 22.2 Server-side calculations

Financial and inventory calculations must be performed by trusted server-side application services or database procedures.

The frontend may display estimates and calculations for usability, but it must not be the authoritative source for posted financial values.

#### 22.3 Concurrency

The implementation must prevent:
- Two users issuing the same available stock.
- Two dispatchers booking the same truck for overlapping trips.
- Two users allocating the same remaining payment balance.
- Duplicate invoice or transaction numbering.
- Duplicate offline transaction submission.
- Concurrent approval or posting of the same transaction.

Use database constraints, appropriate row locking, transaction isolation and idempotency controls.

#### 22.4 Security

- Supabase Auth manages authentication.
- Supabase Row Level Security protects business records.
- Role-based permissions govern actions.
- Location-level access restrictions are enforced.
- Sensitive files use private storage and authorised access.
- Service-role credentials must never be exposed in the browser.
- Audit records must be protected from ordinary modification.
- Employee exit requires immediate account deactivation and reassignment of outstanding tasks and approvals.

#### 22.5 Backup and retention

- Use automated database backups and secure document backups.
- Maintain appropriate backup retention.
- Perform periodic restoration tests.
- Preserve financial, operational and audit history.
- Archive older records without destroying required history.
- Apply applicable Nigerian statutory retention requirements.

---

### 23. Important open decisions before SQL generation

The following items remain open and must not be silently invented by the development agent.

| Area | Outstanding decision |
|---|---|
| Petroleum measurement | Final quantity precision and measurement basis |
| Temperature correction | Whether and how temperature/density correction applies |
| Measurement tolerances | Approved shortage and excess tolerances by product or transaction |
| Reservation timing | Exact point at which stock is reserved and released |
| Direct fulfilment | Final accounting treatment and cost recognition for supplier-to-customer procurement |
| Landed-cost adjustments | Detailed allocation between remaining inventory and previously consumed stock |
| Revenue recognition | Exact trigger for recognising operational revenue |
| Invoicing | Rules for partial delivery, cancellation, credit notes and corrections |
| Offline conflicts | Final conflict-resolution policy by transaction type |
| Multiple locations | Final location hierarchy and permissions |
| Approval thresholds | Exact monetary, margin and risk thresholds |
| Documents | Maximum file sizes, retention and version policy |
| Third-party liabilities | Final process for transporter invoice disputes and confirmed claims |
| Operational tolerances | Final measurement and reconciliation standards validated by petroleum operations expertise |

These decisions must be documented and approved before the affected logic is finalised in SQL.

---

### 24. Implementation phases

| Phase | Scope |
|---|---|
| Phase 1 | Database foundation, authentication, roles, permissions, locations and audit |
| Phase 2 | Suppliers, products, procurement, quantity reconciliation and landed costs |
| Phase 3 | Sales, pricing, customers, credit controls and invoicing |
| Phase 4 | Transporters, trucks, drivers, trips, loading and delivery |
| Phase 5 | FIFO inventory, reservations, issues and stock movements |
| Phase 6 | Payments, receivables, payables, expenses and operational profitability |
| Phase 7 | Documents, reports, notifications, imports and offline synchronisation |
| Phase 8 | Advanced analytics, GPS integration and future fleet expansion |
| Later phase | Full double-entry accounting and statutory financial statements |

The implementation sequence may be adjusted where dependencies require it, but financial and inventory integrity must not be compromised.

---

### 25. Final database design principles

The Deuces database must preserve these essential relationships:

- Every procurement batch identifies its supplier, supplier depot and product.
- Every procurement batch preserves supplier, loading and received quantities.
- Every storage inventory batch identifies its source and landed cost.
- Direct customer fulfilment does not create artificial warehouse stock.
- Every inventory reservation is separate from an actual issue.
- Every FIFO allocation identifies the batch actually consumed.
- Every sales order item preserves its confirmed selling price.
- Every order-line allocation to a trip is traceable.
- Every delivery is linked to its trip, order allocation and loading record.
- Every trip preserves its historical truck, driver and transporter assignment.
- Every transporter invoice and payment is traceable.
- Every customer receipt and supplier payment is traceable to its allocations.
- Every payment reversal preserves the original payment.
- Every cost adjustment preserves its original and revised financial impact.
- Every profitability snapshot preserves its calculation basis and version.
- Every important approval and correction has an audit record.
- Every offline operation is identifiable and protected against duplicate posting.

**The database is the financial and operational foundation of Deuces. It must preserve evidence, prevent duplication, support reliable reconciliation and make every important transaction traceable.**

**Document status: Detailed Database Dictionary v1.1 – Revised Review Draft.**

**This document is not yet approval for SQL generation. The next step is a consistency review against the PRD, Technical Blueprint, ERD and Business Rules & Financial Logic Specification, followed by closure of the critical open decisions.**
