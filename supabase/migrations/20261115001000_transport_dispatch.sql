-- =============================================================================
-- PetroCore Supply — Migration 10: Transport, fleet and dispatch
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001000.
--
-- Scope: transporters, trucks, compartments, drivers, trips and trip
-- assignments.
--
-- Explicitly deferred: truck/driver double-booking prevention across time
-- ranges, trip loading, deliveries, reconciliations and transporter invoices.
-- Those need the dispatch and reconciliation decisions to be finalised.
--
-- Third-party drivers are operational records only; they are not employees and
-- create no payroll obligation.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (permission_key, description) values
  ('transport.view', 'View transporters, fleet, drivers, trips and assignments'),
  ('transport.manage', 'Manage transporters, fleet, drivers, trips and assignments')
on conflict (permission_key) do nothing;

insert into public.role_permissions (organisation_id, role_id, permission_id)
select r.organisation_id, r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrator'
  and r.is_system_role
  and p.permission_key in ('transport.view', 'transport.manage')
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Transporters
-- -----------------------------------------------------------------------------

create table public.transporters (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  transporter_code varchar(40) not null,
  business_name    varchar(200) not null,
  contact_person   varchar(150),
  phone            varchar(30),
  email            varchar(150),
  address          text,
  payment_terms    varchar(40),
  status           varchar(20) not null default 'active'
                   check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transporters_code_unique unique (organisation_id, transporter_code),
  constraint transporters_tenant_key unique (id, organisation_id)
);

-- -----------------------------------------------------------------------------
-- Trucks and compartments
-- -----------------------------------------------------------------------------

