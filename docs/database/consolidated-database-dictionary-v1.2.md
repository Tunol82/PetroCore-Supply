> **Repository context:** This source specification is retained with its original title and technical wording. The product in this repository is **PetroCore Supply**; **Deuces is a tenant/customer company** using the product. The document status below remains **Controlled implementation review draft**. It does not, by itself, authorise production SQL or migrations.

---

# DEUCES SUPPLY, HAULAGE & DELIVERY MANAGEMENT SYSTEM
## Consolidated Database Dictionary v1.2 – Implementation Specification

**Document status:** Controlled implementation review draft  
**Baseline:** Detailed Database Dictionary v1.1  
**Related design:** ERD v1.2, Technical Blueprint v1.0, PRD v2.1, Business Rules & Financial Logic Specification v1.0  
**Purpose:** Establish a consistent, implementation-ready database design for the Deuces platform.

---

## 1. Purpose and document authority

This document establishes the database changes and implementation controls required to advance the Deuces database from v1.1 to v1.2.

The existing v1.1 tables and field definitions remain the baseline unless expressly amended here. This is a controlled amendment, not permission to discard existing fields or redesign unrelated modules.

The development team must preserve:
- Existing business relationships that remain valid.
- Original field meanings and business rules.
- Historical transaction traceability.
- Financial and inventory integrity.
- The distinction between direct customer fulfilment and warehouse inventory.

**Important:** This specification does not authorise production SQL generation until the final field-level dictionary, ERD and migration plan have been reconciled and approved.

## 2. Non-negotiable database standards

| Area | Standard |
|---|---|
| Primary keys | UUID |
| Money | NUMERIC(18,2) |
| Rates | NUMERIC(18,4) |
| Quantities | NUMERIC(18,3), subject to approved measurement policy |
| Currency | NGN for initial release |
| Date/time | TIMESTAMPTZ for event timestamps; DATE for calendar dates |
| Flexible configuration | JSONB only where structured relational fields are unsuitable |
| Authentication | Supabase Auth |
| Access control | Roles, permissions, location access and Row Level Security |
| Financial calculations | Trusted server-side services or database procedures |
| Transaction posting | Atomic database transactions |
| Duplicate protection | Unique constraints and idempotency |
| Historical records | Reversal, correction or archival; no ordinary deletion |

All monetary and quantity calculations must use appropriate decimal arithmetic. Do not use floating-point values for authoritative financial or inventory calculations.

## 3. Required v1.2 schema amendments

### 3.1 Procurement-to-sales traceability

**Existing table:** `procurement_batches`

Add or verify:

| Field | Type | Required | Purpose |
|---|---|---|---|
| sales_order_item_id | UUID | No | Identifies the specific customer order line supplied by this procurement batch |
| procurement_order_item_id | UUID | No | Explicit reference to the originating purchase order item, if not already represented by `purchase_order_item_id` |

The existing `purchase_order_item_id` should be retained if it already serves the second purpose. Do not create a duplicate field merely because the proposed name differs.

The `sales_order_id` field must also remain where required for compatibility and order-level traceability.

Rules:
- A procurement batch must identify its supplier, supplier depot and product.
- A customer-linked procurement batch must identify the relevant sales order line.
- A warehouse procurement batch must not be assigned to a customer order unless the business workflow explicitly supports that allocation.
- A direct-fulfilment batch must not create warehouse stock.
- Supplier, loading and received quantities must remain separate.

### 3.2 Separate direct fulfilment from warehouse inventory

The database must support two distinct fulfilment paths.

**Warehouse fulfilment**

Supplier procurement → verified receipt into Deuces-controlled storage → inventory batch → reservation → FIFO issue → trip loading → customer delivery.

**Direct fulfilment**

Supplier procurement → loading → customer delivery → customer-confirmed receipt.

The direct path must not create an artificial inventory receipt followed by an artificial inventory issue.

Add:

#### `trip_loading_procurement_allocations`

| Field | Type | Required | Purpose |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| trip_loading_record_id | UUID | Yes | FK to trip_loading_records |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| product_id | UUID | Yes | FK to products |
| allocated_quantity | NUMERIC(18,3) | Yes | Quantity loaded from the direct procurement batch |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| created_by | UUID | Yes | User responsible |

This table records direct procurement loading without creating a warehouse inventory movement.

The existing `trip_loading_batch_allocations` must be reconciled with this design. Do not maintain two competing sources of truth for the same loading allocation.

