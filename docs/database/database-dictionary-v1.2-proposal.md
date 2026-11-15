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
| Version | 1.2 proposal — review revision 3 (owner-approved review baseline) |
| Status | Owner-approved review baseline. Authorised for Migration 1 drafting; **not** physical-schema approval and **not** SQL approval. |
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
| Authorised for migration drafting | Product owner | 2026-11-15 | Conditional on DR-10 and DR-24 |

**Approval basis:** the product owner approved this review pack in the project conversation on 2026-11-15. Because the original ERD artefact was not available, ERD approval applies to the reconstructed proposal and must be re-verified if the original is produced. Approval authorises drafting Migration 1 against this dictionary; it does not approve physical types, constraints, policies or SQL, and it does not close DR-10, DR-20 or DR-24.

## 0. Read this before using the document

This is a **consolidated review proposal**, not an approved physical schema and not permission to create SQL or migrations.

The detailed v1.1 field-level dictionary supplied to the project is reproduced below as the baseline. Its field definitions are retained without alteration; only heading levels and transport formatting were normalised in this presentation.

**Provenance must be confirmed.** The version, date and completeness of the v1.1 baseline have not been verified against an owner-signed original. Before this document is used as an approval baseline, the product owner must confirm it matches the authoritative Detailed Database Dictionary v1.1. If it does not, the appendix must be replaced rather than amended, and any already-approved v1.2 amendment re-checked against the corrected baseline.

The original ERD v1.2 source artefact was **not located in the current repository or the accessible Library material during this preparation**. The companion ERD file is therefore a reconstructed logical proposal based on the v1.1 dictionary, the repository reconciliation report and the v1.2 amendment specification. It must be compared against the original owner-supplied ERD before final approval.

### Decision status

- D-001 to D-005 are recorded as approved logical decisions in the reconciliation report and decision register.
- DR-16 (canonical naming) and DR-25 (greenfield) are **Approved** as of 2026-11-15; see the Decision Register.
- DR-20, DR-24 and DR-10 remain **Open** in the current decision register. Nothing in this proposal changes those statuses.
- Every field marked **Proposed / owner review** is a candidate, not an approved column.
- Every ownership classification marked **Open — DR-24** remains unresolved.
- No SQL, migration, seed data, RLS policy or database change is authorised by this document.

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

- **Status:** Proposed; requires DR-24 closure and field-level owner approval.
- The existing `id` must not be assumed to equal `organisations.id` without inspection and explicit approval.
- Confirm whether the relationship is one-to-one and whether the FK should be the primary key or a separate unique column.
- Keep business configuration fields (currency, timezone, costing preferences, offline setting) on `business_settings`; do not use them as tenant identity.

### 3.3 `business_locations` — existing v1.1 location entity

The complete v1.1 field list is retained in the baseline section below.

**Proposed amendment:** add `organisation_id UUID` as a direct tenant owner reference. This is a candidate only; DR-24 remains Open.

The location hierarchy/type question is DR-10 and remains Open. The current v1.1 `location_type` and `is_storage_location` fields remain baseline definitions; do not add parent-location, inherited-access or new location-type columns until DR-10 is approved.

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

**Status:** Required by the v1.2 amendment specification; physical field approval and DR-24 ownership mapping remain pending.

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

### 3.9 Approval structures — DR-20 remains Open

The v1.1 dictionary contains `approval_records`; the ERD/reconciliation material refers to `approval_rules` and `approval_requests`.

No physical field definitions are proposed for `approval_rules` or `approval_requests` in this draft because the owner has not decided whether Milestone 1 needs a full rule/request/decision split, a single record model or deferred approvals.

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

## 4. Tenant ownership and RLS classification register — DR-24 remains Open

D-002 establishes `organisations` as the tenant root and D-005 establishes the principle of platform-global reference data. Neither decision finalises the exact per-table ownership map or RLS predicates.