create table public.trucks (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations (id) on delete restrict,
  transporter_id      uuid,
  registration_number varchar(40) not null,
  vin                 varchar(80),
  make                varchar(100),
  model               varchar(100),
  year                integer check (year is null or (year between 1900 and 2100)),
  capacity            numeric(18,3) not null check (capacity > 0),
  ownership_type      varchar(30) not null
                      check (ownership_type in ('company', 'third_party')),
  status              varchar(25) not null default 'active'
                      check (status in ('active', 'inactive', 'maintenance', 'retired')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trucks_registration_unique unique (organisation_id, registration_number),
  constraint trucks_tenant_key unique (id, organisation_id),
  constraint trucks_transporter_fk
    foreign key (transporter_id, organisation_id)
    references public.transporters (id, organisation_id) on delete restrict,
  constraint trucks_third_party_transporter check (
    ownership_type = 'company' or transporter_id is not null
  )
);

create table public.truck_compartments (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete restrict,
  truck_id             uuid not null,
  compartment_number   varchar(30) not null,
  capacity             numeric(18,3) not null check (capacity > 0),
  product_compatibility text,
  status               varchar(20) not null default 'active'
                       check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  constraint truck_compartments_number_unique unique (truck_id, compartment_number),
  constraint truck_compartments_tenant_key unique (id, organisation_id),
  constraint truck_compartments_truck_fk
    foreign key (truck_id, organisation_id)
    references public.trucks (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Drivers
-- -----------------------------------------------------------------------------

create table public.drivers (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  transporter_id  uuid,
  driver_code     varchar(40) not null,
  full_name       varchar(200) not null,
  phone           varchar(30),
  licence_number  varchar(80) not null,
  licence_expiry  date,
  driver_type     varchar(30) not null
                  check (driver_type in ('employee', 'third_party')),
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint drivers_code_unique unique (organisation_id, driver_code),
  constraint drivers_tenant_key unique (id, organisation_id),
  constraint drivers_transporter_fk
    foreign key (transporter_id, organisation_id)
    references public.transporters (id, organisation_id) on delete restrict,
  constraint drivers_third_party_transporter check (
    driver_type = 'employee' or transporter_id is not null
  )
);

-- -----------------------------------------------------------------------------
-- Trips and assignments
-- -----------------------------------------------------------------------------

create table public.trips (
  id                        uuid primary key default gen_random_uuid(),
  organisation_id           uuid not null references public.organisations (id) on delete restrict,
  trip_number               varchar(50) not null,
  origin_supplier_depot_id  uuid,
  origin_location_id        uuid,
  destination_location_id   uuid,
  departure_time            timestamptz,
  expected_arrival          timestamptz,
  actual_arrival            timestamptz,
  status                    varchar(30) not null default 'planned'
                            check (status in (
                              'planned', 'assigned', 'loading', 'in_transit',
                              'delivered', 'closed', 'cancelled'
                            )),
  created_by                uuid references public.profiles (id) on delete restrict,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint trips_number_unique unique (organisation_id, trip_number),
  constraint trips_tenant_key unique (id, organisation_id),
  constraint trips_depot_fk
    foreign key (origin_supplier_depot_id, organisation_id)
    references public.supplier_depots (id, organisation_id) on delete restrict,
  constraint trips_origin_location_fk
    foreign key (origin_location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict,
  constraint trips_destination_location_fk
    foreign key (destination_location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict,
  constraint trips_arrival_after_departure check (
    expected_arrival is null or departure_time is null or expected_arrival >= departure_time
  )
);

create table public.trip_assignments (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  trip_id          uuid not null,
  truck_id         uuid not null,
  driver_id        uuid not null,
  transporter_id   uuid,
  assignment_role  varchar(20) not null
                   check (assignment_role in ('primary', 'additional')),
  assigned_at      timestamptz not null default now(),
  released_at      timestamptz,
  constraint trip_assignments_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict,
  constraint trip_assignments_truck_fk
    foreign key (truck_id, organisation_id)
    references public.trucks (id, organisation_id) on delete restrict,
  constraint trip_assignments_driver_fk
    foreign key (driver_id, organisation_id)
    references public.drivers (id, organisation_id) on delete restrict,
  constraint trip_assignments_transporter_fk
    foreign key (transporter_id, organisation_id)
    references public.transporters (id, organisation_id) on delete restrict,
  constraint trip_assignments_release_after_assignment check (
    released_at is null or released_at >= assigned_at
  )
);

-- One active primary truck/driver per trip.
create unique index trip_assignments_one_primary
  on public.trip_assignments (trip_id)
  where assignment_role = 'primary' and released_at is null;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index transporters_org_idx on public.transporters (organisation_id);
create index trucks_org_idx on public.trucks (organisation_id);
create index trucks_transporter_idx on public.trucks (transporter_id);
create index truck_compartments_truck_idx on public.truck_compartments (truck_id);
create index drivers_org_idx on public.drivers (organisation_id);
create index drivers_transporter_idx on public.drivers (transporter_id);
create index trips_org_idx on public.trips (organisation_id, created_at desc);
create index trip_assignments_org_idx on public.trip_assignments (organisation_id);
create index trip_assignments_trip_idx on public.trip_assignments (trip_id);
create index trip_assignments_truck_idx on public.trip_assignments (truck_id);
create index trip_assignments_driver_idx on public.trip_assignments (driver_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create trigger transporters_set_updated_at
  before update on public.transporters
  for each row execute function app.set_updated_at();

create trigger trucks_set_updated_at
  before update on public.trucks
  for each row execute function app.set_updated_at();

create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute function app.set_updated_at();

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit: trip and assignment creation
-- -----------------------------------------------------------------------------

create or replace function app.audit_dispatch_event()
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
    when 'trips' then 'dispatch.trip_created'
    when 'trip_assignments' then 'dispatch.trip_assigned'
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

revoke all on function app.audit_dispatch_event() from public;

create trigger trips_audit
  after insert on public.trips
  for each row execute function app.audit_dispatch_event();

create trigger trip_assignments_audit
  after insert on public.trip_assignments
  for each row execute function app.audit_dispatch_event();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.transporters enable row level security;
alter table public.trucks enable row level security;
alter table public.truck_compartments enable row level security;
alter table public.drivers enable row level security;
alter table public.trips enable row level security;
alter table public.trip_assignments enable row level security;

create policy transporters_read on public.transporters
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy transporters_manage on public.transporters
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy trucks_read on public.trucks
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trucks_manage on public.trucks
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy truck_compartments_read on public.truck_compartments
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy truck_compartments_manage on public.truck_compartments
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy drivers_read on public.drivers
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy drivers_manage on public.drivers
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy trips_read on public.trips
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trips_insert on public.trips
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and created_by = app.current_profile_id()
  );

create policy trips_update on public.trips
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (organisation_id = app.current_organisation_id());

create policy trip_assignments_read on public.trip_assignments
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_assignments_insert on public.trip_assignments
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  );

create policy trip_assignments_update on public.trip_assignments
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
  )
  with check (organisation_id = app.current_organisation_id());

-- No delete policies: dispatch history is preserved.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.transporters, public.trucks, public.truck_compartments,
  public.drivers, public.trips, public.trip_assignments from anon;

grant select, insert, update, delete on public.transporters, public.trucks,
  public.truck_compartments, public.drivers to authenticated;

grant select, insert, update on public.trips, public.trip_assignments to authenticated;
revoke delete, truncate on public.trips, public.trip_assignments from authenticated, anon;

commit;
