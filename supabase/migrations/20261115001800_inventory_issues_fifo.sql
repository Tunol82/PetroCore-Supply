-- =============================================================================
-- PetroCore Supply — Migration 18: Inventory issues and FIFO allocations
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001800.
--
-- Scope: authorised issue of stock against a sales order, FIFO consumption of
-- inventory batches, allocation of historical unit cost, and reservation
-- fulfilment.
--
-- Guarantees enforced here:
--   * only a draft issue can be posted, and posting is idempotent per issue;
--   * an issue line's product must match its sales order line;
--   * stock is consumed oldest-received first, only from available batches at
--     the issue location;
--   * affected batches are locked, so concurrent issues cannot oversell;
--   * every issued quantity produces one append-only movement and one FIFO
--     allocation that preserves the batch's unit cost at posting time;
--   * a shortfall aborts the whole posting (no partial posting);
--   * matching active reservations are fulfilled up to the issued quantity.
--
-- Tolerances, reversals and cost-of-sales posting to accounting remain open
-- decisions. Nothing here creates a journal entry or an invoice.
-- =============================================================================

begin;

-- FIFO allocations reference a movement by (id, organisation_id), so the
-- movement ledger needs the tenant composite key that the other tables carry.
alter table public.inventory_movements
  add constraint inventory_movements_tenant_key unique (id, organisation_id);