**Migration recommendation:** retain the existing table during migration, move valid procurement-source records into the dedicated table, verify quantities and references, then deprecate the old table only after successful reconciliation.

### 3.3 Direct fulfilment cost allocation

Add:

#### `direct_fulfilment_cost_allocations`

| Field | Type | Required | Purpose |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| procurement_batch_id | UUID | Yes | FK to procurement_batches |
| sales_order_item_id | UUID | Yes | FK to sales_order_items |
| cost_component_id | UUID | No | FK to procurement_cost_components, where applicable |
| expense_record_id | UUID | No | FK to expense_records, where applicable |
| cost_category_id | UUID | No | FK to cost_categories, where applicable |
| allocated_amount | NUMERIC(18,2) | Yes | Allocated cost |
| allocation_method | VARCHAR(40) | Yes | Approved allocation method |
| allocation_basis | JSONB | No | Calculation evidence |
| allocation_version | INTEGER | Yes | Version of the allocation |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| created_by | UUID | Yes | User |

Rules:
- Direct procurement costs must be traceable to the relevant procurement batch and sales order item.
- Outbound customer delivery haulage must remain separate from inbound procurement cost.
- A cost must not be counted twice.
- The final accounting recognition treatment remains subject to the open decision in Section 8.
- Historical allocations must not be silently overwritten. Corrections must preserve the original and revised calculation basis.

### 3.4 Landed-cost allocation integrity

The v1.1 `cost_allocations` design must be checked carefully because it can refer to more than one cost destination.

A generic allocation table with multiple optional target IDs can create ambiguous relationships.

For v1.2:
- Retain `cost_allocations` only if its purpose and target are unambiguous.
- Use dedicated allocation tables where different destination types require different foreign keys and validation.
- Do not use an unrestricted polymorphic target as a substitute for relational integrity.
- Ensure that procurement cost components reconcile to their allocation records.
- Preserve approved historical landed-cost snapshots.

Where inventory allocation and direct fulfilment allocation are separate, use separate typed relationships.

### 3.5 Transporter invoices

The v1.1 `transporter_invoices` table supports an optional `trip_id`. This is insufficient where one transporter invoice covers multiple trips.

Add:

#### `transporter_invoice_items`

| Field | Type | Required | Purpose |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| transporter_invoice_id | UUID | Yes | FK to transporter_invoices |
| trip_id | UUID | Yes | FK to trips |
| description | TEXT | No | Invoice line description |
| quantity | NUMERIC(18,3) | No | Charge quantity, where applicable |
| rate | NUMERIC(18,4) | No | Agreed rate, where applicable |
| amount | NUMERIC(18,2) | Yes | Line amount |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |

Rules:
- A transporter invoice may contain multiple trip items.
- Each invoice item must reference a valid trip.
- Invoice totals must reconcile to the sum of valid invoice items, subject to separately identified adjustments.
- The transporter invoice remains the authoritative invoice header.
- Existing `trip_id` may be retained for legacy or single-trip compatibility, but must not become a competing source of truth.

The existing `transporter_payment_allocations` table in v1.1 must be retained. It already provides the required relationship between transporter payments and transporter invoices. Do not create a duplicate allocation table.

### 3.6 Transporter payments and liabilities

Retain the existing:
- `payment_records`
- `transporter_payment_allocations`
- `accounts_payable`
- `payment_reversals`

Enforce:
- Outbound payment direction for transporter payments.
- Correct transporter ownership of the invoice and liability.
- Positive allocations.
- No allocation beyond available verified and settled payment funds.
- No allocation beyond the outstanding invoice liability.
- Reversal through compensating records, not deletion.

### 3.7 Employees, drivers and transporters

Retain the v1.1 `employees`, `drivers` and `transporters` entities.

Verify that `drivers` supports:
- `transporter_id` for third-party drivers.
- `employee_id` where the driver is a Deuces employee.
- `driver_type` to distinguish the relationship.
- An active/inactive status.

Do not assume that a third-party driver's compensation is a Deuces payroll obligation.

Transporter haulage fees normally include the third-party driver's compensation. A separate Deuces salary or allowance must only be recorded where an actual Deuces obligation exists.

The system must not automatically create payroll records for transporter-provided drivers.

### 3.8 Expenses and trip expenses

Retain the distinction between:
- `expense_records` for general business expenses and their cost treatment.
- `trip_expenses` for costs specifically attributable to a trip.

The same expense must not be recorded in both tables as two independent costs.

Where an expense is linked to a trip, the application must establish its authoritative source record and allocation treatment.

