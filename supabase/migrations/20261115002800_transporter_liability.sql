-- =============================================================================
-- PetroCore Supply — Migration 28: Transporter liability at landed cost
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002800.
--
-- DR-13 approved subset (owner answers, 2026-11-16):
--   * liability basis: landed cost;
--   * recovery: optional, either an invoice deduction or a debit note;
--   * confirmation is explicit and audited - nothing is automatic.
--
-- Landed cost per unit is taken from the FIFO allocations actually consumed on
-- that trip for that product (issue cost minus reversal cost, divided by net
-- quantity). When a trip has no posted issues, the caller must supply the unit
-- cost and the record is marked as a manual basis.
--
-- Only a shortage (expected greater than actual) can become a liability. An
-- excess is never a negative liability.
--
-- A liability is evidence and a recovery record; it does not post a journal
-- entry and does not alter a recorded payment.
-- =============================================================================

begin;

alter table public.delivery_discrepancies
  add column if not exists liability_status varchar(20) not null default 'not_assessed'
    check (liability_status in ('not_assessed', 'confirmed', 'rejected')),
  add column if not exists liability_basis varchar(30)
    check (liability_basis in ('landed_cost', 'manual')),
  add column if not exists liability_unit_cost numeric(18,4)
    check (liability_unit_cost is null or liability_unit_cost >= 0),
  add column if not exists liability_amount numeric(18,2)
    check (liability_amount is null or liability_amount >= 0),
  add column if not exists liability_note text,
  add column if not exists confirmed_by uuid references public.profiles (id) on delete restrict,
  add column if not exists confirmed_at timestamptz;

create table public.transporter_recoveries (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  discrepancy_id  uuid not null,
  invoice_id      uuid,
  method          varchar(30) not null
                  check (method in ('invoice_deduction', 'debit_note')),
  amount          numeric(18,2) not null check (amount > 0),
  note            text,
  recorded_by     uuid references public.profiles (id) on delete restrict,
  recorded_at     timestamptz not null default now(),
  constraint transporter_recoveries_tenant_key unique (id, organisation_id),
  constraint transporter_recoveries_discrepancy_fk
    foreign key (discrepancy_id, organisation_id)
    references public.delivery_discrepancies (id, organisation_id) on delete restrict,
  constraint transporter_recoveries_invoice_fk
    foreign key (invoice_id, organisation_id)
    references public.transporter_invoices (id, organisation_id) on delete restrict
);

create index transporter_recoveries_discrepancy_idx
  on public.transporter_recoveries (discrepancy_id);

create or replace function app.recovered_amount(p_discrepancy_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)
  from public.transporter_recoveries
  where discrepancy_id = p_discrepancy_id
$$;

revoke all on function app.recovered_amount(uuid) from public;
grant execute on function app.recovered_amount(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Confirmation
-- -----------------------------------------------------------------------------

create or replace function app.confirm_discrepancy_liability(
  p_discrepancy_id uuid,
  p_unit_cost numeric,
  p_recovery_method text,
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
  v_item public.trip_reconciliation_items%rowtype;
  v_reconciliation public.trip_reconciliations%rowtype;
  v_shortage numeric;
  v_unit_cost numeric;
  v_basis varchar(30);
  v_amount numeric(18,2);
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
      v_organisation_id, p_discrepancy_id, p_invoice_id, p_recovery_method, v_amount,
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
      'recovery', p_recovery_method
    ),
    nullif(btrim(coalesce(p_note, '')), ''),
    null
  );

  return p_discrepancy_id;
end;
$$;

revoke all on function app.confirm_discrepancy_liability(uuid, numeric, text, uuid, text) from public;
grant execute on function app.confirm_discrepancy_liability(uuid, numeric, text, uuid, text) to authenticated;

create or replace function public.confirm_discrepancy_liability(
  p_discrepancy_id uuid,
  p_unit_cost numeric,
  p_recovery_method text,
  p_invoice_id uuid,
  p_note text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.confirm_discrepancy_liability(
    p_discrepancy_id, p_unit_cost, p_recovery_method, p_invoice_id, p_note
  )
$$;

revoke all on function public.confirm_discrepancy_liability(uuid, numeric, text, uuid, text) from public;
grant execute on function public.confirm_discrepancy_liability(uuid, numeric, text, uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Rejection
-- -----------------------------------------------------------------------------

create or replace function app.reject_discrepancy_liability(p_discrepancy_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_discrepancy public.delivery_discrepancies%rowtype;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('transport.manage') then
    raise exception 'permission denied to reject transporter liability';
  end if;

  if p_note is null or length(btrim(p_note)) < 3 then
    raise exception 'a reason is required to reject a liability';
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
    raise exception 'a confirmed liability cannot be rejected';
  end if;

  if exists (select 1 from public.transporter_recoveries where discrepancy_id = p_discrepancy_id) then
    raise exception 'a discrepancy with a recorded recovery cannot be rejected';
  end if;

  update public.delivery_discrepancies
     set liability_status = 'rejected',
         liability_note = btrim(p_note),
         confirmed_by = v_profile_id,
         confirmed_at = now()
   where id = p_discrepancy_id;

  perform app.record_audit(
    'transport.discrepancy_liability_rejected',
    'delivery_discrepancies',
    p_discrepancy_id,
    null,
    jsonb_build_object('liability_status', 'rejected'),
    btrim(p_note),
    null
  );

  return p_discrepancy_id;
end;
$$;

revoke all on function app.reject_discrepancy_liability(uuid, text) from public;
grant execute on function app.reject_discrepancy_liability(uuid, text) to authenticated;

create or replace function public.reject_discrepancy_liability(p_discrepancy_id uuid, p_note text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.reject_discrepancy_liability(p_discrepancy_id, p_note)
$$;

revoke all on function public.reject_discrepancy_liability(uuid, text) from public;
grant execute on function public.reject_discrepancy_liability(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security and privileges
-- -----------------------------------------------------------------------------

alter table public.transporter_recoveries enable row level security;

create policy transporter_recoveries_read on public.transporter_recoveries
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

revoke all on public.transporter_recoveries from anon;
grant select on public.transporter_recoveries to authenticated;
revoke insert, update, delete, truncate on public.transporter_recoveries from authenticated, anon;

commit;
