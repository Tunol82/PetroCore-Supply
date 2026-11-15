-- =============================================================================
-- PetroCore Supply — Migration 15: Inventory batches and movement ledger
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001500.
--
-- Scope: verified receipt of storage procurement into a tenant-controlled
-- location, creating an inventory batch and an append-only receipt movement.
--
-- Deferred to the next slice: reservations, issues, FIFO allocations and
-- adjustments. Only posted issues will reduce physical stock.
--
-- Guarantees enforced here:
--   * only storage-receipt procurement can create an inventory batch;
--   * the procurement product must match the inventory product;
--   * the receiving location must be a storage location;
--   * receipt quantity cannot exceed the verified received quantity
--     (falling back to the supplier quantity when received is not recorded);
--   * every batch creates exactly one receipt movement;
--   * movements are append-only and net to at most one direction.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (permission_key, description) values
  ('inventory.view', 'View inventory batches and stock movements'),
  ('inventory.manage', 'Receive stock and manage inventory records')
on conflict (permission_key) do nothing;

insert into public.role_permissions (organisation_id, role_id, permission_id)
select r.organisation_id, r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrator'
  and r.is_system_role
  and p.permission_key in ('inventory.view', 'inventory.manage')
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.inventory_batches (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references public.organisations (id) on delete restrict,
  procurement_batch_id   uuid not null,
  product_id             uuid not null,
  location_id            uuid not null,
  original_quantity      numeric(18,3) not null check (original_quantity > 0),
  remaining_quantity     numeric(18,3) not null check (remaining_quantity >= 0),
  landed_cost_per_unit   numeric(18,4) not null default 0 check (landed_cost_per_unit >= 0),
  received_at            timestamptz not null default now(),
  status                 varchar(25) not null default 'available'
                         check (status in ('available', 'held', 'exhausted', 'closed')),
  created_by             uuid references public.profiles (id) on delete restrict,
  created_at             timestamptz not null default now(),
  constraint inventory_batches_receipt_unique unique (organisation_id, procurement_batch_id),
  constraint inventory_batches_tenant_key unique (id, organisation_id),
  constraint inventory_batches_remaining check (remaining_quantity <= original_quantity),
  constraint inventory_batches_procurement_fk
    foreign key (procurement_batch_id, organisation_id)
    references public.procurement_batches (id, organisation_id) on delete restrict,
  constraint inventory_batches_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict,
  constraint inventory_batches_location_fk
    foreign key (location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict
);

create table public.inventory_movements (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations (id) on delete restrict,
  product_id         uuid not null,
  location_id        uuid not null,
  inventory_batch_id uuid not null,
  movement_type      varchar(30) not null
                     check (movement_type in ('receipt', 'issue', 'adjustment', 'reversal')),
  quantity_in        numeric(18,3) not null default 0 check (quantity_in >= 0),
  quantity_out       numeric(18,3) not null default 0 check (quantity_out >= 0),
  reference_type     varchar(50) not null,
  reference_id       uuid not null,
  movement_date      timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete restrict,
  created_at         timestamptz not null default now(),
  constraint inventory_movements_direction check (
    (quantity_in > 0 and quantity_out = 0) or (quantity_out > 0 and quantity_in = 0)
  ),
  constraint inventory_movements_batch_fk
    foreign key (inventory_batch_id, organisation_id)
    references public.inventory_batches (id, organisation_id) on delete restrict,
  constraint inventory_movements_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict,
  constraint inventory_movements_location_fk
    foreign key (location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Receipt validation and ledger posting
-- -----------------------------------------------------------------------------

create or replace function app.validate_inventory_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_procurement_product uuid;
  v_fulfilment_type varchar(40);
  v_received numeric;
  v_is_storage boolean;
begin
  select product_id, fulfilment_type, coalesce(received_quantity, supplier_quantity)
    into v_procurement_product, v_fulfilment_type, v_received
  from public.procurement_batches
  where id = new.procurement_batch_id
    and organisation_id = new.organisation_id;

  if v_procurement_product is null then
    raise exception 'procurement batch not found for this organisation';
  end if;

  if v_fulfilment_type <> 'storage_receipt' then
    raise exception 'only storage-receipt procurement can create inventory';
  end if;

  if v_procurement_product <> new.product_id then
    raise exception 'inventory product does not match the procurement batch';
  end if;

  select is_storage_location into v_is_storage
  from public.business_locations
  where id = new.location_id
    and organisation_id = new.organisation_id;

  if v_is_storage is null or v_is_storage is not true then
    raise exception 'inventory must be received into a storage location';
  end if;

  if new.original_quantity > v_received then
    raise exception 'receipt quantity % exceeds the verified quantity %',
      new.original_quantity, v_received;
  end if;

  return new;
end;
$$;

revoke all on function app.validate_inventory_batch() from public;

create trigger inventory_batches_validate
  before insert on public.inventory_batches
  for each row execute function app.validate_inventory_batch();

create or replace function app.post_inventory_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_movements (
    organisation_id, product_id, location_id, inventory_batch_id,
    movement_type, quantity_in, quantity_out,
    reference_type, reference_id, movement_date, created_by
  ) values (
    new.organisation_id, new.product_id, new.location_id, new.id,
    'receipt', new.original_quantity, 0,
    'procurement_batch', new.procurement_batch_id, new.received_at, new.created_by
  );

  if app.current_profile_id() is not null and app.current_organisation_id() is not null then
    perform app.record_audit(
      'inventory.receipt_recorded',
      'inventory_batches',
      new.id,
      null,
      to_jsonb(new),
      null,
      null
    );
  end if;

  return new;
end;
$$;

revoke all on function app.post_inventory_receipt() from public;

create trigger inventory_batches_post_receipt
  after insert on public.inventory_batches
  for each row execute function app.post_inventory_receipt();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index inventory_batches_org_idx on public.inventory_batches (organisation_id, received_at desc);
create index inventory_batches_product_idx on public.inventory_batches (product_id);
create index inventory_batches_location_idx on public.inventory_batches (location_id);
create index inventory_movements_org_idx on public.inventory_movements (organisation_id, movement_date desc);
create index inventory_movements_batch_idx on public.inventory_movements (inventory_batch_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.inventory_batches enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_batches_read on public.inventory_batches
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

create policy inventory_batches_insert on public.inventory_batches
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
    and created_by = app.current_profile_id()
  );

create policy inventory_batches_update on public.inventory_batches
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('inventory.manage')
  )
  with check (organisation_id = app.current_organisation_id());

create policy inventory_movements_read on public.inventory_movements
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('inventory.view') or app.has_permission('inventory.manage'))
  );

-- Movements are written by trusted functions only; no insert policy.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.inventory_batches, public.inventory_movements from anon;

grant select, insert, update on public.inventory_batches to authenticated;
revoke delete, truncate on public.inventory_batches from authenticated, anon;

grant select on public.inventory_movements to authenticated;
revoke insert, update, delete, truncate on public.inventory_movements
  from authenticated, anon;

commit;