The system must distinguish:
- Operating expenses.
- Inbound landed costs.
- Outbound delivery costs.
- Trip-specific expenses.
- Driver compensation where applicable.

### 3.9 Products and master data

Retain `products` as the canonical product master.

PMS, AGO and DPK must be supported initially, while allowing authorised future product configuration.

Product codes must be unique within the agreed business scope.

Product-specific measurement rules must remain configurable. Do not embed unapproved density, temperature correction or petroleum conversion assumptions in the database.

### 3.10 Receivables and payables

Retain:
- `accounts_receivable`
- `accounts_payable`
- `invoice_payment_allocations`
- `supplier_payment_allocations`
- `transporter_payment_allocations`

These tables must not become independently editable financial balances.

The authoritative balance must reconcile to:
- Posted invoices.
- Posted credit notes.
- Valid payment allocations.
- Approved adjustments.
- Reversals and corrections.

If receivable and payable balance tables are maintained for performance, they must be controlled projections or reconciled summaries generated from authoritative transactions.

Do not allow users to manually overwrite outstanding balances without a controlled adjustment process and audit record.

### 3.11 Payment allocation relationships

Retain the separate typed allocation tables:

- `invoice_payment_allocations`
- `supplier_payment_allocations`
- `transporter_payment_allocations`

This is preferable to one unrestricted polymorphic payment allocation table.

Enforce the correct payment direction and party relationship in server-side validation and, where possible, database constraints.

A POS payment remains pending until settlement is confirmed.

### 3.12 Profitability snapshots

Retain:
- `sales_profitability_snapshots`
- `trip_profitability_snapshots`
- `profitability_snapshot_allocations`

The snapshots must distinguish:
- Estimated profitability.
- Actual profitability.
- Product gross margin.
- Delivery contribution.
- Shared trip expense allocations.

Each snapshot must preserve its calculation version, source references and calculation basis.

A revised calculation must create a new version or controlled replacement record. Historical reports must not silently change because a current cost or price was edited.

### 3.13 Documents, imports, reports and offline controls

Retain the v1.1 platform tables for:
- Documents and document links.
- Document requirements.
- Data import jobs and errors.
- Report definitions, views and schedules.
- Notifications and delivery logs.
- Document number sequences.
- Offline devices, sync sessions, operation logs and conflicts.
- Audit logs and idempotency records.

Before SQL generation, verify that:
- Required foreign keys exist.
- Polymorphic references have explicit application validation.
- Private files are protected by authorised access.
- Offline operation IDs are unique within their defined scope.
- Financial and inventory operations are not officially posted until server validation succeeds.
- Number allocation is concurrency-safe.
- Audit records cannot be edited through ordinary application operations.

## 4. Critical relational and database constraints

The following constraints must be enforced through database constraints, unique indexes, transactions or trusted application services.

### 4.1 Procurement

- A procurement batch must reference a valid supplier, depot and product.
- A purchase order does not create inventory.
- Supplier, loading and received quantities must be stored independently.
- A direct fulfilment batch must not create a warehouse inventory batch.
- A customer-linked procurement batch must be traceable to its relevant order line.

### 4.2 Inventory

- Only verified receipts into Deuces-controlled storage create inventory.
- Reservations do not reduce physical stock.
- Posted issues reduce available stock.
- FIFO allocations must reference actual inventory issue movements.
- No negative stock by default.
- Concurrent stock issues must be transaction-safe.
- Reversals must reference the original movement.

### 4.3 Payments

- Payment allocations must be positive.
- Allocation cannot exceed the available verified and settled payment amount.
- Allocation cannot exceed the eligible outstanding liability.
- Reversals cannot exceed the unreversed original amount.
- Original payment history must remain available.
- Posting must be idempotent.

### 4.4 Sales and invoicing

- Confirmed order-line prices must be preserved.
- Historical orders must not change when current prices change.
- Invoice quantities must not exceed eligible unbilled quantities.
- Partial invoicing and credit notes must be supported.
- Revenue, product cost and delivery contribution must remain distinguishable.

### 4.5 Transport and delivery

- A truck cannot be booked for overlapping trips.
- A driver cannot be assigned to overlapping trips.
- A compartment cannot exceed its validated capacity.
- An order may be fulfilled by multiple trips.
- A trip may carry multiple orders.
- Delivery records must be traceable to the relevant order-line allocation and loading record.
- A trip cannot close with mandatory reconciliation incomplete.

