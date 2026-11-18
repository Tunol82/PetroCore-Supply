-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: dynamic operating rules
--
-- Makes approval authority, transporter charge categories and operating policy
-- configurable per organisation instead of hardcoded. No threshold is seeded,
-- so liability confirmation keeps its current behaviour (any transport.manage
-- user) until an owner configures a tier in Settings -> Business rules.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000100.
-- -----------------------------------------------------------------------------

begin;

-- Approval thresholds ---------------------------------------------------------
create table public.approval_thresholds (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations (id) on delete restrict,
  action              varchar(40) not null
                      check (action in ('liability_confirm', 'liability_write_off')),
  min_amount          numeric(18,2) not null default 0 check (min_amount >= 0),
  max_amount          numeric(18,2) check (max_amount is null or max_amount > min_amount),
  required_permission varchar(60) not null references public.permissions (permission_key),
  active              boolean not null default true,
  notes               varchar(240),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint approval_thresholds_tenant_key unique (id, organisation_id)
);

create index approval_thresholds_org_idx on public.approval_thresholds (organisation_id);

-- Transporter charge categories ----------------------------------------------
create table public.transporter_charge_categories (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  code            varchar(40) not null check (code ~ '^[a-z0-9_]+$'),
  label           varchar(80) not null,
  sort_order      integer not null default 100,
  active          boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint transporter_charge_categories_tenant_key unique (id, organisation_id),
  constraint transporter_charge_categories_code_key unique (organisation_id, code)
);

create index transporter_charge_categories_org_idx
  on public.transporter_charge_categories (organisation_id);

-- Keep the five categories the application already offered.
insert into public.transporter_charge_categories (organisation_id, code, label, sort_order)
select organisation.id, category.code, category.label, category.sort_order
from public.organisations organisation
cross join (
  values
    ('haulage', 'Haulage', 10),
    ('loading', 'Loading', 20),
    ('waiting', 'Waiting', 30),
    ('demurrage', 'Demurrage', 40),
    ('other', 'Other', 50)
) as category(code, label, sort_order)
on conflict (organisation_id, code) do nothing;

-- Operating policy ------------------------------------------------------------
create table public.operating_policies (
  organisation_id             uuid primary key references public.organisations (id) on delete cascade,
  trip_closure_policy         varchar(20) not null default 'warn'
                              check (trip_closure_policy in ('allow', 'warn', 'block')),
  closure_override_permission varchar(60) not null default 'transport.manage'
                              references public.permissions (permission_key),
  unresolved_aging_days       integer not null default 7
                              check (unresolved_aging_days between 1 and 365),
  default_correction_method   varchar(80),
  updated_by                  uuid references public.profiles (id) on delete set null,
  updated_at                  timestamptz not null default now()
);

-- Resolution helpers ----------------------------------------------------------
create or replace function app.required_approval_permission(p_action text, p_amount numeric)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select threshold.required_permission
      from public.approval_thresholds threshold
      where threshold.organisation_id = app.current_organisation_id()
        and threshold.action = p_action
        and threshold.active
        and coalesce(p_amount, 0) >= threshold.min_amount
        and (threshold.max_amount is null or coalesce(p_amount, 0) <= threshold.max_amount)
      order by threshold.min_amount desc
      limit 1
    ),
    'transport.manage'
  );
$$;

revoke all on function app.required_approval_permission(text, numeric) from public;
grant execute on function app.required_approval_permission(text, numeric) to authenticated;

create or replace function app.can_approve_amount(p_action text, p_amount numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_permission(app.required_approval_permission(p_action, p_amount));
$$;

revoke all on function app.can_approve_amount(text, numeric) from public;
grant execute on function app.can_approve_amount(text, numeric) to authenticated;

-- Audit configuration changes -------------------------------------------------
create or replace function app.audit_operating_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
begin
  if app.current_profile_id() is null or app.current_organisation_id() is null then
    return new;
  end if;

  if tg_table_name = 'operating_policies' then
    v_entity_id := new.organisation_id;
  else
    v_entity_id := new.id;
  end if;

  perform app.record_audit(
    'settings.' || tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_operating_rule() from public;

create trigger approval_thresholds_audit
  after insert or update on public.approval_thresholds
  for each row execute function app.audit_operating_rule();

create trigger transporter_charge_categories_audit
  after insert or update on public.transporter_charge_categories
  for each row execute function app.audit_operating_rule();

create trigger operating_policies_audit
  after insert or update on public.operating_policies
  for each row execute function app.audit_operating_rule();

-- Row level security ----------------------------------------------------------
alter table public.approval_thresholds enable row level security;
alter table public.transporter_charge_categories enable row level security;
alter table public.operating_policies enable row level security;

create policy approval_thresholds_read on public.approval_thresholds
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('organisation.manage') or app.has_permission('transport.manage'))
  );

create policy approval_thresholds_write on public.approval_thresholds
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  );

create policy transporter_charge_categories_read on public.transporter_charge_categories
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      app.has_permission('transport.view')
      or app.has_permission('transport.manage')
      or app.has_permission('organisation.manage')
    )
  );

create policy transporter_charge_categories_write on public.transporter_charge_categories
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  );

create policy operating_policies_read on public.operating_policies
  for select to authenticated
  using (organisation_id = app.current_organisation_id());

create policy operating_policies_write on public.operating_policies
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('organisation.manage')
  );

revoke all on public.approval_thresholds from anon;
revoke all on public.transporter_charge_categories from anon;
revoke all on public.operating_policies from anon;

grant select, insert, update on public.approval_thresholds to authenticated;
grant select, insert, update on public.transporter_charge_categories to authenticated;
grant select, insert, update on public.operating_policies to authenticated;

revoke truncate on public.approval_thresholds from authenticated, anon;
revoke truncate on public.transporter_charge_categories from authenticated, anon;
revoke truncate on public.operating_policies from authenticated, anon;

-- Enforce the configured authority when confirming a liability -----------------
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

  if not app.can_approve_amount('liability_confirm', v_amount) then
    raise exception 'approval threshold: this liability requires the % permission',
      app.required_approval_permission('liability_confirm', v_amount);
  end if;

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

commit;
