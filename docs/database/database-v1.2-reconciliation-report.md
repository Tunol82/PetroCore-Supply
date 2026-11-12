# PetroCore Supply — Database v1.2 Reconciliation Report

**Status:** Reconciliation review — not SQL approval  
**Sources reviewed:** Detailed Database Dictionary v1.1 (Parts 1 and 2); ERD v1.2 supplied in the project conversation; Consolidated Database Dictionary v1.2 — Implementation Specification.  
**Repository:** `Tunol82/PetroCore-Supply`  
**Product identity:** PetroCore Supply. Deuces is a tenant/customer organisation using the product.

---

## 1. Executive decision

The v1.2 specification is an amendment to the v1.1 field-level dictionary. It explicitly says that v1.1 remains the baseline unless amended. Therefore:

1. Retain the v1.1 table and field definitions unless an amendment or approved ERD relationship requires a specific change.
2. Do not create duplicate tables merely to adopt a different name used by the ERD.
3. Separate direct-fulfilment loading and cost allocation from warehouse inventory accounting.
4. Preserve the three distinct procurement quantity measurements.
5. Retain typed customer, supplier and transporter payment allocations.
6. Treat receivable/payable balances as derived or controlled projections, not independently editable financial truth.
7. Add transporter invoice line items to support one invoice covering multiple trips.
8. Resolve the organisation/tenant boundary and several ERD-to-dictionary naming differences before physical schema approval.
9. Do not generate SQL or alter a production database until the open decisions in Section 8 are approved.

**Overall result:** The three design sources are directionally consistent on the critical business rules. They are not yet a single unambiguous physical schema. The main remaining work is canonical naming, relationship cardinality, tenant ownership, measurement history, delivery/reconciliation structure and exact approval workflow design.

## 2. Source authority and interpretation

| Source | Role in this reconciliation | Treatment |
|---|---|---|
| Detailed Database Dictionary v1.1 | Existing field-level baseline, including extensive operational and platform tables | Preserve all unaffected definitions |
| ERD v1.2 | Logical entity and relationship model | Use to verify ownership, cardinality and required entities |
| Consolidated Database Dictionary v1.2 | Controlled amendment and implementation controls | Apply its explicit amendments; do not treat it as permission to discard v1.1 |

The ERD is a logical design, not a complete field-level replacement for the dictionary. Where it uses a different entity name, the difference must be resolved in the canonical data dictionary rather than implemented as a second table by default.

## 3. Canonical entity reconciliation

### 3.1 Organisation, tenancy, users and access

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| organisations | business_settings | No explicit rename amendment | Decide whether business_settings is the tenant/organisation record or whether a separate organisations table is required. Do not create both as competing tenant masters. |
| users | profiles + Supabase Auth identity | Supabase Auth is the authentication standard | Keep Auth identity separate from tenant profile/membership. Define the exact user-to-organisation membership relationship. |
| locations | business_locations | No explicit rename amendment | Retain business_locations as the canonical v1.1 name unless a controlled rename is approved. |
| roles | roles | Retain | Keep one role master. |
| permissions | permissions | Retain | Keep one permission master. |
| user_roles | user_roles | Retain | Verify organisation scope and uniqueness. |
| role_permissions | role_permissions | Retain | Verify permission uniqueness and role scope. |
| user_location_access | user_location_access | Retain | Enforce location access in RLS and trusted server-side checks. |
| approval_rules / approval_requests | approval_records | ERD separates rule definition from individual approval request | Extend the approval model to distinguish reusable rules from transaction-specific requests and decisions. Preserve historical approval records during migration. |
| audit_logs | audit_logs | Retain | Make posted transaction and access audit history append-only through ordinary application paths. |

**Critical tenant decision:** The ERD uses organisations while v1.1 describes business settings and business locations. The final schema must explicitly establish which record is the tenant root and how every tenant-owned row references it. Location access must be scoped inside that tenant. A user must never gain cross-tenant access merely by supplying an organisation or location ID from the client.