### 4.6 Historical integrity

Posted financial, inventory, delivery, approval and audit records must not be deleted through normal application operations.

Use:
- RESTRICT for important historical references.
- CASCADE only for safe draft dependencies and appropriate junction records.
- Reversal or correction workflows for posted transactions.
- Soft deactivation for master records no longer in use.

## 5. Required database-level safeguards

The development implementation must include:

1. Unique constraints for business references and document numbers.
2. Foreign keys for relational references.
3. Check constraints for positive quantities, rates and amounts where appropriate.
4. XOR or equivalent validation where exactly one source relationship is permitted.
5. Unique idempotency keys within the correct scope.
6. Concurrency-safe document numbering.
7. Transaction-safe inventory posting and FIFO allocation.
8. Transaction-safe payment allocation and reversal.
9. Appropriate indexes based on actual query patterns.
10. Row Level Security for business records.
11. Location-level access enforcement.
12. Append-only audit protection.
13. Private document storage and controlled file access.
14. Automated backups and tested restoration procedures.

## 6. Tables already present in v1.1 that must not be duplicated

The following functionality already exists in the supplied v1.1 dictionary and should be retained rather than recreated under new names:

| Functionality | Existing v1.1 tables |
|---|---|
| Employee master | employees |
| Driver master | drivers |
| Product master | products |
| Trip profitability | trip_profitability_snapshots |
| General expenses | expense_records |
| Trip expenses | trip_expenses |
| Customer receipts | invoice_payment_allocations |
| Supplier payments | supplier_payment_allocations |
| Transporter payments | transporter_payment_allocations |
| Customer receivables | accounts_receivable |
| Supplier/transporter payables | accounts_payable |
| Payment reversals | payment_reversals |
| Audit history | audit_logs |
| Offline duplicate prevention | offline_operation_log, idempotency_records |

This prevents duplicate tables and competing sources of truth.

## 7. Migration sequence

The database must be migrated incrementally. Do not replace the existing schema in one destructive operation.

### Migration 1 – Baseline verification
- Inspect the existing database schema.
- Compare actual tables and columns with v1.1.
- Record differences.
- Identify existing data and relationships.
- Produce a backup before schema changes.

### Migration 2 – Procurement traceability
- Add missing order-line references where necessary.
- Verify procurement batch relationships.
- Validate direct and warehouse fulfilment classifications.

### Migration 3 – Loading allocation
- Add `trip_loading_procurement_allocations`.
- Migrate valid direct procurement loading records.
- Reconcile migrated quantities.
- Preserve original records until validation is complete.

### Migration 4 – Direct fulfilment costs
- Add `direct_fulfilment_cost_allocations`.
- Establish approved source relationships.
- Do not activate unapproved cost-recognition rules.

### Migration 5 – Transporter invoices
- Add `transporter_invoice_items`.
- Reconcile existing single-trip invoices.
- Validate invoice header totals against line totals.

### Migration 6 – Financial integrity
- Verify payment direction and party relationships.
- Validate payment allocation totals.
- Verify receivable and payable reconciliation.
- Verify reversal handling.

### Migration 7 – Supporting controls
- Verify documents, reports, imports, notifications, numbering, offline and audit relationships.
- Add missing indexes and constraints.
- Validate access controls.

### Migration 8 – Acceptance testing
- Run the database acceptance scenarios.
- Reconcile test balances and quantities.
- Obtain approval before production deployment.

Every migration must be version-controlled, repeatable, documented and reversible where technically possible.

## 8. Open decisions that must not be invented

These remain business decisions and must be resolved by the appropriate Deuces business or petroleum operations authority before the affected logic is finalised.

| Decision | Required resolution |
|---|---|
| Measurement basis | Confirm quantity precision and measurement basis |
| Temperature correction | Confirm whether correction applies and the approved method |
| Measurement tolerances | Approve shortage and excess tolerances |
| Reservation timing | Define when stock is reserved and released |
| Direct fulfilment cost recognition | Approve the financial treatment |
| Landed-cost adjustments | Define treatment of costs relating to consumed and remaining inventory |
| Revenue recognition | Approve the operational revenue trigger |
| Partial invoicing | Confirm rules for partial delivery, cancellation and credit notes |
| Offline conflicts | Approve resolution policy by transaction type |
| Location hierarchy | Confirm location structure and access rules |
| Approval thresholds | Approve monetary, margin and risk thresholds |
| Document policy | Confirm file limits, retention and version policy |
| Transporter disputes | Confirm dispute and liability treatment |
| Reconciliation tolerances | Approve operational standards |

