-- =============================================================================
-- PetroCore Supply — Migration 17: Inventory reservations
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001700.
--
-- Reservations commit stock to a sales order without moving it. They reduce
-- available-to-promise stock, never the physical remaining quantity.
--
-- Guarantees enforced here:
--   * a reserved batch must belong to the tenant and sit at the reservation
--     location, which must be a storage location;
--   * the reserved product must match the sales order line;
--   * active reservations on a batch cannot exceed the batch's remaining
--     quantity. The batch row is locked while checking, so two concurrent
--     reservations cannot both pass.
--
-- Reservations and items are insert-only for ordinary users; fulfilment and
-- release happen through trusted functions added in migration 18.
-- =============================================================================

begin;

create table public.inventory_reservations (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations (id) on delete restrict,
  reservation_number varchar(50) not null,
  sales_order_id     uuid not null,
  location_id        uuid not null,
  reservation_date   timestamptz not null default now(),
  expiry_at          timestamptz,
  status             varchar(25) not null default 'active'
                     check (status in (
                       'active', 'partially_fulfilled', 'fulfilled', 'released', 'cancelled'
                     )),
  notes              text,
  created_by         uuid references public.profiles (id) on delete restrict,
  created_at         timestamptz not null default now(),
  constraint inventory_reservations_number_unique unique (organisation_id, reservation_number),
  constraint inventory_reservations_tenant_key unique (id, organisation_id),
  constraint inventory_reservations_order_fk
    foreign key (sales_order_id, organisation_id)
    references public.sales_orders (id, organisation_id) on delete restrict,
  constraint inventory_reservations_location_fk
    foreign key (location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict
);

create table public.inventory_reservation_items (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete restrict,
  reservation_id       uuid not null,
  sales_order_item_id  uuid not null,
  inventory_batch_id   uuid not null,
  reserved_quantity    numeric(18,3) not null check (reserved_quantity > 0),
  released_quantity    numeric(18,3) not null default 0 check (released_quantity >= 0),
  fulfilled_quantity   numeric(18,3) not null default 0 check (fulfilled_quantity >= 0),
  created_at           timestamptz not null default now(),
  constraint inventory_reservation_items_tenant_key unique (id, organisation_id),
  constraint inventory_reservation_items_settled check (
    released_quantity + fulfilled_quantity <= reserved_quantity
  ),
  constraint inventory_reservation_items_reservation_fk
    foreign key (reservation_id, organisation_id)
    references public.inventory_reservations (id, organisation_id) on delete restrict,
  constraint inventory_reservation_items_order_item_fk
    foreign key (sales_order_item_id, organisation_id)
    references public.sales_order_items (id, organisation_id) on delete restrict,
  constraint inventory_reservation_items_batch_fk
    foreign key (inventory_batch_id, organisation_id)
    references public.inventory_batches (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------

create or replace function app.validate_reservation_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_product uuid;
  v_batch_location uuid;
  v_batch_remaining numeric;
  v_item_product uuid;
  v_location_id uuid;
  v_location_is_storage boolean;
  v_active_reserved numeric;
begin
  select b.product_id, b.location_id, b.remaining_quantity
    into v_batch_product, v_batch_location, v_batch_remaining
  from public.inventory_batches b
  where b.id = new.inventory_batch_id
    and b.organisation_id = new.organisation_id
  for update;

  if v_batch_product is null then
    raise exception 'inventory batch not found for this organisation';
  end if;

  select soi.product_id, r.location_id, l.is_storage_location
    into v_item_product, v_location_id, v_location_is_storage
  from public.sales_order_items soi
  join public.inventory_reservations r
    on r.id = new.reservation_id
   and r.organisation_id = new.organisation_id
  join public.business_locations l
    on l.id = r.location_id
   and l.organisation_id = new.organisation_id
  where soi.id = new.sales_order_item_id
    and soi.organisation_id = new.organisation_id;

  if v_item_product is null then
    raise exception 'reservation or sales order line not found';
  end if;

  if not v_location_is_storage then
    raise exception 'reservations must belong to a storage location';
  end if;

  if v_batch_product <> v_item_product then
    raise exception 'reserved product does not match the sales order line';
  end if;

  if v_batch_location <> v_location_id then
    raise exception 'reserved batch is not at the reservation location';
  end if;

  select coalesce(sum(ri.reserved_quantity - ri.released_quantity - ri.fulfilled_quantity), 0)
    into v_active_reserved
  from public.inventory_reservation_items ri
  join public.inventory_reservations r
    on r.id = ri.reservation_id
   and r.organisation_id = ri.organisation_id
  where ri.inventory_batch_id = new.inventory_batch_id
    and r.status in ('active', 'partially_fulfilled');

  if v_active_reserved + new.reserved_quantity > v_batch_remaining then
    raise exception 'reservation exceeds the available quantity of %',
      v_batch_remaining - v_active_reserved;
  end if;

  return new;
end;
$$;

revoke all on function app.validate_reservation_item() from public;

create trigger inventory_reservation_items_validate
  before insert on public.inventory_reservation_items
  for each row execute function app.validate_reservation_item();

-- -----------------------------------------------------------------------------
-- Status helper used by posting and release functions
-- -----------------------------------------------------------------------------

create or replace function app.refresh_reservation_status(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_settled integer;
  v_fulfilled integer;
  v_status varchar(25);
begin
  select count(*),
         count(*) filter (where fulfilled_quantity + released_quantity >= reserved_quantity),
         count(*) filter (where fulfilled_quantity > 0)
    into v_total, v_settled, v_fulfilled
  from public.inventory_reservation_items
  where reservation_id = p_reservation_id;

  if v_total > 0 and v_settled = v_total then
    v_status := case when v_fulfilled > 0 then 'fulfilled' else 'released' end;
  elsif v_fulfilled > 0 then
    v_status := 'partially_fulfilled';
  else
    v_status := 'active';
  end if;

  update public.inventory_reservations
     set status = v_status
   where id = p_reservation_id
     and status <> 'cancelled';
end;
$$;

revoke all on function app.refresh_reservation_status(uuid) from public;
grant execute on function app.refresh_reservation_status(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------

create or replace function app.audit_reservation_event()
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
      when 'inventory_reservations' then 'inventory.reservation_created'
      else 'inventory.reservation_item_added'
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

revoke all on function app.audit_reservation_event() from public;

create trigger inventory_reservations_audit
  after insert on public.inventory_reservations
  for each row execute function app.audit_reservation_event();

create trigger inventory_reservation_items_audit
  after insert on public.inventory_reservation_items
  for each row execute function app.audit_reservation_event();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index inventory_reservations_org_idx
  on public.inventory_reservations (organisation_id, reservation_date desc);
create index inventory_reservations_order_idx
  on public.inventory_reservations (sales_order_id);
create index inventory_reservation_items_reservation_idx
  on public.inventory_reservation_items (reservation_id);
create index inventory_reservation_items_batch_idx
  on public.inventory_reservation_items (inventory_batch_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.inventory_reservations enable row level security;
alter table public.inventory_reservation_items enable row level security;

create policy inventory_reservations_read on public.inventory_reservations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

create policy inventory_reservations_insert on public.inventory_reservations
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
    and created_by = app.current_profile_id()
  );

create policy inventory_reservation_items_read on public.inventory_reservation_items
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

create policy inventory_reservation_items_insert on public.inventory_reservation_items
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
    and exists (
      select 1
      from public.inventory_reservations r
      where r.id = reservation_id
        and r.organisation_id = app.current_organisation_id()
    )
  );

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.inventory_reservations, public.inventory_reservation_items from anon;

grant select, insert on public.inventory_reservations,
  public.inventory_reservation_items to authenticated;

revoke update, delete, truncate on public.inventory_reservations,
  public.inventory_reservation_items from authenticated, anon;

commit;