### 3.2 Suppliers, products and procurement

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| suppliers | suppliers | Retain | No duplicate supplier master. |
| supplier depots | supplier_depots | Retain | Keep distinct from PetroCore tenant storage locations. |
| supplier depot bays | supplier_depot_bays | Retain | Preserve if depot-bay tracking remains in the operational workflow. |
| products | products | Explicitly retain | Canonical product master; PMS, AGO and DPK initially, future products configurable. |
| procurement_orders | purchase_orders | No instruction to create a second order master | Keep purchase_orders as canonical unless the team approves a controlled rename. |
| procurement_order_items | purchase_order_items | v1.2 says retain purchase_order_item_id if it already serves this purpose | Keep purchase_order_items and its existing reference; do not add a duplicate procurement_order_item_id where the relationship is identical. |
| procurement_batches | procurement_batches | Explicitly retain and extend/verify | Preserve supplier, depot, product and three quantity measurements. Add/verify sales_order_item_id for order-line traceability. Retain sales_order_id where required. |
| procurement_quantity_records | supplier_quantity / loaded_quantity / received_quantity on procurement_batches | ERD introduces a separate quantity-record concept; amendment insists all three measures remain distinct | Open design choice: keep the three v1.1 columns as current controlling values and add a measurement-event table only if multiple readings, corrections or evidence history are required. Do not duplicate the same values without defining authority. |
| procurement_discrepancies | delivery_discrepancies / discrepancy investigations and batch variance fields | v1.2 requires investigation before loss/liability classification | Define whether procurement discrepancies are a dedicated procurement table or a typed extension of existing discrepancy/investigation structures. Preserve audit trail and distinguish quantity variance from confirmed liability. |

### 3.3 Landed cost, inventory and loading

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| procurement_cost_components | procurement_cost_components | Retain | Keep source cost component as the traceable origin of allocated cost. |
| inventory_cost_allocations | cost_allocations | Amendment says retain only if target and purpose are unambiguous; use typed tables | Confirm the existing cost_allocations fields. If inventory-only, make that purpose explicit and map it to the ERD inventory allocation concept. Avoid a generic multi-target table. |
| direct_fulfilment_cost_allocations | No dedicated v1.1 table identified | Explicitly add | New typed allocation table linking procurement batch and sales order item, with source component/expense/category references and versioned allocation basis. |
| inventory_batches | inventory_batches | Retain | Only verified receipt into tenant-controlled storage creates stock. |
| inventory_reservations | inventory_reservations and inventory_reservation_items | Retain | Reservations do not change physical stock. Preserve line-level reservation detail. |
| inventory_issues | inventory_issues | Retain | Posted issues reduce available stock. |
| FIFO allocation | fifo_allocations | Retain | Every allocation must reference actual inventory issue movement and the consumed inventory batch. |
| trip_loading_batch_allocations | trip_loading_batch_allocations | Amendment requires reconciliation with a dedicated direct loading table | Existing table currently has optional inventory_batch_id and procurement_batch_id with an XOR rule. Split the source paths only after data mapping and quantity reconciliation. |
| trip_loading_procurement_allocations | No dedicated v1.1 table | Explicitly add | New table for direct procurement loading; must not create inventory movements. |
| trip_loading_records | trip_loading_records | Retain | Physical loading event and compartment record remains the shared loading header. |

**Required fulfilment separation**

- Warehouse: procurement → verified storage receipt → inventory batch → reservation → posted FIFO issue → loading → delivery.
- Direct: procurement batch → loading allocation → delivery → customer-confirmed receipt.

A direct procurement allocation must never be represented as a warehouse receipt or inventory issue. Warehouse and direct loading records may share a loading header only if their source-allocation types remain explicit and mutually exclusive.

**Migration caution:** Do not drop or repurpose trip_loading_batch_allocations in place. First classify every existing row by source, validate the exactly-one-source rule, migrate valid direct-source rows, reconcile allocated quantities to loading records, and preserve the original rows until sign-off.

### 3.4 Customers, sales and receivables

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| customers | customers | Retain | No duplicate customer master. |
| customer_locations | customer_locations | Retain | Keep customer delivery locations distinct from tenant storage locations. |
| sales_orders / sales_order_items | sales_orders / sales_order_items | Retain | Preserve confirmed line price and quantity; historical orders must not change with current pricing. |
| sales_invoices / sales_invoice_items | sales_invoices / sales_invoice_items | Retain | Support eligible partial invoicing and line-level traceability. |
| credit_notes / credit_note_items | sales_credit_notes / sales_credit_note_items | No explicit rename amendment | Retain v1.1 names unless a controlled naming decision is approved. Credit notes correct posted invoices; they do not erase them. |
| customer_payment_allocations | invoice_payment_allocations | v1.2 explicitly says retain invoice_payment_allocations | Retain invoice_payment_allocations as canonical. Do not create a second customer allocation table for the same relationship. |
| accounts_receivable | accounts_receivable | Explicitly retain as derived/control projection | Reconcile to posted invoices, credit notes, valid allocations, adjustments and reversals. No free-form balance edits. |

