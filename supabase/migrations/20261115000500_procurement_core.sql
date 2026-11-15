-- =============================================================================
-- PetroCore Supply — Migration 5: Procurement master data and batch capture
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115000500.
--
-- Scope: suppliers, supplier depots, products and procurement batches.
-- Purchase orders and sales linkage are deferred to the next migration.
--
-- Measurement policy is still open (DR-01/DR-02/DR-03). This migration records
-- three separate quantities exactly as supplied and does NOT apply tolerances,
-- temperature correction or variance assessment. variance_status defaults to
-- 'not_assessed'.
--
-- Procurement batches are append-only: select and insert policies exist, but no
-- update or delete policy. Corrections will use a later adjustment workflow.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (permission_key, description) values
  ('procurement.view', 'View suppliers, products and procurement batches'),
  ('procurement.manage', 'Create and maintain procurement master data and batches')
on conflict (permission_key) do nothing;

-- Grant the new permissions to existing tenant administrator roles.
insert into public.role_permissions (organisation_id, role_id, permission_id)
select r.organisation_id, r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrator'
  and r.is_system_role
  and p.permission_key in ('procurement.view', 'procurement.manage')
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Suppliers
-- -----------------------------------------------------------------------------

create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  supplier_code   varchar(40) not null,
  name            varchar(200) not null,
  contact_person  varchar(150),
  phone           varchar(30),
  email           varchar(150),
  address         text,
  tax_identifier  varchar(60),
  payment_terms   varchar(40),
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint suppliers_code_unique unique (organisation_id, supplier_code),
  constraint suppliers_tenant_key unique (id, organisation_id)
);

create table public.supplier_depots (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete restrict,
  supplier_id          uuid not null,
  depot_code           varchar(40) not null,
  name                 varchar(200) not null,
  address              text,
  location_description varchar(200),
  contact_person       varchar(150),
  phone                varchar(30),
  status               varchar(20) not null default 'active'
                       check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  constraint supplier_depots_code_unique unique (organisation_id, supplier_id, depot_code),
  constraint supplier_depots_tenant_key unique (id, organisation_id),
  constraint supplier_depots_supplier_key unique (id, supplier_id, organisation_id),
  constraint supplier_depots_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------

create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete restrict,
  product_code         varchar(40) not null,
  product_name         varchar(120) not null,
  product_type         varchar(60) not null,
  description          text,
  unit_of_measure      varchar(20) not null default 'litres',
  quality_requirements text,
  status               varchar(20) not null default 'active'
                       check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint products_code_unique unique (organisation_id, product_code),
  constraint products_tenant_key unique (id, organisation_id)
);

-- -----------------------------------------------------------------------------
-- Procurement batches
-- -----------------------------------------------------------------------------

create table public.procurement_batches (
  id                       uuid primary key default gen_random_uuid(),
  organisation_id          uuid not null references public.organisations (id) on delete restrict,
  batch_number             varchar(60) not null,
  supplier_id              uuid not null,
  supplier_depot_id        uuid not null,
  product_id               uuid not null,
  supplier_quantity        numeric(18,3) not null check (supplier_quantity > 0),
  loaded_quantity          numeric(18,3) check (loaded_quantity is null or loaded_quantity > 0),
  received_quantity        numeric(18,3) check (received_quantity is null or received_quantity > 0),
  received_at_location_id  uuid,
  fulfilment_type          varchar(40) not null
                           check (fulfilment_type in ('storage_receipt', 'direct_customer_delivery')),
  supplier_invoice_number  varchar(80),
  supplier_loading_ticket  varchar(100),
  loading_date             timestamptz,
  receipt_date             timestamptz,
  supplier_loading_variance numeric(18,3)
                            generated always as (supplier_quantity - loaded_quantity) stored,
  loading_receipt_variance  numeric(18,3)
                            generated always as (loaded_quantity - received_quantity) stored,
  total_quantity_variance   numeric(18,3)
                            generated always as (supplier_quantity - received_quantity) stored,
  variance_status          varchar(30) not null default 'not_assessed'
                           check (variance_status in (
                             'not_assessed', 'within_tolerance', 'flagged',
                             'under_investigation', 'resolved'
                           )),
  status                   varchar(30) not null default 'recorded',
  created_by               uuid references public.profiles (id) on delete restrict,
  created_at               timestamptz not null default now(),
  constraint procurement_batches_number_unique unique (organisation_id, batch_number),
  constraint procurement_batches_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict,
  constraint procurement_batches_depot_fk
    foreign key (supplier_depot_id, supplier_id, organisation_id)
    references public.supplier_depots (id, supplier_id, organisation_id) on delete restrict,
  constraint procurement_batches_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict,
  constraint procurement_batches_location_fk
    foreign key (received_at_location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index suppliers_org_idx on public.suppliers (organisation_id);
create index supplier_depots_org_idx on public.supplier_depots (organisation_id);
create index supplier_depots_supplier_idx on public.supplier_depots (supplier_id);
create index products_org_idx on public.products (organisation_id);
create index procurement_batches_org_idx on public.procurement_batches (organisation_id, created_at desc);
create index procurement_batches_supplier_idx on public.procurement_batches (supplier_id);
create index procurement_batches_product_idx on public.procurement_batches (product_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function app.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit: procurement batch recorded
-- -----------------------------------------------------------------------------

create or replace function app.audit_procurement_batch()
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
    'procurement.batch_recorded',
    'procurement_batches',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_procurement_batch() from public;

create trigger procurement_batches_audit
  after insert on public.procurement_batches
  for each row execute function app.audit_procurement_batch();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.supplier_depots enable row level security;
alter table public.products enable row level security;
alter table public.procurement_batches enable row level security;

create policy suppliers_read on public.suppliers
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy suppliers_manage on public.suppliers
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

create policy supplier_depots_read on public.supplier_depots
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy supplier_depots_manage on public.supplier_depots
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

create policy products_read on public.products
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy products_manage on public.products
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

create policy procurement_batches_read on public.procurement_batches
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy procurement_batches_insert on public.procurement_batches
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
    and created_by = app.current_profile_id()
  );

-- No update or delete policy: procurement batches are append-only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.suppliers, public.supplier_depots, public.products,
  public.procurement_batches from anon;

grant select, insert, update, delete on public.suppliers,
  public.supplier_depots, public.products to authenticated;

grant select, insert on public.procurement_batches to authenticated;

commit;