create table public.inventory_issues (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  issue_number    varchar(50) not null,
  sales_order_id  uuid not null,
  trip_id         uuid,
  location_id     uuid not null,
  issue_date      timestamptz not null default now(),
  status          varchar(25) not null default 'draft'
                  check (status in ('draft', 'posted', 'reversed', 'cancelled')),
  notes           text,
  posted_by       uuid references public.profiles (id) on delete restrict,
  posted_at       timestamptz,
  created_by      uuid references public.profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  constraint inventory_issues_number_unique unique (organisation_id, issue_number),
  constraint inventory_issues_tenant_key unique (id, organisation_id),
  constraint inventory_issues_posted check (
    (status = 'draft' and posted_at is null and posted_by is null)
    or (status <> 'draft')
  ),
  constraint inventory_issues_order_fk
    foreign key (sales_order_id, organisation_id)
    references public.sales_orders (id, organisation_id) on delete restrict,
  constraint inventory_issues_location_fk
    foreign key (location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict,
  constraint inventory_issues_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict
);

create table public.inventory_issue_lines (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations (id) on delete restrict,
  issue_id            uuid not null,
  sales_order_item_id uuid not null,
  product_id          uuid not null,
  requested_quantity  numeric(18,3) not null check (requested_quantity > 0),
  issued_quantity     numeric(18,3) not null default 0 check (issued_quantity >= 0),
  created_at          timestamptz not null default now(),
  constraint inventory_issue_lines_unique unique (issue_id, sales_order_item_id),
  constraint inventory_issue_lines_tenant_key unique (id, organisation_id),
  constraint inventory_issue_lines_issue_fk
    foreign key (issue_id, organisation_id)
    references public.inventory_issues (id, organisation_id) on delete restrict,
  constraint inventory_issue_lines_order_item_fk
    foreign key (sales_order_item_id, organisation_id)
    references public.sales_order_items (id, organisation_id) on delete restrict,
  constraint inventory_issue_lines_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

create table public.fifo_allocations (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete restrict,
  inventory_movement_id uuid not null,
  inventory_batch_id    uuid not null,
  sales_order_item_id   uuid not null,
  allocated_quantity    numeric(18,3) not null check (allocated_quantity > 0),
  allocated_unit_cost   numeric(18,4) not null check (allocated_unit_cost >= 0),
  total_cost            numeric(18,2) generated always as (
                          round(allocated_quantity * allocated_unit_cost, 2)
                        ) stored,
  allocation_date       timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  constraint fifo_allocations_tenant_key unique (id, organisation_id),
  constraint fifo_allocations_movement_fk
    foreign key (inventory_movement_id, organisation_id)
    references public.inventory_movements (id, organisation_id) on delete restrict,
  constraint fifo_allocations_batch_fk
    foreign key (inventory_batch_id, organisation_id)
    references public.inventory_batches (id, organisation_id) on delete restrict,
  constraint fifo_allocations_order_item_fk
    foreign key (sales_order_item_id, organisation_id)
    references public.sales_order_items (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Issue line validation
-- -----------------------------------------------------------------------------

create or replace function app.validate_issue_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_product uuid;
  v_issue_status varchar(25);
  v_issue_location uuid;
begin
  select soio.product_id, i.status, i.location_id
    into v_item_product, v_issue_status, v_issue_location
  from public.sales_order_items soio
  join public.inventory_issues i
    on i.id = new.issue_id
   and i.organisation_id = new.organisation_id
  where soio.id = new.sales_order_item_id
    and soio.organisation_id = new.organisation_id;

  if v_item_product is null then
    raise exception 'issue or sales order line not found';
  end if;

  if v_issue_status <> 'draft' then
    raise exception 'lines can only be added to a draft issue';
  end if;

  if not exists (
    select 1
    from public.business_locations l
    where l.id = v_issue_location
      and l.organisation_id = new.organisation_id
      and l.is_storage_location
  ) then
    raise exception 'issues can only be made from a storage location';
  end if;

  if v_item_product <> new.product_id then
    raise exception 'issue product does not match the sales order line';
  end if;

  return new;
end;
$$;

revoke all on function app.validate_issue_line() from public;

create trigger inventory_issue_lines_validate
  before insert on public.inventory_issue_lines
  for each row execute function app.validate_issue_line();

-- -----------------------------------------------------------------------------
-- Posting
-- -----------------------------------------------------------------------------

create or replace function app.post_inventory_issue(p_issue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_issue public.inventory_issues%rowtype;
  v_line record;
  v_batch record;
  v_needed numeric;
  v_take numeric;
  v_movement_id uuid;
  v_line_count integer := 0;
  v_reservation_item record;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('inventory.manage') then
    raise exception 'permission denied for inventory issues';
  end if;

  select *
    into v_issue
  from public.inventory_issues
  where id = p_issue_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'issue not found for this organisation';
  end if;

  if v_issue.status <> 'draft' then
    raise exception 'only a draft issue can be posted';
  end if;

  for v_line in
    select *
    from public.inventory_issue_lines
    where issue_id = p_issue_id
      and organisation_id = v_organisation_id
    order by created_at, id
  loop
    v_line_count := v_line_count + 1;
    v_needed := v_line.requested_quantity;

    for v_batch in
      select b.id, b.remaining_quantity, b.landed_cost_per_unit
      from public.inventory_batches b
      where b.organisation_id = v_organisation_id
        and b.product_id = v_line.product_id
        and b.location_id = v_issue.location_id
        and b.status = 'available'
        and b.remaining_quantity > 0
      order by b.received_at, b.created_at, b.id
      for update
    loop
      exit when v_needed <= 0;

      v_take := least(v_needed, v_batch.remaining_quantity);

      insert into public.inventory_movements (
        organisation_id, product_id, location_id, inventory_batch_id,
        movement_type, quantity_in, quantity_out,
        reference_type, reference_id, movement_date, created_by
      ) values (
        v_organisation_id, v_line.product_id, v_issue.location_id, v_batch.id,
        'issue', 0, v_take,
        'inventory_issue', v_issue.id, v_issue.issue_date, v_profile_id
      )
      returning id into v_movement_id;

      insert into public.fifo_allocations (
        organisation_id, inventory_movement_id, inventory_batch_id,
        sales_order_item_id, allocated_quantity, allocated_unit_cost, allocation_date
      ) values (
        v_organisation_id, v_movement_id, v_batch.id,
        v_line.sales_order_item_id, v_take, v_batch.landed_cost_per_unit, v_issue.issue_date
      );

      update public.inventory_batches
         set remaining_quantity = remaining_quantity - v_take,
             status = case
                        when remaining_quantity - v_take = 0 then 'exhausted'
                        else status
                      end
       where id = v_batch.id;

      v_needed := v_needed - v_take;
    end loop;

    if v_needed > 0 then
      raise exception 'insufficient available stock for the issue line: % short',
        v_needed;
    end if;

    update public.inventory_issue_lines
       set issued_quantity = requested_quantity
     where id = v_line.id;

    -- Fulfil matching active reservations for this sales order line, oldest first.
    v_needed := v_line.requested_quantity;

    for v_reservation_item in
      select ri.id, ri.reservation_id,
             ri.reserved_quantity - ri.released_quantity - ri.fulfilled_quantity as outstanding
      from public.inventory_reservation_items ri
      join public.inventory_reservations r
        on r.id = ri.reservation_id
       and r.organisation_id = ri.organisation_id
      where ri.organisation_id = v_organisation_id
        and ri.sales_order_item_id = v_line.sales_order_item_id
        and r.location_id = v_issue.location_id
        and r.status in ('active', 'partially_fulfilled')
        and ri.reserved_quantity - ri.released_quantity - ri.fulfilled_quantity > 0
      order by r.reservation_date, ri.created_at
    loop
      exit when v_needed <= 0;

      v_take := least(v_needed, v_reservation_item.outstanding);

      update public.inventory_reservation_items
         set fulfilled_quantity = fulfilled_quantity + v_take
       where id = v_reservation_item.id;

      perform app.refresh_reservation_status(v_reservation_item.reservation_id);

      v_needed := v_needed - v_take;
    end loop;
  end loop;

  if v_line_count = 0 then
    raise exception 'an issue needs at least one line before posting';
  end if;

  update public.inventory_issues
     set status = 'posted',
         posted_by = v_profile_id,
         posted_at = now()
   where id = p_issue_id;

  perform app.record_audit(
    'inventory.issue_posted',
    'inventory_issues',
    p_issue_id,
    null,
    jsonb_build_object('issue_number', v_issue.issue_number, 'lines', v_line_count),
    null,
    null
  );

  return p_issue_id;
end;
$$;

revoke all on function app.post_inventory_issue(uuid) from public;
grant execute on function app.post_inventory_issue(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reservation release
-- -----------------------------------------------------------------------------

create or replace function app.release_reservation_item(p_item_id uuid, p_quantity numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_item public.inventory_reservation_items%rowtype;
  v_outstanding numeric;
begin
  if v_organisation_id is null or app.current_profile_id() is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('inventory.manage') then
    raise exception 'permission denied for inventory reservations';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'the release quantity must be greater than zero';
  end if;

  select *
    into v_item
  from public.inventory_reservation_items
  where id = p_item_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'reservation item not found for this organisation';
  end if;

  v_outstanding := v_item.reserved_quantity - v_item.released_quantity - v_item.fulfilled_quantity;

  if p_quantity > v_outstanding then
    raise exception 'cannot release % when only % is outstanding', p_quantity, v_outstanding;
  end if;

  update public.inventory_reservation_items
     set released_quantity = released_quantity + p_quantity
   where id = p_item_id;

  perform app.refresh_reservation_status(v_item.reservation_id);

  perform app.record_audit(
    'inventory.reservation_released',
    'inventory_reservation_items',
    p_item_id,
    null,
    jsonb_build_object('released_quantity', p_quantity),
    null,
    null
  );

  return v_item.reservation_id;
end;
$$;

revoke all on function app.release_reservation_item(uuid, numeric) from public;
grant execute on function app.release_reservation_item(uuid, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- Public RPC wrappers
-- -----------------------------------------------------------------------------

create or replace function public.post_inventory_issue(p_issue_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.post_inventory_issue(p_issue_id)
$$;

revoke all on function public.post_inventory_issue(uuid) from public;
grant execute on function public.post_inventory_issue(uuid) to authenticated;

create or replace function public.release_reservation_item(p_item_id uuid, p_quantity numeric)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.release_reservation_item(p_item_id, p_quantity)
$$;

revoke all on function public.release_reservation_item(uuid, numeric) from public;
grant execute on function public.release_reservation_item(uuid, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- Audit on issue creation
-- -----------------------------------------------------------------------------

create or replace function app.audit_issue_event()
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
    case tg_table_name
      when 'inventory_issues' then 'inventory.issue_created'
      else 'inventory.issue_line_added'
    end,
    tg_table_name,
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_issue_event() from public;

create trigger inventory_issues_audit
  after insert on public.inventory_issues
  for each row execute function app.audit_issue_event();

create trigger inventory_issue_lines_audit
  after insert on public.inventory_issue_lines
  for each row execute function app.audit_issue_event();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index inventory_issues_org_idx
  on public.inventory_issues (organisation_id, issue_date desc);
create index inventory_issues_order_idx
  on public.inventory_issues (sales_order_id);
create index inventory_issue_lines_issue_idx
  on public.inventory_issue_lines (issue_id);
create index fifo_allocations_issue_idx
  on public.fifo_allocations (inventory_movement_id);
create index fifo_allocations_item_idx
  on public.fifo_allocations (sales_order_item_id);
create index inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.inventory_issues enable row level security;
alter table public.inventory_issue_lines enable row level security;
alter table public.fifo_allocations enable row level security;

create policy inventory_issues_read on public.inventory_issues
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

create policy inventory_issues_insert on public.inventory_issues
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
    and created_by = app.current_profile_id()
  );

create policy inventory_issue_lines_read on public.inventory_issue_lines
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

create policy inventory_issue_lines_insert on public.inventory_issue_lines
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
    and exists (
      select 1
      from public.inventory_issues i
      where i.id = issue_id
        and i.organisation_id = app.current_organisation_id()
        and i.status = 'draft'
    )
  );

create policy fifo_allocations_read on public.fifo_allocations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

-- Allocations and issue postings are written by trusted functions only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.inventory_issues, public.inventory_issue_lines,
  public.fifo_allocations from anon;

grant select, insert on public.inventory_issues, public.inventory_issue_lines to authenticated;
grant select on public.fifo_allocations to authenticated;

revoke update, delete, truncate on public.inventory_issues,
  public.inventory_issue_lines, public.fifo_allocations from authenticated, anon;

commit;
