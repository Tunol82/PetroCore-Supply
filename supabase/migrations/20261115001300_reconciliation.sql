-- =============================================================================
-- PetroCore Supply — Migration 13: Trip reconciliation and discrepancies
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001300.
--
-- Scope: reconciliation headers and items, delivery discrepancies and
-- investigation records.
--
-- Variance is calculated and stored but NOT classified as a loss or liability.
-- Tolerances (DR-03) and liability confirmation (DR-13) remain open decisions.
-- A discrepancy never becomes a driver, transporter or employee debt here.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Reconciliation headers
-- -----------------------------------------------------------------------------

create table public.trip_reconciliations (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete restrict,
  trip_id               uuid not null,
  reconciliation_number varchar(50) not null,
  status                varchar(30) not null default 'pending'
                        check (status in ('pending', 'under_review', 'completed', 'disputed')),
  completed_by          uuid references public.profiles (id) on delete restrict,
  completed_at          timestamptz,
  approved_by           uuid references public.profiles (id) on delete restrict,
  notes                 text,
  created_by            uuid references public.profiles (id) on delete restrict,
  created_at            timestamptz not null default now(),
  constraint trip_reconciliations_number_unique unique (organisation_id, reconciliation_number),
  constraint trip_reconciliations_trip_unique unique (organisation_id, trip_id),
  constraint trip_reconciliations_tenant_key unique (id, organisation_id),
  constraint trip_reconciliations_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict
);