### 3.5 Trips, transport, delivery and reconciliation

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| transporters | transporters | Explicitly retain | Manual transporter selection remains a Dispatch decision. |
| trucks / compartments | trucks / truck_compartments and fleet tables | Retain | Preserve capacity, calibration and historical assignment evidence. |
| employees / drivers | employees / drivers | Explicitly retain | Third-party transporter drivers are not automatically tenant employees or payroll recipients. |
| trips | trips | Retain | Preserve historical truck, driver and transporter assignments. |
| trip_sales_order_allocations | trip_sales_orders + trip_sales_order_items | v1.1 already models trip/order and order-line allocations | Keep the two-level v1.1 structure unless the final dictionary explicitly consolidates it. Do not create a duplicate order-line allocation path. |
| deliveries | trip_delivery_records | No explicit rename amendment | Map the ERD delivery concept to the existing v1.1 delivery record. Decide whether a physical rename adds value before changing it. |
| delivery_confirmations | customer_confirmed_quantity, acknowledgement and delivery_evidence | ERD separates confirmation | Decide whether confirmation is a separate event/history table or remains a set of fields plus evidence. A separate event model is needed if multiple confirmations, disputes or amendments must be retained. |
| delivery_reconciliations | trip_reconciliations + trip_reconciliation_items + delivery_discrepancies + discrepancy_investigations | ERD uses a broader name | Preserve the detailed v1.1 reconciliation and investigation records. Map them to the logical ERD concept; do not collapse evidence/history into a single header. |
| trip_expenses | trip_expenses | Explicitly retain | Must not duplicate an expense already recorded in expense_records. |
| transporter_invoices | transporter_invoices | Retain header | Keep invoice header as authoritative document. |
| transporter_invoice_items | No dedicated v1.1 table identified | Explicitly add | New child table supports one transporter invoice covering multiple trips. Existing header trip_id may remain for legacy/single-trip compatibility but must not compete with invoice items. |
| transporter_payment_allocations | transporter_payment_allocations | Explicitly retain | No duplicate allocation table. |
| trip_profitability_snapshots | trip_profitability_snapshots | Explicitly retain | Preserve estimated/actual distinction, calculation version and source basis. |

### 3.6 Payments, expenses, documents and platform controls

| ERD v1.2 concept/entity | v1.1 dictionary entity | v1.2 amendment position | Reconciliation recommendation |
|---|---|---|---|
| payments | payment_records + financial_transactions | Amendment says retain payment_records | Keep payment_records as canonical payment event unless an approved rename is made. Preserve payment direction, verification and settlement status. |
| customer payment allocation | invoice_payment_allocations | Explicitly retain | Inbound customer receipts only; do not use for supplier/transporter liabilities. |
| supplier payment allocation | supplier_payment_allocations | Explicitly retain | Outbound supplier payments only. |
| transporter payment allocation | transporter_payment_allocations | Explicitly retain | Outbound transporter payments only. |
| payment reversals | payment_reversals | Explicitly retain | Compensating reversal; preserve original payment and allocations. |
| accounts_payable | accounts_payable | Explicitly retain as derived/control projection | Supplier/transporter party and invoice ownership must be validated. Balances must reconcile to invoices, allocations and reversals. |
| expense_records | expense_records | Explicitly retain | General expenses with explicit cost treatment. |
| documents / document_links / document_requirements | Same v1.1 tables | Retain | Keep secure object storage and authorised access. document_links uses polymorphic entity references and therefore requires strict typed validation or a future typed-link design. |
| data_import_jobs / data_import_errors | Same v1.1 tables | Explicitly retain | Keep validation, source-row traceability and idempotency. |
| report_definitions / saved_report_views / report_schedules | Same v1.1 tables | Explicitly retain | Keep report configuration and scheduling. |
| notifications / preferences / delivery logs | Same v1.1 tables | Explicitly retain | Keep recipient, delivery status and attempt history. |
| document_number_sequences | Same v1.1 table | Explicitly retain | Must be concurrency-safe and tenant/document-scope aware. |
| offline_devices / sync_sessions / operation_log / conflicts | Same v1.1 tables | Explicitly retain | Offline submissions are pending until server validation and idempotent posting succeed. |
| audit_logs / idempotency_records | Same v1.1 tables | Explicitly retain | Append-only audit and scoped duplicate protection. |

