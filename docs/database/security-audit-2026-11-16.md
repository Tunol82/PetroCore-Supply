# Security and integrity audit — 16 November 2026

**Project:** PetroCore Supply (non-production Supabase project `pmsjntbwtswjygerozns`)
**Scope:** every table, view, function and grant in the `public` and `app` schemas after migration `20261115002500`.
**Method:** catalog queries against `pg_tables`, `pg_class`, `pg_policies`, `pg_proc`, `pg_constraint` and `information_schema.role_table_grants`, followed by live privilege tests as `anon`, `authenticated` and a second tenant.

## Summary

| Area | Result |
|---|---|
| Tables without row-level security | 0 |
| `anon` table privileges | 0 |
| `anon` function execution | 0 after fixes |
| `authenticated` TRUNCATE privileges | 0 after fixes |
| DELETE grants without a matching policy | 0 after fixes |
| Views accepting writes | 0 after fixes |
| Security definer functions without `search_path` | 0 |
| Cross-tenant single-column foreign keys into business tables | 0 |
| Direct stock quantity updates by ordinary users | Denied after fixes |

## Findings and fixes

### F-1 `anon` could execute tenant RPCs (medium)

`public.post_inventory_issue`, `reverse_inventory_issue`, `release_reservation_item` and `release_trip_assignment` were executable by `anon` because Supabase's default privileges granted EXECUTE to that role. The functions reject an anonymous caller (there is no tenant context), so the practical risk was low, but the privilege was wrong.

**Fix:** migration `20261115002600_least_privilege_sweep` revokes EXECUTE from `anon` on every function in `public` and `app`.

### F-2 EXECUTE inherited from PUBLIC (medium)

Migration 26 did not remove the PostgreSQL default `PUBLIC` grant, so `anon` still inherited execution on two trigger functions in the unexposed `app` schema.

**Fix:** migration `20261115002700_revoke_public_execute` revokes EXECUTE from `PUBLIC` wherever it still exists and leaves the explicit `authenticated` grants intact.

### F-3 TRUNCATE on twenty tables (high)

`authenticated` and `anon` held TRUNCATE on twenty tables. Row-level security does not apply to TRUNCATE, so this was the only privilege able to destroy data without passing a policy. PostgREST does not expose TRUNCATE, which limited exposure, but the grant was indefensible.

**Fix:** migration 26 revokes TRUNCATE on every table from both roles.

### F-4 DELETE without a policy (low)

Several tables granted DELETE while their policies never allow a delete (`organisations`, `profiles`, `business_settings`). Deletes were blocked by RLS, but the privilege was unnecessary.

**Fix:** migration 26 revokes DELETE wherever no DELETE or `ALL` policy exists. Master data with an `ALL` policy keeps its delete path; this was verified by inserting and deleting a cost category as `authenticated`.

### F-5 Writes granted on a read-only view (low)

`sales_order_profitability` carried INSERT, UPDATE, DELETE and TRUNCATE grants. The view is not auto-updatable, but the grants were removed.

**Fix:** migration 26 revokes writes on views.

### F-6 Direct stock manipulation (high)

`authenticated` could update `inventory_batches` directly, including `remaining_quantity`, with no ledger entry. This would have allowed stock to disappear or appear without a movement, breaking the ledger invariant.

**Fix:** migration 26 revokes UPDATE on `inventory_batches`. Stock now changes only through the receipt trigger, issue posting and issue reversal, which are trusted functions that also write the ledger and audit trail.

## Deliberate exceptions

| Item | Reason |
|---|---|
| `platform_admins`, `platform_audit_logs`, `platform_tenant_sessions` have RLS and no policies | Deny-all for ordinary users; platform access goes through security definer functions (DR-26). |
| Single-column foreign keys to `profiles` (`created_by`, `posted_by`, `recorded_by`, …) | Actor references. The insert policies require the actor to equal `current_profile_id()`, so a cross-tenant reference cannot be inserted. |
| UPDATE on `trips`, `trip_reconciliations` and `delivery_discrepancies` | Workflow status changes that are part of the intended reconciliation process. No money or stock moves through these updates. |
| `inventory_batches` insert remains with `authenticated` | Receipts are a normal user operation, validated by `app.validate_inventory_batch` and constrained to verified quantities. |

## Verification performed

| Check | Result |
|---|---|
| Receipt posting after the grant changes | Succeeded; batch and movement created |
| `post_inventory_issue` as `authenticated` | Reached the business check ("issue not found") |
| `post_inventory_issue` as `anon` | `permission denied for function` |
| Direct `inventory_batches` update as `authenticated` | `permission denied for table` |
| Legitimate delete through an `ALL` policy | Succeeded |
| Tenant isolation after the sweep | Unchanged; second tenant still reads zero rows |

## Recommendations for the next audit

1. Add a CI step that runs the same catalog queries against a disposable database and fails on regression.
2. Review `updated_at` trigger coverage; several master-data tables rely on application updates.
3. Add storage-policy tests to the automated suite; today they are verified by the live check scripts.
4. Revisit reconciliation UPDATE grants when the approval workflow (DR-20) is implemented.