create table public.trip_reconciliation_items (
  id                          uuid primary key default gen_random_uuid(),
  organisation_id             uuid not null references public.organisations (id) on delete restrict,
  reconciliation_id           uuid not null,
  trip_loading_record_id      uuid,
  trip_delivery_record_id     uuid,
  product_id                  uuid not null,
  loaded_quantity             numeric(18,3) not null check (loaded_quantity >= 0),
  delivered_quantity          numeric(18,3) not null check (delivered_quantity >= 0),
  variance_quantity           numeric(18,3)
                              generated always as (loaded_quantity - delivered_quantity) stored,
  tolerance_quantity          numeric(18,3) check (tolerance_quantity is null or tolerance_quantity >= 0),
  provisional_financial_impact numeric(18,2),
  reconciliation_status       varchar(30) not null default 'flagged'
                              check (reconciliation_status in (
                                'within_tolerance', 'flagged', 'investigated', 'resolved'
                              )),
  notes                       text,
  created_at                  timestamptz not null default now(),
  constraint trip_reconciliation_items_tenant_key unique (id, organisation_id),
  constraint trip_reconciliation_items_reconciliation_fk
    foreign key (reconciliation_id, organisation_id)
    references public.trip_reconciliations (id, organisation_id) on delete restrict,
  constraint trip_reconciliation_items_loading_fk
    foreign key (trip_loading_record_id, organisation_id)
    references public.trip_loading_records (id, organisation_id) on delete restrict,
  constraint trip_reconciliation_items_delivery_fk
    foreign key (trip_delivery_record_id, organisation_id)
    references public.trip_delivery_records (id, organisation_id) on delete restrict,
  constraint trip_reconciliation_items_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

create table public.delivery_discrepancies (
  id                          uuid primary key default gen_random_uuid(),
  organisation_id             uuid not null references public.organisations (id) on delete restrict,
  reconciliation_item_id      uuid not null,
  discrepancy_type            varchar(40) not null
                              check (discrepancy_type in (
                                'supplier', 'loading', 'transport',
                                'customer_measurement', 'other'
                              )),
  expected_quantity           numeric(18,3) not null check (expected_quantity >= 0),
  actual_quantity             numeric(18,3) not null check (actual_quantity >= 0),
  variance                    numeric(18,3)
                              generated always as (expected_quantity - actual_quantity) stored,
  provisional_financial_impact numeric(18,2),
  status                      varchar(30) not null default 'open'
                              check (status in (
                                'open', 'under_investigation', 'resolved', 'approved_loss'
                              )),
  reported_at                 timestamptz not null default now(),
  reported_by                 uuid references public.profiles (id) on delete restrict,
  created_at                  timestamptz not null default now(),
  constraint delivery_discrepancies_tenant_key unique (id, organisation_id),
  constraint delivery_discrepancies_item_fk
    foreign key (reconciliation_item_id, organisation_id)
    references public.trip_reconciliation_items (id, organisation_id) on delete restrict
);

create table public.discrepancy_investigations (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete restrict,
  discrepancy_id        uuid not null,
  findings              text,
  responsible_party_type varchar(40)
                        check (responsible_party_type is null or responsible_party_type in (
                          'supplier', 'transporter', 'customer', 'internal', 'unresolved'
                        )),
  responsible_party_id  uuid,
  responsibility_status varchar(30) not null default 'undetermined'
                        check (responsibility_status in ('undetermined', 'confirmed', 'cleared')),
  resolution            text,
  investigator_id       uuid references public.profiles (id) on delete restrict,
  approved_by           uuid references public.profiles (id) on delete restrict,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  constraint discrepancy_investigations_tenant_key unique (id, organisation_id),
  constraint discrepancy_investigations_discrepancy_fk
    foreign key (discrepancy_id, organisation_id)
    references public.delivery_discrepancies (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index trip_reconciliations_org_idx
  on public.trip_reconciliations (organisation_id, created_at desc);
create index trip_reconciliation_items_reconciliation_idx
  on public.trip_reconciliation_items (reconciliation_id);
create index delivery_discrepancies_item_idx
  on public.delivery_discrepancies (reconciliation_item_id);
create index discrepancy_investigations_discrepancy_idx
  on public.discrepancy_investigations (discrepancy_id);

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------

create or replace function app.audit_reconciliation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if app.current_profile_id() is null or app.current_organisation_id() is null then
    return new;
  end if;

  v_action := case tg_table_name
    when 'trip_reconciliations' then 'dispatch.reconciliation_created'
    when 'delivery_discrepancies' then 'dispatch.discrepancy_reported'
    when 'discrepancy_investigations' then 'dispatch.investigation_recorded'
    else tg_table_name || '.created'
  end;

  perform app.record_audit(
    v_action,
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

revoke all on function app.audit_reconciliation_event() from public;

create trigger trip_reconciliations_audit
  after insert on public.trip_reconciliations
  for each row execute function app.audit_reconciliation_event();

create trigger delivery_discrepancies_audit
  after insert on public.delivery_discrepancies
  for each row execute function app.audit_reconciliation_event();

create trigger discrepancy_investigations_audit
  after insert on public.discrepancy_investigations
  for each row execute function app.audit_reconciliation_event();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.trip_reconciliations enable row level security;
alter table public.trip_reconciliation_items enable row level security;
alter table public.delivery_discrepancies enable row level security;
alter table public.discrepancy_investigations enable row level security;

create policy trip_reconciliations_read on public.trip_reconciliations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_reconciliations_insert on public.trip_reconciliations
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and created_by = app.current_profile_id()
  );

create policy trip_reconciliations_update on public.trip_reconciliations
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (organisation_id = app.current_organisation_id());

create policy trip_reconciliation_items_read on public.trip_reconciliation_items
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_reconciliation_items_insert on public.trip_reconciliation_items
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy delivery_discrepancies_read on public.delivery_discrepancies
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy delivery_discrepancies_insert on public.delivery_discrepancies
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and reported_by = app.current_profile_id()
  );

create policy delivery_discrepancies_update on public.delivery_discrepancies
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (organisation_id = app.current_organisation_id());

create policy discrepancy_investigations_read on public.discrepancy_investigations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy discrepancy_investigations_insert on public.discrepancy_investigations
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

-- Investigations are append-only; corrections are new records.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.trip_reconciliations, public.trip_reconciliation_items,
  public.delivery_discrepancies, public.discrepancy_investigations from anon;

grant select, insert, update on public.trip_reconciliations,
  public.delivery_discrepancies to authenticated;
grant select, insert on public.trip_reconciliation_items,
  public.discrepancy_investigations to authenticated;

revoke delete, truncate on public.trip_reconciliations, public.trip_reconciliation_items,
  public.delivery_discrepancies, public.discrepancy_investigations
  from authenticated, anon;

commit;