## 4. Full v1.1 module preservation

The reconciliation must retain unaffected v1.1 modules, not just the entities named in the ERD diagrams. These include:

- Organisation and access: business_settings, business_locations, profiles, roles, permissions, role_permissions, user_roles, user_location_access, approval_records.
- Procurement: suppliers, supplier_depots, supplier_depot_bays, products, supplier_products, purchase_orders, purchase_order_items, procurement_batches.
- Costs: cost_categories, procurement_cost_components, cost_allocations, procurement_cost_adjustments, inventory_cost_adjustments.
- Inventory: inventory_batches, inventory_reservations, inventory_reservation_items, inventory_issues, inventory_movements, fifo_allocations, inventory_adjustments, stock_transfers, stock_transfer_items.
- Sales and pricing: customers, customer_locations, product_selling_prices, customer_product_prices, pricing_rules, sales_orders, sales_order_items, pricing_approvals, sales_invoices, sales_invoice_items, sales_credit_notes, sales_credit_note_items, customer_credit_reviews.
- Profitability: sales_profitability_snapshots, trip_profitability_snapshots, profitability_snapshot_allocations.
- Transport and people: transporters, transporter_contracts, transporter_rate_cards, transporter_invoices, employees, drivers, driver_documents, driver_compensation_profiles, driver_compensation_history, driver_salary_records, driver_trip_allowances, driver_advances, driver_expense_retirements.
- Fleet: trucks, truck_ownership_history, truck_compartments, compartment_calibrations, compartment_seals, truck_documents, truck_assignments, truck_maintenance_history, truck_fuel_logs, truck_odometer_logs, truck_tyre_records, truck_parts_records.
- Trips and delivery: trips, trip_assignments, trip_sales_orders, trip_sales_order_items, trip_loading_records, trip_loading_batch_allocations, trip_delivery_records, delivery_evidence, trip_expenses, trip_reconciliations, trip_reconciliation_items, delivery_discrepancies, discrepancy_investigations.
- Incidents and compliance: incidents, incident_participants, incident_evidence, incident_investigations, incident_actions, insurance_policies, insurance_claims, compliance_requirements, compliance_records, product_quality_checks.
- Finance: financial_transactions, payment_records, payment_channels, invoice_payment_allocations, supplier_payment_allocations, transporter_payment_allocations, payment_reversals, accounts_receivable, accounts_payable, expense_records.
- Platform controls: documents, document_links, document_requirements, report_definitions, saved_report_views, report_schedules, data_import_jobs, data_import_errors, notifications, notification_preferences, notification_delivery_logs, document_number_sequences, offline_devices, offline_sync_sessions, offline_operation_log, offline_sync_conflicts, audit_logs, idempotency_records.
- Deferred accounting: chart_of_accounts, accounting_periods, journal_entries, journal_entry_lines remain deferred until the later full accounting phase; they are not part of the initial operational-finance release.

## 5. Required schema changes after reconciliation

### 5.1 New entities explicitly required by v1.2 amendment

1. `trip_loading_procurement_allocations` — direct procurement loading allocations.
2. `direct_fulfilment_cost_allocations` — typed direct-fulfilment cost allocation.
3. `transporter_invoice_items` — transporter invoice lines linked to trips.

### 5.2 Existing entities to extend or verify

