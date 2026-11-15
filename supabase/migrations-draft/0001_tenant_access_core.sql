-- =============================================================================
-- PetroCore Supply — Migration 1a: Tenant & Access Core
-- =============================================================================
-- STATUS: DRAFT — NOT APPLIED. DR-10, DR-20 and DR-24 were approved on
-- 2026-11-15, so this schema is authorised for review and execution in an empty
-- non-production project. Do not move it to supabase/migrations until:
--   1. A non-production Supabase project exists and is confirmed empty (DR-25).
--   2. This draft has been executed there and the RLS/cross-tenant tests pass.
--   3. The execution results are signed off in the Migration 1 checklist.
--
-- SCOPE:
--   organisations, business_settings, business_locations, profiles,
--   roles, permissions, role_permissions, user_roles, user_location_access,
--   audit_logs.
--
-- NOT IN THIS MIGRATION (later migrations, from v1.1 Part 2):
--   documents, document_links, document_requirements, reporting, imports,
--   notifications, document number sequences, offline sync, idempotency.
--   audit_logs.device_id is created without its FK until offline_devices
--   exists.
--
-- PROVENANCE OF DEFINITIONS:
--   v1.1 Dictionary (Appendix A) for existing fields;
--   D-001 single-tenant membership; D-002 organisations as tenant master;
--   D-003 platform admin separation (not modelled here);
--   D-004 explicit location grants; D-005 platform-global reference data;
--   DR-16 canonical v1.1 names; DR-25 greenfield.
--
-- APPROVED PERMISSION KEYS (2026-11-15):
--   organisation.manage, users.manage, locations.manage, locations.view_all,
--   audit.view.
--
-- Every tenant-owned table carries organisation_id directly (DR-24 option a)
-- and uses composite foreign keys so a cross-tenant parent is impossible.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

create schema if not exists app;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.organisations (
  id                uuid primary key default gen_random_uuid(),
  organisation_code varchar(40) not null unique,
  legal_name        varchar(250) not null,
  display_name      varchar(200) not null,
  status            varchar(20) not null default 'active'
                    check (status in ('active', 'suspended', 'inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.business_settings (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null unique
                         references public.organisations (id) on delete restrict,
  business_name          varchar(200) not null,
  registered_name        varchar(250),
  business_address       text,
  phone                  varchar(30),
  email                  varchar(150),
  default_currency       varchar(3) not null default 'NGN'
                         check (default_currency = 'NGN'),
  timezone               varchar(60) not null,
  financial_year_start   date,
  default_costing_method varchar(20) not null default 'FIFO',
  offline_enabled        boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.business_locations (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null
                      references public.organisations (id) on delete restrict,
  location_code       varchar(40) not null,
  location_name       varchar(150) not null,
  location_type       varchar(40) not null,
  address             text,
  contact_person      varchar(150),
  phone               varchar(30),
  is_storage_location boolean not null default false,
  status              varchar(20) not null default 'active'
                      check (status in ('active', 'inactive')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint business_locations_code_unique unique (organisation_id, location_code),
  constraint business_locations_tenant_key unique (id, organisation_id)
);

create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  auth_user_id    uuid not null unique references auth.users (id) on delete restrict,
  full_name       varchar(200) not null,
  email           varchar(150) not null,
  phone           varchar(30),
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'suspended', 'inactive')),
  last_login_at   timestamptz,
  deactivated_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_tenant_key unique (id, organisation_id)
);

create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  name            varchar(100) not null,
  description     text,
  is_system_role  boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint roles_name_unique unique (organisation_id, name),
  constraint roles_tenant_key unique (id, organisation_id)
);

-- Platform-owned reference data (D-005): readable by tenants, never writable
-- by them. No organisation_id by design.
create table public.permissions (
  id             uuid primary key default gen_random_uuid(),
  permission_key varchar(150) not null unique,
  description    text
);

create table public.role_permissions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  role_id         uuid not null,
  permission_id   uuid not null
                  references public.permissions (id) on delete restrict,
  constraint role_permissions_unique unique (role_id, permission_id),
  constraint role_permissions_role_fk
    foreign key (role_id, organisation_id)
    references public.roles (id, organisation_id) on delete cascade
);

create table public.user_roles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  user_id         uuid not null,
  role_id         uuid not null,
  assigned_by     uuid,
  assigned_at     timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role_id),
  constraint user_roles_profile_fk
    foreign key (user_id, organisation_id)
    references public.profiles (id, organisation_id) on delete cascade,
  constraint user_roles_role_fk
    foreign key (role_id, organisation_id)
    references public.roles (id, organisation_id) on delete restrict
);

