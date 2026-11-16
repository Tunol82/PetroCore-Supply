-- =============================================================================
-- PetroCore Supply — Migration 32: Optional charge categories and partial recovery
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115003200.
--
-- Owner answers, 2026-11-16: charge categories "use the recommendation or make
-- it optional", partial recovery optional, approval thresholds optional.
--
-- Therefore:
--   * invoice lines gain an OPTIONAL charge category from the recommended set
--     (haulage, loading, waiting, demurrage, other); free description still
--     carries the detail and no category is required;
--   * a recovery may now be partial: the confirmation can record less than the
--     full liability, and further recoveries can be recorded later up to the
--     outstanding balance;
--   * no approval threshold is enforced. Any user with `transport.manage` may
--     confirm, as before; a threshold remains a future configuration decision.
-- =============================================================================

begin;

alter table public.transporter_invoice_lines
  add column if not exists charge_category varchar(30)
    check (
      charge_category is null
      or charge_category in ('haulage', 'loading', 'waiting', 'demurrage', 'other')
    );

create index if not exists transporter_invoice_lines_category_idx
  on public.transporter_invoice_lines (organisation_id, charge_category);

-- -----------------------------------------------------------------------------
-- Confirmation with an optional partial recovery
-- -----------------------------------------------------------------------------

drop function if exists public.confirm_discrepancy_liability(uuid, numeric, text, uuid, text);
drop function if exists app.confirm_discrepancy_liability(uuid, numeric, text, uuid, text);