These decisions must be recorded in a controlled business rules register. Development must not silently invent them.

## 9. Database acceptance tests

The following scenarios must pass before the database is accepted.

| ID | Scenario | Expected result |
|---|---|---|
| DB-001 | Create procurement batch | Supplier, depot and product references validated |
| DB-002 | Record different supplier, loading and received quantities | All three quantities preserved |
| DB-003 | Receive product into Deuces storage | Inventory batch created only after verified receipt |
| DB-004 | Direct supplier-to-customer fulfilment | No artificial warehouse inventory created |
| DB-005 | Allocate direct procurement to an order line | Traceable procurement-to-order relationship |
| DB-006 | Load direct procurement onto a trip | Direct loading allocation recorded |
| DB-007 | Allocate inbound procurement costs | Allocation reconciles to source cost components |
| DB-008 | Allocate direct fulfilment costs | Cost traceable without artificial inventory movement |
| DB-009 | Reserve warehouse stock | Physical stock remains unchanged |
| DB-010 | Issue warehouse stock | Available quantity reduced through a posted movement |
| DB-011 | Concurrent inventory issues | No over-issue or negative stock |
| DB-012 | Apply FIFO | Actual consumed batches are identified |
| DB-013 | Create transporter invoice for multiple trips | Invoice items identify each trip |
| DB-014 | Allocate transporter payment | Payment and invoice relationships validated |
| DB-015 | Allocate customer receipt | Inbound payment allocated to eligible customer invoices |
| DB-016 | Allocate supplier payment | Outbound payment allocated to eligible supplier liability |
| DB-017 | Reverse payment | Original payment preserved and reversal recorded |
| DB-018 | Attempt duplicate payment posting | Duplicate prevented |
| DB-019 | Attempt duplicate offline submission | Duplicate business record prevented |
| DB-020 | Attempt unauthorised location access | Access denied |
| DB-021 | Edit posted historical transaction | Ordinary modification blocked |
| DB-022 | Recalculate profitability | New version retained; historical snapshot preserved |
| DB-023 | Close trip with missing mandatory reconciliation | Closure blocked |
| DB-024 | Allocate beyond payment balance | Allocation rejected |
| DB-025 | Load beyond compartment capacity | Loading rejected |
| DB-026 | Invoice more than eligible unbilled quantity | Invoice posting rejected |
| DB-027 | Book overlapping truck assignment | Conflicting assignment rejected |
| DB-028 | Attempt to delete posted financial history | Deletion blocked |
| DB-029 | Post transaction with failed validation | No partial posting remains |
| DB-030 | Restore database backup | Restoration test completed and verified |

## 10. Implementation boundaries

### Initial release

The initial release must provide the operational foundation for:
- Organisation, locations, users and access.
- Suppliers, products and procurement.
- Quantity reconciliation.
- Landed-cost management.
- Customers, sales and pricing.
- Transporters, trucks, drivers and dispatch.
- Loading, delivery and trip reconciliation.
- Warehouse inventory and FIFO.
- Payments, receivables and payables.
- Expenses and operational profitability.
- Documents, audit, reports and notifications.
- Offline operation and controlled synchronisation.

### Deferred

Full double-entry accounting remains a later phase:
- Chart of accounts.
- Accounting periods.
- Journal entries.
- Journal entry lines.
- Trial balance.
- Balance sheet.
- Statutory profit and loss statement.

Do not attempt to simulate a full general ledger using the operational payment tables.

## 11. Final implementation decision

The v1.1 design remains the source baseline. The v1.2 amendments above are required to address direct fulfilment traceability, cost allocation and multi-trip transporter invoicing while protecting the existing payment, employee, expense, profitability and control structures.

The next development action is:

1. Verify the actual database schema against the complete v1.1 dictionary.
2. Apply the approved v1.2 amendments.
3. Reconcile ERD v1.2 with the resulting physical schema.
4. Update the Technical Blueprint to reflect the final database.
5. Generate version-controlled, non-destructive SQL migrations.
6. Execute the acceptance tests.
7. Obtain approval before production deployment.

**Do not start by generating the entire database from scratch. First inspect the existing repository and database, identify what already exists, and migrate only what is missing or incorrect.**

**Final principle:** The Deuces database must make every important procurement, quantity movement, customer delivery, payment, cost allocation and correction traceable. It must prevent duplicate transactions, preserve historical evidence and provide reliable operational financial information.