1. `procurement_batches`: add/verify `sales_order_item_id`; retain `purchase_order_item_id` if it already identifies the originating purchase order item; retain `sales_order_id` where needed.
2. `trip_loading_batch_allocations`: classify existing rows and separate inventory-source allocations from direct procurement allocations without losing history.
3. `transporter_invoices`: preserve header; clarify legacy `trip_id` after invoice items become authoritative for trip coverage.
4. `drivers`: verify transporter_id, employee_id, driver_type and active status; ensure mutually valid employment/provider relationship.
5. `accounts_receivable` and `accounts_payable`: constrain to derived/reconciled projections.
6. `cost_allocations`: define one authoritative target type or replace/split with typed allocation structures only after field-level review.
7. `approval_records`: align with ERD's approval rule/request separation.
8. Organisation/profile/location tables: explicitly implement tenant root, membership and location ownership.

### 5.3 Conditional entities requiring a design decision

- `procurement_quantity_records`: add only if it represents measurement events/history beyond the three controlling v1.1 quantity columns.
- `procurement_discrepancies`: define whether this is a new procurement-specific table or a typed extension of existing discrepancy/investigation records.
- `delivery_confirmations`: add only if confirmation needs its own immutable event/history, rather than duplicating delivery fields and evidence.
- `delivery_reconciliations`: map to the existing v1.1 trip reconciliation structures; rename or consolidate only with an approved migration map.
- `organisations`, `locations`, `procurement_orders`, `credit_notes`, `payments`, `deliveries`: these are naming alternatives in the ERD, not automatic instructions to create parallel tables.

## 6. Financial and operational invariants

The final schema and server-side posting services must enforce:

- Direct fulfilment never creates artificial warehouse stock.
- Only verified receipts into tenant-controlled storage create inventory.
- Reservations do not reduce physical stock; posted issues do.
- FIFO allocations identify actual consumed inventory batches and issue movements.
- Supplier invoice quantity, loaded quantity and received/customer-confirmed quantity remain separate.
- A quantity discrepancy remains under investigation until authorised resolution; it is not automatically a loss, driver debt, transporter debt or employee deduction.
- A trip may carry multiple sales orders; a sales order item may be fulfilled by multiple trips.
- Loading allocation totals reconcile to physical loading records and compartment capacity.
- Dispatch manually selects transporters; no automatic assignment.
- A transporter-provided driver is not automatically a tenant employee or payroll recipient.
- Customer, supplier and transporter payments use distinct typed allocation relationships.
- Allocations cannot exceed verified/settled available payment funds or eligible outstanding liability.
- Payment reversals preserve original payments and cannot exceed the unreversed amount.
- Receivable/payable projections reconcile to authoritative invoices, credit notes, allocations, adjustments and reversals.
- Inbound procurement haulage and outbound customer delivery haulage remain separate cost categories.
- The same expense is not independently counted in expense_records and trip_expenses.
- Profitability snapshots distinguish estimate from actual and preserve version/calculation basis.
- Posted financial, inventory, delivery, approval and audit history is corrected through reversals/adjustments, not silent overwrite or ordinary deletion.
- Offline operations remain pending until server validation; idempotency prevents duplicate posting.
- All tenant-owned rows have explicit tenant ownership and location-scoped access where applicable.

## 7. Database acceptance coverage

The v1.2 amendment defines 30 acceptance scenarios (DB-001 through DB-030). All should be retained as release tests. The critical groups are:

| Test group | Required coverage |
|---|---|
| Procurement and quantities | Supplier/depot/product validity; separate supplier/loading/received quantities; discrepancy investigation |
| Direct fulfilment | Direct loading and cost allocation without inventory receipt or issue |
| Warehouse inventory | Verified receipt, reservation, posting, FIFO, concurrency and no negative stock |
| Transport and delivery | Multi-trip transporter invoice, multi-order trips, capacity, overlapping assignments and complete reconciliation |
| Payments | Correct direction, typed allocations, settled funds, outstanding liability, reversal and idempotency |
| Sales | Preserved order prices, partial invoicing, credit notes and unbilled quantity controls |
| Security | Tenant and location isolation, server-side authority, protected documents and append-only audit |
| Offline and recovery | Duplicate submission prevention, pending-sync validation, backup restore |
| Historical integrity | No deletion or silent modification of posted transactions; versioned profitability |

The final acceptance suite must also explicitly test: (a) two tenants with overlapping location IDs cannot see each other's records; (b) direct and warehouse loading paths cannot be mixed in one allocation row; (c) allocation sums reconcile to source amounts; and (d) every approval request resolves against a valid rule and a permitted reviewer.

## 8. Open decisions requiring approval

