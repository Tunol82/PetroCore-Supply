-- =============================================================================
-- PetroCore Supply — Migration 29: Optional tolerance rules
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002900.
--
-- DR-03 approved subset (owner answers, 2026-11-16): tolerance classification is
-- an optional feature. When no rule is configured, reconciliation items behave
-- exactly as before - the user chooses the status and `tolerance_quantity`
-- stays empty.
--
-- When an active rule matches the item's product (or an organisation-wide rule),
-- the item's tolerance is computed and the status is classified:
--   * within_tolerance when the absolute variance is inside the tolerance;
--   * flagged otherwise.
--
-- Three bases are supported, because the owner has not fixed one yet:
--   * percentage of loaded quantity;
--   * absolute quantity;
--   * the greater of a percentage and an absolute floor.
--
-- Rules are per organisation and optionally per product, so a tenant can start
-- with one rule and refine it later without changing history.
-- =============================================================================

begin;

create table public.tolerance_rules (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations (id) on delete restrict,
  product_id        uuid,
  basis             varchar(20) not null
                    check (basis in ('percentage', 'absolute', 'greater_of')),
  percentage        numeric(6,3) check (percentage is null or (percentage > 0 and percentage <= 100)),
  absolute_quantity numeric(18,3) check (absolute_quantity is null or absolute_quantity > 0),
  active            boolean not null default true,
  notes             text,
  created_by        uuid references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now(),
  constraint tolerance_rules_tenant_key unique (id, organisation_id),
  constraint tolerance_rules_unique unique nulls not distinct (organisation_id, product_id),
  constraint tolerance_rules_basis_values check (
    (basis = 'percentage' and percentage is not null and absolute_quantity is null)
    or (basis = 'absolute' and absolute_quantity is not null and percentage is null)
    or (basis = 'greater_of' and percentage is not null and absolute_quantity is not null)
  ),
  constraint tolerance_rules_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

create index tolerance_rules_org_idx on public.tolerance_rules (organisation_id);

create or replace function app.apply_reconciliation_tolerance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_basis varchar(20);
  v_percentage numeric;
  v_absolute numeric;
  v_tolerance numeric;
  v_variance numeric;
begin
  select basis, percentage, absolute_quantity
    into v_basis, v_percentage, v_absolute
  from public.tolerance_rules
  where organisation_id = new.organisation_id
    and active
    and (product_id = new.product_id or product_id is null)
  order by (product_id is not null) desc
  limit 1;

  if v_basis is null then
    return new;
  end if;

  v_variance := new.loaded_quantity - new.delivered_quantity;

  v_tolerance := case v_basis
    when 'percentage' then round(new.loaded_quantity * v_percentage / 100, 3)
    when 'absolute' then v_absolute
    else greatest(round(new.loaded_quantity * v_percentage / 100, 3), v_absolute)
  end;

  new.tolerance_quantity := v_tolerance;
  new.reconciliation_status := case
    when abs(v_variance) <= v_tolerance then 'within_tolerance'
    else 'flagged'
  end;

  return new;
end;
$$;

revoke all on function app.apply_reconciliation_tolerance() from public;

create trigger trip_reconciliation_items_tolerance
  before insert or update of loaded_quantity, delivered_quantity
  on public.trip_reconciliation_items
  for each row execute function app.apply_reconciliation_tolerance();

create or replace function app.audit_tolerance_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.current_profile_id() is null or app.current_organisation_id() is null then
    return new;
  end if;

  perform app.record_audit(
    case tg_op
      when 'INSERT' then 'transport.tolerance_rule_created'
      when 'UPDATE' then 'transport.tolerance_rule_updated'
      else 'transport.tolerance_rule_changed'
    end,
    'tolerance_rules',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_tolerance_rule() from public;

create trigger tolerance_rules_audit
  after insert or update on public.tolerance_rules
  for each row execute function app.audit_tolerance_rule();

alter table public.tolerance_rules enable row level security;

create policy tolerance_rules_read on public.tolerance_rules
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy tolerance_rules_write on public.tolerance_rules
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and created_by = app.current_profile_id()
  );

revoke all on public.tolerance_rules from anon;
grant select, insert, update, delete on public.tolerance_rules to authenticated;
revoke truncate on public.tolerance_rules from authenticated, anon;

commit;
