-- =============================================================================
-- PetroCore Supply — Migration 7: Purchase orders and batch linkage
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115000700.
--
-- Scope: purchase orders and their line items, plus an optional link from a
-- procurement batch to the purchase-order line it fulfils.
--
-- Purchase orders are commitments. They do not create inventory. Orders and
-- lines are append-only in this release: select and insert policies only. A
-- cancellation/amendment workflow is deferred until the approval model exists.
--
-- Prices are operational values, not accounting postings. Landed-cost
-- allocation and revenue recognition remain open decisions.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Purchase orders
-- -----------------------------------------------------------------------------

create table public.purchase_orders (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  po_number        varchar(50) not null,
  supplier_id      uuid not null,
  supplier_depot_id uuid,
  order_date       date not null,
  expected_date    date,
  currency         varchar(3) not null default 'NGN' check (currency = 'NGN'),
  payment_terms    varchar(40),
  status           varchar(30) not null default 'draft'
                   check (status in (
                     'draft', 'submitted', 'approved',
                     'partially_fulfilled', 'fulfilled', 'cancelled'
                   )),
  notes            text,
  created_by       uuid references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint purchase_orders_number_unique unique (organisation_id, po_number),
  constraint purchase_orders_tenant_key unique (id, organisation_id),
  constraint purchase_orders_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict,
  constraint purchase_orders_depot_fk
    foreign key (supplier_depot_id, supplier_id, organisation_id)
    references public.supplier_depots (id, supplier_id, organisation_id) on delete restrict,
  constraint purchase_orders_expected_after_order check (
    expected_date is null or expected_date >= order_date
  )
);

create table public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations (id) on delete restrict,
  purchase_order_id  uuid not null,
  product_id         uuid not null,
  ordered_quantity   numeric(18,3) not null check (ordered_quantity > 0),
  agreed_unit_price  numeric(18,4) not null check (agreed_unit_price >= 0),
  discount_amount    numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total         numeric(18,2)
                     generated always as (
                       round(ordered_quantity * agreed_unit_price - discount_amount, 2)
                     ) stored,
  created_at         timestamptz not null default now(),
  constraint purchase_order_items_product_unique unique (purchase_order_id, product_id),
  constraint purchase_order_items_tenant_key unique (id, organisation_id),
  constraint purchase_order_items_order_fk
    foreign key (purchase_order_id, organisation_id)
    references public.purchase_orders (id, organisation_id) on delete restrict,
  constraint purchase_order_items_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict,
  constraint purchase_order_items_line_total check (line_total >= 0)
);

-- -----------------------------------------------------------------------------
-- Batch linkage to a purchase-order line
-- -----------------------------------------------------------------------------

alter table public.procurement_batches
  add column purchase_order_item_id uuid;

alter table public.procurement_batches
  add constraint procurement_batches_po_item_fk
  foreign key (purchase_order_item_id, organisation_id)
  references public.purchase_order_items (id, organisation_id) on delete restrict;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index purchase_orders_org_idx on public.purchase_orders (organisation_id, order_date desc);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_order_items_org_idx on public.purchase_order_items (organisation_id);
create index purchase_order_items_order_idx on public.purchase_order_items (purchase_order_id);
create index procurement_batches_po_item_idx on public.procurement_batches (purchase_order_item_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit: purchase order created
-- -----------------------------------------------------------------------------

create or replace function app.audit_purchase_order()
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
    'procurement.purchase_order_created',
    'purchase_orders',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_purchase_order() from public;

create trigger purchase_orders_audit
  after insert on public.purchase_orders
  for each row execute function app.audit_purchase_order();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy purchase_orders_read on public.purchase_orders
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy purchase_orders_insert on public.purchase_orders
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
    and created_by = app.current_profile_id()
  );

create policy purchase_order_items_read on public.purchase_order_items
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy purchase_order_items_insert on public.purchase_order_items
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

-- No update or delete policies: purchase orders and lines are append-only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.purchase_orders, public.purchase_order_items from anon;

grant select, insert on public.purchase_orders, public.purchase_order_items to authenticated;
revoke update, delete, truncate on public.purchase_orders, public.purchase_order_items
  from authenticated, anon;

commit;