create table public.user_location_access (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  user_id         uuid not null,
  location_id     uuid not null,
  access_level    varchar(30) not null
                  check (access_level in ('view', 'operate', 'approve', 'manage')),
  assigned_by     uuid,
  assigned_at     timestamptz not null default now(),
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'inactive')),
  constraint user_location_access_unique unique (user_id, location_id, access_level),
  constraint user_location_access_profile_fk
    foreign key (user_id, organisation_id)
    references public.profiles (id, organisation_id) on delete cascade,
  constraint user_location_access_location_fk
    foreign key (location_id, organisation_id)
    references public.business_locations (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- Resolves the authenticated user's single active profile. D-001 guarantees at
-- most one, enforced later by the unique auth_user_id constraint.
create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

create or replace function app.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organisation_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

-- Permission check. Security definer avoids recursive RLS evaluation on the
-- role tables when used inside their own policies.
create or replace function app.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp
      on rp.role_id = ur.role_id
     and rp.organisation_id = ur.organisation_id
    join public.permissions perm
      on perm.id = rp.permission_id
    where ur.user_id = app.current_profile_id()
      and perm.permission_key = p_permission_key
  )
$$;

create or replace function app.has_location_access(p_location_id uuid, p_access_level text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_location_access ula
    where ula.user_id = app.current_profile_id()
      and ula.location_id = p_location_id
      and ula.access_level = p_access_level
      and ula.status = 'active'
  )
$$;

revoke all on function app.current_profile_id() from public;
revoke all on function app.current_organisation_id() from public;
revoke all on function app.has_permission(text) from public;
revoke all on function app.has_location_access(uuid, text) from public;
grant execute on function app.current_profile_id() to authenticated;
grant execute on function app.current_organisation_id() to authenticated;
grant execute on function app.has_permission(text) to authenticated;
grant execute on function app.has_location_access(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------

-- Append-only audit trail (v1.1 §17.1). organisation_id is required for
-- tenant-owned events and is the policy scope; device_id has no FK until the
-- offline tables are created in a later migration.
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
                  references public.organisations (id) on delete restrict,
  user_id         uuid references public.profiles (id) on delete restrict,
  action          varchar(80) not null,
  entity_type     varchar(80) not null,
  entity_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  reason          text,
  ip_address      inet,
  device_id       uuid,
  correlation_id  uuid,
  created_at      timestamptz not null default now()
);

-- Trusted audit writer. Direct inserts into audit_logs are revoked, so audit
-- events can only be produced by this function, which derives the actor and
-- tenant from the authenticated session rather than from caller-supplied data.
create or replace function app.record_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := app.current_profile_id();
  v_organisation_id uuid := app.current_organisation_id();
  v_audit_id uuid;
begin
  if v_profile_id is null or v_organisation_id is null then
    raise exception 'no active tenant context';
  end if;

  insert into public.audit_logs (
    organisation_id, user_id, action, entity_type, entity_id,
    old_values, new_values, reason, correlation_id
  ) values (
    v_organisation_id, v_profile_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_reason, p_correlation_id
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke all on function app.record_audit(text, text, uuid, jsonb, jsonb, text, uuid) from public;
grant execute on function app.record_audit(text, text, uuid, jsonb, jsonb, text, uuid) to authenticated;

-- Approved permission keys (DR-24 / physical proposal §5). Idempotent seed of
-- platform-global reference data.
insert into public.permissions (permission_key, description) values
  ('organisation.manage', 'Update the tenant profile and business settings'),
  ('users.manage', 'Manage roles, user-role assignments and location grants'),
  ('locations.manage', 'Create and change business locations'),
  ('locations.view_all', 'View all business locations in the tenant'),
  ('audit.view', 'Read the tenant audit trail')
on conflict (permission_key) do nothing;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index business_locations_org_idx on public.business_locations (organisation_id);
create index profiles_org_idx on public.profiles (organisation_id);
create index roles_org_idx on public.roles (organisation_id);
create index role_permissions_org_idx on public.role_permissions (organisation_id);
create index user_roles_org_idx on public.user_roles (organisation_id);
create index user_roles_user_idx on public.user_roles (user_id);
create index user_location_access_org_idx on public.user_location_access (organisation_id);
create index user_location_access_user_idx on public.user_location_access (user_id);
create index user_location_access_location_idx on public.user_location_access (location_id);
create index audit_logs_org_time_idx on public.audit_logs (organisation_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function app.set_updated_at();

create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute function app.set_updated_at();

create trigger business_locations_set_updated_at
  before update on public.business_locations
  for each row execute function app.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security — deny by default
-- -----------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_locations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_location_access enable row level security;
alter table public.audit_logs enable row level security;

-- organisations: a member sees only their tenant. Tenant creation and deletion
-- are platform operations and have no tenant policy (deny by default).
create policy organisations_select_own on public.organisations
  for select to authenticated
  using (id = app.current_organisation_id());

create policy organisations_update_own on public.organisations
  for update to authenticated
  using (id = app.current_organisation_id() and app.has_permission('organisation.manage'))
  with check (id = app.current_organisation_id());

-- business_settings: readable to the tenant, writable only with permission.
create policy business_settings_select_own on public.business_settings
  for select to authenticated
  using (organisation_id = app.current_organisation_id());

create policy business_settings_update_own on public.business_settings
  for update to authenticated
  using (organisation_id = app.current_organisation_id() and app.has_permission('organisation.manage'))
  with check (organisation_id = app.current_organisation_id());

-- business_locations: visible to the whole tenant only with locations.view_all,
-- otherwise only explicitly granted locations (D-004).
create policy business_locations_select_scoped on public.business_locations
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      app.has_permission('locations.manage')
      or (
        status = 'active'
        and (
          app.has_permission('locations.view_all')
          or app.has_location_access(id, 'view')
        )
      )
    )
  );