The v1.2 specification lists the following as unresolved; none should be invented in SQL:

1. Petroleum measurement basis and final quantity precision.
2. Temperature correction: whether required and the approved method.
3. Quantity shortage/excess tolerance thresholds.
4. Inventory reservation timing, expiry and release rules.
5. Direct-fulfilment cost recognition and reporting treatment.
6. Landed-cost adjustments relating to consumed and remaining inventory.
7. Operational revenue recognition trigger.
8. Partial invoicing rules for partial delivery, cancellation and credit notes.
9. Offline conflict resolution policy by transaction type.
10. Location hierarchy and access inheritance.
11. Approval thresholds for monetary, margin and risk decisions.
12. Document limits, retention and version policy.
13. Transporter dispute and liability treatment.
14. Operational reconciliation tolerances.

Additional schema decisions revealed by the ERD reconciliation:

15. Tenant root: business_settings or organisations; and whether users can belong to multiple tenants.
16. Canonical naming: purchase_orders vs procurement_orders; business_locations vs locations; sales_credit_notes vs credit_notes; payment_records vs payments; trip_delivery_records vs deliveries.
17. Quantity model: current-value columns only or columns plus immutable measurement event history.
18. Delivery confirmation: field-level acknowledgement/evidence or separate confirmation event table.
19. Discrepancy model: one shared typed model or procurement and delivery-specific discrepancy tables.
20. Approval model: how approval_rules, approval_requests and existing approval_records relate.
21. Cost allocation model: exact destination FK(s) and how procurement_cost_components reconcile to inventory and direct fulfilment allocations.
22. Transporter invoice header: whether trip_id remains nullable for backward compatibility and how invoice items become authoritative.
23. Payment event model: exact relationship among financial_transactions, payment_records, payment_channels and reversals.
24. Tenant and location ownership: required organisation_id/location_id coverage, global master data exceptions and RLS policy model.

## 9. Recommended migration sequence

This is the safe sequence, subject to approval and actual database inspection:

1. **Baseline verification:** inspect the actual Supabase schema, existing rows, constraints, indexes, RLS policies and storage policies; compare against the approved v1.1 dictionary. Create and verify a restorable backup.
2. **Tenant/access foundation:** resolve tenant root, user membership, locations, roles, permissions, approval rules/requests and audit ownership.
3. **Procurement traceability:** add only missing order-line relationships and establish quantity/discrepancy rules.
4. **Loading split:** classify existing loading allocation rows; create the dedicated direct allocation table; migrate and reconcile; retain old data until sign-off.
5. **Cost allocation:** define inventory allocation target and create direct fulfilment cost allocation; reconcile all source cost components.
6. **Transporter invoices:** add invoice items, migrate single-trip invoice references and reconcile invoice header totals.
7. **Finance integrity:** validate payment direction, allocation scope, available funds, outstanding liabilities, reversals and derived AR/AP projections.
8. **Supporting controls:** align documents, imports, offline sync, numbering, approvals, reporting and notifications.
9. **Acceptance and release:** execute DB-001–DB-030 plus tenant-isolation and relationship-specific tests; restore from backup in a test environment; sign off before production.

Never drop or rename existing tables as an early migration step. Use additive migrations, backfill, reconciliation queries, dual-read only where necessary, cutover validation, and a later deprecation migration after sign-off.

## 10. Implementation gate

**No production SQL or schema migration is authorised by this reconciliation report.**

Before implementation:
- Resolve Section 8 decisions or explicitly defer them with safe non-assumptive schema boundaries.
- Approve one canonical entity/table name per business concept.
- Produce the consolidated field-level Database Dictionary v1.2, including every retained v1.1 table and exact amended field definitions.
- Reconcile the final dictionary against ERD v1.2, Technical Blueprint, PRD and Business Rules & Financial Logic Specification.
- Inspect the actual repository and Supabase environment; do not assume the database is empty or matches the dictionary.
- Approve a non-destructive migration plan and rollback/restore strategy.

**Conclusion:** The design can proceed to a controlled final dictionary after the decisions above are closed. It is not yet safe to generate migrations. The most important technical safeguards are preventing duplicate sources of truth, keeping direct fulfilment out of warehouse inventory, preserving quantity and financial evidence, and enforcing tenant isolation at the database boundary.
