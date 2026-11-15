-- =============================================================================
-- PetroCore Supply — Migration 11: Trip loading and procurement allocations
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001100.
--
-- Scope: compartment loading records and typed direct-procurement allocations.
--
-- Inventory batches do not exist yet, so only the procurement source path is
-- modelled here. The typed table mirrors the approved v1.2 design and leaves
-- room for an inventory allocation table later.
--
-- Enforced now:
--   * loaded quantity cannot exceed compartment capacity;
--   * an allocation's product must match both the loading record and the
--     procurement batch (and the sales order line, when supplied);
--   * allocations per loading record cannot exceed the loaded quantity;
--   * allocations per procurement batch cannot exceed the supplier quantity.
--
-- Measurement tolerances remain open (DR-01/DR-03); values are recorded as
-- supplied and never adjusted here.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Loading records
-- -----------------------------------------------------------------------------

create table public.trip_loading_records (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  trip_id          uuid not null,
  compartment_id   uuid not null,
  product_id       uuid not null,
  loaded_quantity  numeric(18,3) not null check (loaded_quantity > 0),
  loading_ticket   varchar(100),
  seal_number      varchar(100),
  loading_time     timestamptz not null default now(),
  officer_id       uuid references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint trip_loading_records_tenant_key unique (id, organisation_id),
  constraint trip_loading_records_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict,
  constraint trip_loading_records_compartment_fk
    foreign key (compartment_id, organisation_id)
    references public.truck_compartments (id, organisation_id) on delete restrict,
  constraint trip_loading_records_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

create table public.trip_loading_procurement_allocations (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null references public.organisations (id) on delete restrict,
  trip_loading_record_id  uuid not null,
  procurement_batch_id    uuid not null,
  sales_order_item_id     uuid,
  product_id              uuid not null,
  allocated_quantity      numeric(18,3) not null check (allocated_quantity > 0),
  created_by              uuid references public.profiles (id) on delete restrict,
  created_at              timestamptz not null default now(),
  constraint trip_loading_allocations_unique unique (trip_loading_record_id, procurement_batch_id),
  constraint trip_loading_allocations_record_fk
    foreign key (trip_loading_record_id, organisation_id)
    references public.trip_loading_records (id, organisation_id) on delete restrict,
  constraint trip_loading_allocations_batch_fk
    foreign key (procurement_batch_id, organisation_id)
    references public.procurement_batches (id, organisation_id) on delete restrict,
  constraint trip_loading_allocations_sales_item_fk
    foreign key (sales_order_item_id, organisation_id)
    references public.sales_order_items (id, organisation_id) on delete restrict,
  constraint trip_loading_allocations_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Validation triggers
-- -----------------------------------------------------------------------------

create or replace function app.validate_loading_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity numeric;
begin
  select capacity into v_capacity
  from public.truck_compartments
  where id = new.compartment_id
    and organisation_id = new.organisation_id;

  if v_capacity is null then
    raise exception 'compartment not found for this organisation';
  end if;

  if new.loaded_quantity > v_capacity then
    raise exception 'loaded quantity % exceeds compartment capacity %',
      new.loaded_quantity, v_capacity;
  end if;

  return new;
end;
$$;

revoke all on function app.validate_loading_record() from public;

create trigger trip_loading_records_validate
  before insert on public.trip_loading_records
  for each row execute function app.validate_loading_record();

create or replace function app.validate_loading_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_product uuid;
  v_record_quantity numeric;
  v_batch_product uuid;
  v_batch_quantity numeric;
  v_sales_product uuid;
  v_record_allocated numeric;
  v_batch_allocated numeric;
begin
  select product_id, loaded_quantity
    into v_record_product, v_record_quantity
  from public.trip_loading_records
  where id = new.trip_loading_record_id
    and organisation_id = new.organisation_id;

  if v_record_product is null then
    raise exception 'loading record not found for this organisation';
  end if;

  select product_id, supplier_quantity
    into v_batch_product, v_batch_quantity
  from public.procurement_batches
  where id = new.procurement_batch_id
    and organisation_id = new.organisation_id;

  if v_batch_product is null then
    raise exception 'procurement batch not found for this organisation';
  end if;

  if new.product_id <> v_record_product or new.product_id <> v_batch_product then
    raise exception 'allocation product does not match the loading record and procurement batch';
  end if;

  if new.sales_order_item_id is not null then
    select product_id into v_sales_product
    from public.sales_order_items
    where id = new.sales_order_item_id
      and organisation_id = new.organisation_id;

    if v_sales_product is null or v_sales_product <> new.product_id then
      raise exception 'sales order line product does not match the allocation';
    end if;
  end if;

  select coalesce(sum(allocated_quantity), 0)
    into v_record_allocated
  from public.trip_loading_procurement_allocations
  where trip_loading_record_id = new.trip_loading_record_id;

  if v_record_allocated + new.allocated_quantity > v_record_quantity then
    raise exception 'allocations exceed the loaded quantity for this record';
  end if;

  select coalesce(sum(allocated_quantity), 0)
    into v_batch_allocated
  from public.trip_loading_procurement_allocations
  where procurement_batch_id = new.procurement_batch_id;

  if v_batch_allocated + new.allocated_quantity > v_batch_quantity then
    raise exception 'allocations exceed the procurement batch supplier quantity';
  end if;

  return new;
end;
$$;

revoke all on function app.validate_loading_allocation() from public;

create trigger trip_loading_allocations_validate
  before insert on public.trip_loading_procurement_allocations
  for each row execute function app.validate_loading_allocation();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index trip_loading_records_org_idx
  on public.trip_loading_records (organisation_id, loading_time desc);
create index trip_loading_records_trip_idx on public.trip_loading_records (trip_id);
create index trip_loading_allocations_record_idx
  on public.trip_loading_procurement_allocations (trip_loading_record_id);
create index trip_loading_allocations_batch_idx
  on public.trip_loading_procurement_allocations (procurement_batch_id);

-- -----------------------------------------------------------------------------
-- Audit: loading recorded
-- -----------------------------------------------------------------------------

create or replace function app.audit_loading_record()
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
    'dispatch.loading_recorded',
    'trip_loading_records',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_loading_record() from public;

create trigger trip_loading_records_audit
  after insert on public.trip_loading_records
  for each row execute function app.audit_loading_record();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.trip_loading_records enable row level security;
alter table public.trip_loading_procurement_allocations enable row level security;

create policy trip_loading_records_read on public.trip_loading_records
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_loading_records_insert on public.trip_loading_records
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy trip_loading_allocations_read on public.trip_loading_procurement_allocations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_loading_allocations_insert on public.trip_loading_procurement_allocations
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and created_by = app.current_profile_id()
  );

-- No update or delete policies: loading evidence is append-only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.trip_loading_records,
  public.trip_loading_procurement_allocations from anon;

grant select, insert on public.trip_loading_records,
  public.trip_loading_procurement_allocations to authenticated;
revoke update, delete, truncate on public.trip_loading_records,
  public.trip_loading_procurement_allocations from authenticated, anon;

commit;