create or replace function app.confirm_discrepancy_liability(
  p_discrepancy_id uuid,
  p_unit_cost numeric,
  p_recovery_method text,
  p_invoice_id uuid,
  p_note text,
  p_recovery_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_discrepancy public.delivery_discrepancies%rowtype;
  v_item public.trip_reconciliation_items%rowtype;
  v_reconciliation public.trip_reconciliations%rowtype;
  v_shortage numeric;
  v_unit_cost numeric;
  v_basis varchar(30);
  v_amount numeric(18,2);
  v_recovery numeric(18,2);
  v_net_cost numeric;
  v_net_quantity numeric;
  v_invoice public.transporter_invoices%rowtype;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('transport.manage') then
    raise exception 'permission denied to confirm transporter liability';
  end if;

  if p_recovery_method not in ('none', 'invoice_deduction', 'debit_note') then
    raise exception 'unknown recovery method';
  end if;

  select *
    into v_discrepancy
  from public.delivery_discrepancies
  where id = p_discrepancy_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'discrepancy not found for this organisation';
  end if;

  if v_discrepancy.liability_status = 'confirmed' then
    raise exception 'that discrepancy already has a confirmed liability';
  end if;

  select *
    into v_item
  from public.trip_reconciliation_items
  where id = v_discrepancy.reconciliation_item_id
    and organisation_id = v_organisation_id;

  if not found then
    raise exception 'reconciliation item not found for this organisation';
  end if;

  select *
    into v_reconciliation
  from public.trip_reconciliations
  where id = v_item.reconciliation_id
    and organisation_id = v_organisation_id;

  if not found then
    raise exception 'reconciliation not found for this organisation';
  end if;

  v_shortage := v_discrepancy.expected_quantity - v_discrepancy.actual_quantity;

  if v_shortage <= 0 then
    raise exception 'only a shortage can become a liability';
  end if;

  if p_unit_cost is not null then
    v_unit_cost := p_unit_cost;
    v_basis := 'manual';
  else
    select coalesce(sum(case when fa.allocation_type = 'issue' then fa.total_cost else -fa.total_cost end), 0),
           coalesce(sum(case when fa.allocation_type = 'issue' then fa.allocated_quantity else -fa.allocated_quantity end), 0)
      into v_net_cost, v_net_quantity
    from public.fifo_allocations fa
    join public.inventory_movements m on m.id = fa.inventory_movement_id
    join public.inventory_issues ii on ii.id = m.reference_id
    where fa.organisation_id = v_organisation_id
      and ii.organisation_id = v_organisation_id
      and ii.trip_id = v_reconciliation.trip_id
      and m.product_id = v_item.product_id
      and m.reference_type in ('inventory_issue', 'inventory_issue_reversal');

    if v_net_quantity <= 0 then
      raise exception 'no landed cost is available for this trip and product; supply a unit cost';
    end if;

    v_unit_cost := v_net_cost / v_net_quantity;
    v_basis := 'landed_cost';
  end if;

  if v_unit_cost is null or v_unit_cost < 0 then
    raise exception 'the landed cost per unit must be zero or greater';
  end if;

  v_amount := round(v_shortage * v_unit_cost, 2);

  if p_recovery_method <> 'none' then
    if p_invoice_id is null then
      raise exception 'select a transporter invoice for the recovery';
    end if;

    select *
      into v_invoice
    from public.transporter_invoices
    where id = p_invoice_id
      and organisation_id = v_organisation_id;

    if not found then
      raise exception 'transporter invoice not found for this organisation';
    end if;

    if v_invoice.trip_id is distinct from v_reconciliation.trip_id then
      raise exception 'the invoice is not linked to the reconciled trip';
    end if;

    v_recovery := coalesce(p_recovery_amount, v_amount);

    if v_recovery <= 0 or v_recovery > v_amount then
      raise exception 'the recovery amount must be above zero and no more than the liability';
    end if;
  end if;

  update public.delivery_discrepancies
     set liability_status = 'confirmed',
         liability_basis = v_basis,
         liability_unit_cost = v_unit_cost,
         liability_amount = v_amount,
         liability_note = nullif(btrim(coalesce(p_note, '')), ''),
         confirmed_by = v_profile_id,
         confirmed_at = now()
   where id = p_discrepancy_id;

  if p_recovery_method <> 'none' then
    insert into public.transporter_recoveries (
      organisation_id, discrepancy_id, invoice_id, method, amount, note, recorded_by
    ) values (
      v_organisation_id, p_discrepancy_id, p_invoice_id, p_recovery_method, v_recovery,
      nullif(btrim(coalesce(p_note, '')), ''), v_profile_id
    );
  end if;

  perform app.record_audit(
    'transport.discrepancy_liability_confirmed',
    'delivery_discrepancies',
    p_discrepancy_id,
    null,
    jsonb_build_object(
      'basis', v_basis,
      'unit_cost', v_unit_cost,
      'amount', v_amount,
      'recovery', p_recovery_method,
      'recovered', coalesce(v_recovery, 0)
    ),
    nullif(btrim(coalesce(p_note, '')), ''),
    null
  );

  return p_discrepancy_id;
end;
$$;

revoke all on function app.confirm_discrepancy_liability(uuid, numeric, text, uuid, text, numeric) from public;
grant execute on function app.confirm_discrepancy_liability(uuid, numeric, text, uuid, text, numeric) to authenticated;

create or replace function public.confirm_discrepancy_liability(
  p_discrepancy_id uuid,
  p_unit_cost numeric,
  p_recovery_method text,
  p_invoice_id uuid,
  p_note text,
  p_recovery_amount numeric default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.confirm_discrepancy_liability(
    p_discrepancy_id, p_unit_cost, p_recovery_method, p_invoice_id, p_note, p_recovery_amount
  )
$$;

revoke all on function public.confirm_discrepancy_liability(uuid, numeric, text, uuid, text, numeric) from public;
grant execute on function public.confirm_discrepancy_liability(uuid, numeric, text, uuid, text, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- Further partial recoveries
-- -----------------------------------------------------------------------------

create or replace function app.record_liability_recovery(
  p_discrepancy_id uuid,
  p_amount numeric,
  p_method text,
  p_invoice_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_discrepancy public.delivery_discrepancies%rowtype;
  v_recovered numeric;
  v_outstanding numeric;
  v_invoice public.transporter_invoices%rowtype;
  v_reconciliation public.trip_reconciliations%rowtype;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('transport.manage') then
    raise exception 'permission denied to record a recovery';
  end if;

  if p_method not in ('invoice_deduction', 'debit_note') then
    raise exception 'choose an invoice deduction or a debit note';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'the recovery amount must be greater than zero';
  end if;

  select *
    into v_discrepancy
  from public.delivery_discrepancies
  where id = p_discrepancy_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'discrepancy not found for this organisation';
  end if;

  if v_discrepancy.liability_status <> 'confirmed' then
    raise exception 'the liability must be confirmed before recovery';
  end if;

  v_recovered := app.recovered_amount(p_discrepancy_id);
  v_outstanding := coalesce(v_discrepancy.liability_amount, 0) - v_recovered;

  if v_outstanding <= 0 then
    raise exception 'that liability is fully recovered';
  end if;

  if p_amount > v_outstanding then
    raise exception 'the recovery exceeds the outstanding balance of %', v_outstanding;
  end if;

  if p_invoice_id is not null then
    select *
      into v_invoice
    from public.transporter_invoices
    where id = p_invoice_id
      and organisation_id = v_organisation_id;

    if not found then
      raise exception 'transporter invoice not found for this organisation';
    end if;

    select *
      into v_reconciliation
    from public.trip_reconciliations r
    join public.trip_reconciliation_items i on i.reconciliation_id = r.id
    where i.id = v_discrepancy.reconciliation_item_id
      and r.organisation_id = v_organisation_id;

    if found and v_invoice.trip_id is distinct from v_reconciliation.trip_id then
      raise exception 'the invoice is not linked to the reconciled trip';
    end if;
  end if;

  insert into public.transporter_recoveries (
    organisation_id, discrepancy_id, invoice_id, method, amount, note, recorded_by
  ) values (
    v_organisation_id, p_discrepancy_id, p_invoice_id, p_method, p_amount,
    nullif(btrim(coalesce(p_note, '')), ''), v_profile_id
  );

  perform app.record_audit(
    'transport.liability_recovery_recorded',
    'delivery_discrepancies',
    p_discrepancy_id,
    null,
    jsonb_build_object('method', p_method, 'amount', p_amount),
    nullif(btrim(coalesce(p_note, '')), ''),
    null
  );

  return p_discrepancy_id;
end;
$$;

revoke all on function app.record_liability_recovery(uuid, numeric, text, uuid, text) from public;
grant execute on function app.record_liability_recovery(uuid, numeric, text, uuid, text) to authenticated;

create or replace function public.record_liability_recovery(
  p_discrepancy_id uuid,
  p_amount numeric,
  p_method text,
  p_invoice_id uuid,
  p_note text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.record_liability_recovery(p_discrepancy_id, p_amount, p_method, p_invoice_id, p_note)
$$;

revoke all on function public.record_liability_recovery(uuid, numeric, text, uuid, text) from public;
grant execute on function public.record_liability_recovery(uuid, numeric, text, uuid, text) to authenticated;

commit;
