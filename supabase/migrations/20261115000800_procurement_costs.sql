-- =============================================================================
-- PetroCore Supply — Migration 8: Supplier pricing and landed-cost components
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115000800.
--
-- Scope: supplier-product links, cost categories and procurement cost
-- components. Allocation to inventory or direct fulfilment is deliberately NOT
-- implemented: it depends on DR-06 and DR-21.
--
-- Cost components are append-only evidence. Approval status defaults to
-- 'pending'; the approval workflow is deferred (DR-20). Outbound delivery
-- haulage must not be recorded here.
-- =============================================================================

begin;

-- Parent key needed for the cost-component composite foreign key.
alter table public.procurement_batches
  add constraint procurement_batches_tenant_key unique (id, organisation_id);

-- -----------------------------------------------------------------------------
-- Supplier products
-- -----------------------------------------------------------------------------

create table public.supplier_products (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete restrict,
  supplier_id           uuid not null,
  product_id            uuid not null,
  supplier_product_code varchar(60),
  status                varchar(20) not null default 'active'
                        check (status in ('active', 'inactive')),
  created_at            timestamptz not null default now(),
  constraint supplier_products_unique unique (organisation_id, supplier_id, product_id),
  constraint supplier_products_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict,
  constraint supplier_products_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Cost categories
-- -----------------------------------------------------------------------------

create table public.cost_categories (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references public.organisations (id) on delete restrict,
  category_name          varchar(120) not null,
  category_type          varchar(40) not null
                         check (category_type in (
                           'acquisition', 'inbound_transport', 'handling',
                           'inspection', 'documentation', 'security', 'other'
                         )),
  landed_cost_inclusion  boolean not null default false,
  allocation_method      varchar(30) not null default 'manual'
                         check (allocation_method in (
                           'per_litre', 'percentage', 'fixed', 'product_value', 'manual'
                         )),
  requires_approval      boolean not null default false,
  requires_evidence      boolean not null default false,
  status                 varchar(20) not null default 'active'
                         check (status in ('active', 'inactive')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint cost_categories_name_unique unique (organisation_id, category_name),
  constraint cost_categories_tenant_key unique (id, organisation_id)
);

-- -----------------------------------------------------------------------------
-- Procurement cost components
-- -----------------------------------------------------------------------------

create table public.procurement_cost_components (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete restrict,
  procurement_batch_id  uuid not null,
  cost_category_id      uuid not null,
  description           text,
  amount                numeric(18,2) not null check (amount > 0),
  supplier_id           uuid,
  reference_number      varchar(100),
  evidence_path         text,
  approval_status       varchar(20) not null default 'pending'
                        check (approval_status in ('pending', 'approved', 'rejected')),
  recorded_by           uuid references public.profiles (id) on delete restrict,
  created_at            timestamptz not null default now(),
  constraint procurement_cost_components_batch_fk
    foreign key (procurement_batch_id, organisation_id)
    references public.procurement_batches (id, organisation_id) on delete restrict,
  constraint procurement_cost_components_category_fk
    foreign key (cost_category_id, organisation_id)
    references public.cost_categories (id, organisation_id) on delete restrict,
  constraint procurement_cost_components_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index supplier_products_org_idx on public.supplier_products (organisation_id);
create index supplier_products_supplier_idx on public.supplier_products (supplier_id);
create index cost_categories_org_idx on public.cost_categories (organisation_id);
create index procurement_cost_components_org_idx
  on public.procurement_cost_components (organisation_id, created_at desc);
create index procurement_cost_components_batch_idx
  on public.procurement_cost_components (procurement_batch_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create trigger cost_categories_set_updated_at
  before update on public.cost_categories
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit: cost component recorded
-- -----------------------------------------------------------------------------

create or replace function app.audit_procurement_cost()
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
    'procurement.cost_recorded',
    'procurement_cost_components',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_procurement_cost() from public;

create trigger procurement_cost_components_audit
  after insert on public.procurement_cost_components
  for each row execute function app.audit_procurement_cost();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.supplier_products enable row level security;
alter table public.cost_categories enable row level security;
alter table public.procurement_cost_components enable row level security;

create policy supplier_products_read on public.supplier_products
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy supplier_products_manage on public.supplier_products
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

create policy cost_categories_read on public.cost_categories
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy cost_categories_manage on public.cost_categories
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
  );

create policy procurement_cost_components_read on public.procurement_cost_components
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('procurement.view') or app.has_permission('procurement.manage'))
  );

create policy procurement_cost_components_insert on public.procurement_cost_components
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('procurement.manage')
    and recorded_by = app.current_profile_id()
  );

-- No update or delete policy: cost components are append-only evidence.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.supplier_products, public.cost_categories,
  public.procurement_cost_components from anon;

grant select, insert, update, delete on public.supplier_products,
  public.cost_categories to authenticated;
revoke update, delete, truncate on public.procurement_cost_components
  from authenticated, anon;
grant select, insert on public.procurement_cost_components to authenticated;

commit;