create policy business_locations_insert_manage on public.business_locations
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('locations.manage')
  );

create policy business_locations_update_manage on public.business_locations
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('locations.manage')
  )
  with check (organisation_id = app.current_organisation_id());

create policy business_locations_delete_manage on public.business_locations
  for delete to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('locations.manage')
  );

-- profiles: a user sees their own profile; administrators see the tenant.
create policy profiles_select_own_or_manage on public.profiles
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      id = app.current_profile_id()
      or app.has_permission('users.manage')
    )
  );

create policy profiles_update_own_or_manage on public.profiles
  for update to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      id = app.current_profile_id()
      or app.has_permission('users.manage')
    )
  )
  with check (organisation_id = app.current_organisation_id());

-- roles and role_permissions: tenant-scoped, managed with users.manage.
create policy roles_select_own on public.roles
  for select to authenticated
  using (organisation_id = app.current_organisation_id());

create policy roles_write_manage on public.roles
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  );

-- permissions: platform-global read-only reference data (D-005).
create policy permissions_select_read on public.permissions
  for select to authenticated
  using (true);

create policy role_permissions_select_own on public.role_permissions
  for select to authenticated
  using (organisation_id = app.current_organisation_id());

create policy role_permissions_write_manage on public.role_permissions
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  );

-- user_roles: a user may see their own assignments; managers see the tenant.
create policy user_roles_select_own_or_manage on public.user_roles
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      user_id = app.current_profile_id()
      or app.has_permission('users.manage')
    )
  );

create policy user_roles_write_manage on public.user_roles
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  );

-- user_location_access: users may see their own grants; managers see all.
create policy user_location_access_select_own_or_manage on public.user_location_access
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      user_id = app.current_profile_id()
      or app.has_permission('users.manage')
    )
  );

create policy user_location_access_write_manage on public.user_location_access
  for all to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  )
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('users.manage')
  );

-- -----------------------------------------------------------------------------
-- Audit append-only protection
-- -----------------------------------------------------------------------------

-- No update or delete policy exists on audit_logs. This trigger additionally
-- blocks modification for roles that bypass RLS, such as service_role, so the
-- trail cannot be rewritten through ordinary application paths.
create or replace function app.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function app.prevent_audit_mutation();

-- audit_logs: readable inside the tenant with audit.view. Writes go only
-- through app.record_audit(); no insert, update or delete policy exists.
create policy audit_logs_select_tenant on public.audit_logs
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and app.has_permission('audit.view')
  );

-- No insert policy: audit rows are written only through app.record_audit().

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.organisations, public.business_settings,
  public.business_locations, public.profiles, public.roles,
  public.permissions, public.role_permissions, public.user_roles,
  public.user_location_access, public.audit_logs from anon;

grant select, insert, update, delete on public.organisations,
  public.business_settings, public.business_locations, public.profiles,
  public.roles, public.role_permissions, public.user_roles,
  public.user_location_access to authenticated;

-- Platform reference data is read-only to tenants (D-005).
grant select on public.permissions to authenticated;

-- audit_logs is read-only to authenticated users; writes go through
-- app.record_audit().
grant select on public.audit_logs to authenticated;

commit;
