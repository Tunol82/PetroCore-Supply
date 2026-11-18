# Draft migrations (not applied)

SQL in this folder is a **review artefact only**. It is deliberately outside
`supabase/migrations/` so that `supabase db push`, CI and any future deployment
cannot apply it by accident.

## Rules

1. Nothing here may be moved to `supabase/migrations/` until the Decision
   Register records the relevant approvals and the physical definitions are
   signed off.
2. A non-production Supabase project must exist and be confirmed **empty**
   before the first migration is applied.
3. Every migration must be reviewed against the field-level dictionary and the
   ERD, and must carry RLS tests before promotion.
4. No draft here may be treated as the source of truth. The dictionary and ERD
   are authoritative.

## Current drafts

None.

## Promoted

| Migration | Scope | State |
|---|---|---|
| `20261115000100_tenant_access_core.sql` | Organisations, settings, locations, profiles, roles, permissions, role permissions, user roles, location access, audit log, RLS | Applied 2026-11-15; T-001 to T-014 passed |
| `20261115000200_tenant_access_rpc.sql` | Public RPC wrappers for permission and tenant checks | Applied 2026-11-15 |
| `20261115000300_access_audit_triggers.sql` | Audit triggers on role assignments and location grants | Applied 2026-11-15 |
| `20261115000400_platform_admin.sql` | Platform admins, switch sessions, platform audit | Applied 2026-11-15; PA-001 to PA-012 passed |
| `20261115000500_procurement_core.sql` | Suppliers, supplier depots, products, append-only procurement batches | Applied 2026-11-15; live create and isolation checks passed |
| `20261115000600_least_privilege_grants.sql` | Revokes unused write grants on permissions, audit and batches | Applied 2026-11-15 |
| `20261115000700_purchase_orders.sql` | Purchase orders, line items and batch-to-order-line linkage | Applied 2026-11-15; live create and linkage checks passed |
| `20261115000800_procurement_costs.sql` | Supplier-product links, cost categories, append-only cost components | Applied 2026-11-15; database RLS and privilege checks passed |
| `20261115000900_sales_core.sql` | Customers, delivery locations, append-only sales orders and lines | Applied 2026-11-15; database RLS and privilege checks passed |
| `20261115001000_transport_dispatch.sql` | Transporters, trucks, compartments, drivers, trips, assignments | Applied 2026-11-15; database RLS, uniqueness and privilege checks passed |
| `20261115001100_trip_loading.sql` | Compartment loading records and procurement loading allocations | Applied 2026-11-15; capacity, product-match and quantity triggers verified |
| `20261115001200_deliveries.sql` | Delivery records and evidence metadata | Applied 2026-11-15; cumulative-quantity, confirmed-quantity and product checks verified |
| `20261115001300_reconciliation.sql` | Reconciliation headers/items, discrepancies, investigations | Applied 2026-11-15; generated variances and tenant isolation verified |
| `20261115001400_reconciliation_grants.sql` | Revokes leftover UPDATE grants on reconciliation evidence | Applied 2026-11-15; update now denied |
| `20261115001500_inventory_receipts.sql` | Inventory batches and append-only movement ledger | Applied 2026-11-15; validation, movement posting and isolation verified |
| `20261115001600_inventory_cumulative_receipts.sql` | Allows cumulative receipts per procurement batch | Applied 2026-11-15; partial, full and over-receipt checks verified |
| `20261115001700_inventory_reservations.sql` | Inventory reservations and reservation lines | Applied 2026-11-15; availability, product-match and storage-location checks verified |
| `20261115001800_inventory_issues_fifo.sql` | Inventory issues, issue lines and FIFO allocations | Applied 2026-11-15; FIFO split, cost preservation, shortfall rollback and isolation verified |
| `20261115001900_double_booking.sql` | Double-booking prevention for trucks and drivers, assignment release, cancellation release | Applied 2026-11-16; busy-truck, busy-driver, release and cancellation checks verified |
| `20261115002000_assignment_release_grants.sql` | Revokes direct UPDATE on trip assignments | Applied 2026-11-16; direct release now denied |
| `20261115002100_cancelled_trip_assignments.sql` | Rejects new assignments on a cancelled trip | Applied 2026-11-16; cancellation now blocks assignment |
| `20261115002200_evidence_storage.sql` | Private delivery-evidence bucket, tenant-scoped storage policies, evidence file metadata | Applied 2026-11-16; upload, signed download, cross-tenant denial and isolation verified |
| `20261115002300_issue_reversals.sql` | Issue reversal with compensating movements and allocations | Applied 2026-11-16; stock return, reservation reinstatement, duplicate reversal and privilege checks verified |
| `20261115002400_transporter_invoices.sql` | Transporter invoices and lines, liability unassessed | Applied 2026-11-16; record, generated totals and isolation verified |
| `20261115002500_payments_profitability.sql` | Payment records and the operational profitability view | Applied 2026-11-16; receipt, payment, party constraint, append-only and margin checks verified |
| `20261115002600_least_privilege_sweep.sql` | Revokes anonymous RPC execution, TRUNCATE, unused DELETE and view writes, plus direct stock updates | Applied 2026-11-16; see `docs/database/security-audit-2026-11-16.md` |
| `20261115002700_revoke_public_execute.sql` | Revokes EXECUTE inherited from PUBLIC | Applied 2026-11-16; `anon` now executes no function |
| `20261115002800_transporter_liability.sql` | Liability confirmation at landed cost and optional recovery | Applied 2026-11-16; manual and derived cost, shortage-only, rejection and isolation verified |
| `20261115002900_tolerance_rules.sql` | Optional tolerance rules and computed classification | Applied 2026-11-16; greater-of tolerance computed, inside and outside cases verified |
| `20261115003000_measurement_chain.sql` | Optional temperature/density fields and the supplier-to-delivered chain view | Applied 2026-11-16; chain view and derived corrected quantity verified |
| `20261115003100_demo_reset.sql` | Organisation demo-data reset with typed confirmation | Applied 2026-11-16; 159 records cleared, master data kept, wrong confirmation and non-admin blocked |
| `20261115003200_charge_categories_partial_recovery.sql` | Optional invoice charge categories and partial recoveries | Applied 2026-11-16; category insert, partial recovery and over-recovery guard verified |
| `20261118000100_dynamic_operating_rules.sql` | Configurable approval thresholds, transporter charge categories and operating policy; liability confirmation now checks the configured authority | Applied 2026-11-18; tier resolution (≤ threshold vs above), category seed and policy upsert verified |
| `20261118000200_trip_closure.sql` | `close_trip` with policy-driven guard, override reason and audit | Applied 2026-11-18; warn closes, block rejects without a reason, block closes with the override permission and reason (rolled back) |
| `20261118000300_trip_expenses.sql` | Append-only trip expenses with optional fuel litres, RLS and audit | Applied 2026-11-18; fuel expense recorded through the UI and folded into the trip statement |
| `20261118000400_trip_odometer.sql` | Departure and arrival odometer readings with ordering check | Applied 2026-11-18; 480 km distance and 4.00 km/L derived on the demo trip |
| `20261118000500_trip_arrival_audit.sql` | Audit trigger for arrival and arrival-odometer changes | Applied 2026-11-18; arrival update recorded through the UI |
| `20261118000600_compartment_haulage.sql` | Optional quoted haulage per loading record | Applied 2026-11-18; quoted vs allocated split verified on a temporary loading record |
