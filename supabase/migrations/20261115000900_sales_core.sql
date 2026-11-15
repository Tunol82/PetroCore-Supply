-- =============================================================================
-- PetroCore Supply — Migration 9: Customers, sales orders and order lines
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115000900.
--
-- Scope: customers, customer delivery locations, sales orders and confirmed
-- order lines.
--
-- Sales orders are commitments. They do not create invoices, receivables or
-- revenue. Credit availability, price-override approval and revenue
-- recognition remain open decisions (DR-07, DR-08, DR-11). credit_limit is a
-- configured limit only, not an available balance.
--
-- Orders and lines are append-only in this release: select and insert only.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (permission_key, description) values
  ('sales.view', 'View customers and sales orders'),
  ('sales.manage', 'Create and maintain customers and sales orders')
on conflict (permission_key) do nothing;

insert into public.role_permissions (organisation_id, role_id, permission_id)
select r.organisation_id, r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrator'
  and r.is_system_role
  and p.permission_key in ('sales.view', 'sales.manage')
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------

create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations (id) on delete restrict,
  customer_code     varchar(40) not null,
  name              varchar(200) not null,
  customer_category varchar(50) not null
                    check (customer_category in (
                      'individual', 'business', 'petrol_station', 'distributor', 'other'
                    )),
  phone             varchar(30),
  email             varchar(150),
  address           text,
  credit_limit      numeric(18,2) not null default 0 check (credit_limit >= 0),
  payment_terms     varchar(40),
  credit_status     varchar(25) not null default 'active'
                    check (credit_status in ('active', 'on_hold', 'suspended', 'closed')),
  status            varchar(20) not null default 'active'
                    check (status in ('active', 'inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint customers_code_unique unique (organisation_id, customer_code),
  constraint customers_tenant_key unique (id, organisation_id)
);

create table public.customer_locations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  customer_id     uuid not null,
  location_name   varchar(150) not null,
  address         text not null,
  contact_person  varchar(150),
  phone           varchar(30),
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  constraint customer_locations_tenant_key unique (id, organisation_id),
  constraint customer_locations_customer_key unique (id, customer_id, organisation_id),
  constraint customer_locations_customer_fk
    foreign key (customer_id, organisation_id)
    references public.customers (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Sales orders
-- -----------------------------------------------------------------------------

create table public.sales_orders (
  id                       uuid primary key default gen_random_uuid(),
  organisation_id          uuid not null references public.organisations (id) on delete restrict,
  order_number             varchar(50) not null,
  customer_id              uuid not null,
  customer_location_id     uuid,
  order_source             varchar(40) not null
                           check (order_source in (
                             'sales_representative', 'phone', 'whatsapp', 'other'
                           )),
  order_date               timestamptz not null default now(),
  requested_delivery_date  timestamptz,
  payment_arrangement      varchar(30) not null
                           check (payment_arrangement in (
                             'full_prepayment', 'deposit_balance', 'credit'
                           )),
  payment_terms            varchar(40),
  status                   varchar(30) not null default 'draft'
                           check (status in (
                             'draft', 'confirmed', 'partially_fulfilled',
                             'fulfilled', 'cancelled'
                           )),
  notes                    text,
  created_by               uuid references public.profiles (id) on delete restrict,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint sales_orders_number_unique unique (organisation_id, order_number),
  constraint sales_orders_tenant_key unique (id, organisation_id),
  constraint sales_orders_customer_fk
    foreign key (customer_id, organisation_id)
    references public.customers (id, organisation_id) on delete restrict,
  constraint sales_orders_location_fk
    foreign key (customer_location_id, customer_id, organisation_id)
    references public.customer_locations (id, customer_id, organisation_id) on delete restrict
);

create table public.sales_order_items (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations (id) on delete restrict,
  sales_order_id     uuid not null,
  product_id         uuid not null,
  quantity           numeric(18,3) not null check (quantity > 0),
  selling_price      numeric(18,4) not null check (selling_price >= 0),
  discount_amount    numeric(18,2) not null default 0 check (discount_amount >= 0),
  delivery_fee       numeric(18,2) not null default 0 check (delivery_fee >= 0),
  line_total         numeric(18,2)
                     generated always as (
                       round(quantity * selling_price - discount_amount + delivery_fee, 2)
                     ) stored,
  created_at         timestamptz not null default now(),
  constraint sales_order_items_product_unique unique (sales_order_id, product_id),
  constraint sales_order_items_tenant_key unique (id, organisation_id),
  constraint sales_order_items_order_fk
    foreign key (sales_order_id, organisation_id)
    references public.sales_orders (id, organisation_id) on delete restrict,
  constraint sales_order_items_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict,
  constraint sales_order_items_total check (line_total >= 0)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index customers_org_idx on public.customers (organisation_id);
create index customer_locations_org_idx on public.customer_locations (organisation_id);
create index customer_locations_customer_idx on public.customer_locations (customer_id);
create index sales_orders_org_idx on public.sales_orders (organisation_id, order_date desc);
create index sales_orders_customer_idx on public.sales_orders (customer_id);
create index sales_order_items_org_idx on public.sales_order_items (organisation_id);
create index sales_order_items_order_idx on public.sales_order_items (sales_order_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

create trigger sales_orders_set_updated_at
  before update on public.sales_orders
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit: sales order created
-- -----------------------------------------------------------------------------

create or replace function app.audit_sales_order()
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
    'sales.order_created',
    'sales_orders',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_sales_order() from public;

create trigger sales_orders_audit
  after insert on public.sales_orders
  for each row execute function app.audit_sales_order();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.customer_locations enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;

create policy customers_read on public.customers
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('sales.view') or app.has_permission('sales.manage'))
  );

create policy customers_manage on public.customers
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
  );

create policy customer_locations_read on public.customer_locations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('sales.view') or app.has_permission('sales.manage'))
  );

create policy customer_locations_manage on public.customer_locations
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
  );

create policy sales_orders_read on public.sales_orders
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('sales.view') or app.has_permission('sales.manage'))
  );

create policy sales_orders_insert on public.sales_orders
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
    and created_by = app.current_profile_id()
  );

create policy sales_order_items_read on public.sales_order_items
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('sales.view') or app.has_permission('sales.manage'))
  );

create policy sales_order_items_insert on public.sales_order_items
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('sales.manage')
  );

-- No update or delete policies: orders and lines are append-only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.customers, public.customer_locations,
  public.sales_orders, public.sales_order_items from anon;

grant select, insert, update, delete on public.customers,
  public.customer_locations to authenticated;

grant select, insert on public.sales_orders, public.sales_order_items to authenticated;
revoke update, delete, truncate on public.sales_orders, public.sales_order_items
  from authenticated, anon;

commit;
