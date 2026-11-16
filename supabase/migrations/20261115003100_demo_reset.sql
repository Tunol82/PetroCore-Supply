-- =============================================================================
-- PetroCore Supply — Migration 31: Demo data reset
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115003100.
--
-- Owner request, 2026-11-16: a reset control that clears demo transactions.
--
-- Scope of the reset:
--   * deleted: every transactional record for the caller's organisation -
--     procurements, sales orders, trips, loading, deliveries, evidence rows,
--     reconciliation, inventory, issues, recoveries, invoices, payments and
--     tolerance rules;
--   * kept: the organisation, users, roles and permissions, locations,
--     products, suppliers, transporters, trucks, drivers, customers, depots,
--     cost categories and settings, so the tenant remains usable;
--   * kept: the audit trail. Reset events are written to it; deleting audit rows
--     would defeat the append-only guarantee.
--
-- The caller needs `organisation.manage` and must type the organisation code.
-- Everything runs in one transaction: either the whole reset happens or nothing
-- does. Storage objects are removed by the application before this function is
-- called, because the database cannot delete them.
-- =============================================================================

begin;

create or replace function app.reset_organisation_demo_data(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_code varchar(40);
  v_counts jsonb := '{}'::jsonb;
  v_rows integer;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('organisation.manage') then
    raise exception 'permission denied to reset demo data';
  end if;

  select organisation_code
    into v_code
  from public.organisations
  where id = v_organisation_id;

  if v_code is null then
    raise exception 'organisation not found';
  end if;

  if p_confirm is null or btrim(p_confirm) <> v_code then
    raise exception 'type the organisation code to confirm the reset';
  end if;

  delete from public.transporter_recoveries where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('transporter_recoveries', v_rows);

  delete from public.discrepancy_investigations where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('discrepancy_investigations', v_rows);

  delete from public.delivery_discrepancies where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('delivery_discrepancies', v_rows);

  delete from public.trip_reconciliation_items where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_reconciliation_items', v_rows);

  delete from public.trip_reconciliations where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_reconciliations', v_rows);

  delete from public.delivery_evidence where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('delivery_evidence', v_rows);

  delete from public.trip_delivery_records where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_delivery_records', v_rows);

  delete from public.trip_loading_procurement_allocations where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_loading_allocations', v_rows);

  delete from public.trip_loading_records where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_loading_records', v_rows);

  delete from public.fifo_allocations where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('fifo_allocations', v_rows);

  delete from public.inventory_movements where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_movements', v_rows);

  delete from public.inventory_issue_lines where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_issue_lines', v_rows);

  delete from public.inventory_issues where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_issues', v_rows);

  delete from public.inventory_reservation_items where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_reservation_items', v_rows);

  delete from public.inventory_reservations where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_reservations', v_rows);

  delete from public.inventory_batches where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('inventory_batches', v_rows);

  delete from public.payments where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('payments', v_rows);

  delete from public.transporter_invoice_lines where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('transporter_invoice_lines', v_rows);

  delete from public.transporter_invoices where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('transporter_invoices', v_rows);

  delete from public.trip_assignments where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trip_assignments', v_rows);

  delete from public.trips where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('trips', v_rows);

  delete from public.procurement_cost_components where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('procurement_cost_components', v_rows);

  delete from public.procurement_batches where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('procurement_batches', v_rows);

  delete from public.sales_order_items where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('sales_order_items', v_rows);

  delete from public.sales_orders where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('sales_orders', v_rows);

  delete from public.purchase_order_items where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('purchase_order_items', v_rows);

  delete from public.purchase_orders where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('purchase_orders', v_rows);

  delete from public.tolerance_rules where organisation_id = v_organisation_id;
  get diagnostics v_rows = row_count; v_counts := v_counts || jsonb_build_object('tolerance_rules', v_rows);

  perform app.record_audit(
    'organisation.demo_data_reset',
    'organisations',
    v_organisation_id,
    null,
    v_counts,
    'Demo data reset by an organisation administrator',
    null
  );

  return v_counts;
end;
$$;

revoke all on function app.reset_organisation_demo_data(text) from public;
grant execute on function app.reset_organisation_demo_data(text) to authenticated;

create or replace function public.reset_organisation_demo_data(p_confirm text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.reset_organisation_demo_data(p_confirm)
$$;

revoke all on function public.reset_organisation_demo_data(text) from public;
grant execute on function public.reset_organisation_demo_data(text) to authenticated;

commit;