The following inventory is extracted from the v1.1 dictionary's table headings. It is intentionally **not** a proposed ownership approval.

| Existing v1.1 table | Current classification |
|---|---|
| `business_settings` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `business_locations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `profiles` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `roles` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `permissions` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `role_permissions` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `user_roles` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `user_location_access` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `approval_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `suppliers` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `supplier_depots` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `supplier_depot_bays` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `products` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `supplier_products` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `purchase_orders` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `purchase_order_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `procurement_batches` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `cost_categories` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `procurement_cost_components` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `cost_allocations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `procurement_cost_adjustments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_cost_adjustments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_batches` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_reservations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_reservation_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_issues` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_movements` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `fifo_allocations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `inventory_adjustments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `stock_transfers` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `stock_transfer_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `customers` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `customer_locations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `product_selling_prices` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `customer_product_prices` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `pricing_rules` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_orders` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_order_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `pricing_approvals` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_invoices` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_invoice_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_credit_notes` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_credit_note_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `customer_credit_reviews` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `sales_profitability_snapshots` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_profitability_snapshots` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `profitability_snapshot_allocations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `transporters` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `transporter_contracts` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `transporter_rate_cards` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `transporter_invoices` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `employees` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `drivers` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_documents` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_compensation_profiles` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_compensation_history` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_salary_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_trip_allowances` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_advances` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `driver_expense_retirements` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trucks` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_ownership_history` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_compartments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `compartment_calibrations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `compartment_seals` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_documents` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_assignments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_maintenance_history` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_fuel_logs` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_odometer_logs` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_tyre_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `truck_parts_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trips` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_assignments` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_sales_orders` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_sales_order_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_loading_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_loading_batch_allocations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_delivery_records` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `delivery_evidence` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_expenses` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_reconciliations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `trip_reconciliation_items` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `delivery_discrepancies` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |
| `discrepancy_investigations` | Existing v1.1 entity | **Open — DR-24**; direct vs inherited tenant ownership and exact RLS scope must be approved. |

Before any tenant SQL is written, the owner must approve, table by table:
1. direct `organisation_id` ownership;
2. inherited ownership through a specific parent FK, including how the DB prevents cross-tenant parent references;
3. platform-global ownership;
4. external-party/location data that is not owned by a PetroCore tenant but may be referenced by tenant records;
5. location scope and whether a row is location-bound, tenant-wide or not location-scoped;
6. exact RLS read/write predicates and trusted server-side access paths.

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
- DR-10 location model and hierarchy.
- DR-11 approval thresholds.
- DR-12 document limits, retention and versioning.
- DR-13 transporter disputes and liability.
- DR-14 operational reconciliation tolerances.
- DR-17 quantity model and measurement event history.
- DR-18 delivery confirmation model.
- DR-19 discrepancy model.
- DR-20 approval model.
- DR-21 cost-allocation target FK model.
- DR-22 transporter invoice header `trip_id` authority/compatibility.
- DR-23 payment event model.
- DR-24 tenant/location ownership coverage and RLS model.

**Approved and therefore not listed above:** D-001 to D-005, DR-16 (retain v1.1 canonical names) and DR-25 (greenfield). DR-10, DR-20 and DR-24 still gate Migration 1.

## 7. Required approval and implementation sequence

1. ~~Resolve DR-25 (greenfield) and DR-16 (canonical names).~~ **Approved 2026-11-15.**
2. Product owner resolves DR-10 (location types/hierarchy) and DR-24 (tenant ownership coverage/RLS).
3. Product owner resolves DR-20 if approval is required in the tenant/access milestone.
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

---

# Appendix A — Detailed Database Dictionary v1.1 baseline (retained verbatim)

**Provenance:** supplied to the project as the Detailed Database Dictionary v1.1 (Revised Review Draft). Field definitions are reproduced without alteration; heading levels and transport formatting are normalised, the pasted transport brackets are removed, and the two separate title lines are combined into one heading.

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
