-- =============================================================================
-- PetroCore Supply — Draft 4: Platform Super Admin and tenant switching
-- =============================================================================
-- STATUS: PROPOSED — NOT APPLIED. Requires approval of DR-26 and the
-- acceptance tests in docs/database/platform-admin-proposal.md before this file
-- may move to supabase/migrations/.
--
-- SCOPE: platform identity, switch sessions and platform audit. Existing tenant
-- tables and RLS policies are deliberately untouched.
--
-- ACCESS MODEL: these tables are platform-global. RLS is enabled with NO
-- policies for anon/authenticated, so tenant users cannot read or write them.
-- Only the server-side service role reaches them.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Platform identity
-- -----------------------------------------------------------------------------

create table public.platform_admins (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete restrict,
  status       varchar(20) not null default 'active'
               check (status in ('active', 'revoked')),
  mfa_required boolean not null default true,
  granted_by   uuid references auth.users (id) on delete set null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  notes        text,
  constraint platform_admins_revoked_at check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

create table public.platform_tenant_sessions (
  id                 uuid primary key default gen_random_uuid(),
  platform_admin_id  uuid not null
                     references public.platform_admins (id) on delete restrict,
  organisation_id    uuid not null
                     references public.organisations (id) on delete restrict,
  issued_at          timestamptz not null default now(),
  expires_at         timestamptz not null,
  ended_at           timestamptz,
  ended_reason       varchar(40)
                     check (ended_reason in ('exit', 'expired', 'revoked')),
  reason             text,
  constraint platform_tenant_sessions_expiry check (expires_at > issued_at)
);

create table public.platform_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  platform_admin_id uuid references public.platform_admins (id) on delete restrict,
  organisation_id   uuid references public.organisations (id) on delete restrict,
  action            varchar(80) not null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index platform_admins_status_idx
  on public.platform_admins (status);

create index platform_tenant_sessions_admin_idx
  on public.platform_tenant_sessions (platform_admin_id, ended_at);

create index platform_tenant_sessions_tenant_idx
  on public.platform_tenant_sessions (organisation_id, expires_at);

create index platform_audit_logs_time_idx
  on public.platform_audit_logs (created_at desc);

create index platform_audit_logs_admin_idx
  on public.platform_audit_logs (platform_admin_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Revoking an admin ends their open sessions
-- -----------------------------------------------------------------------------

create or replace function app.end_platform_sessions_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    update public.platform_tenant_sessions
       set ended_at = now(),
           ended_reason = 'revoked'
     where platform_admin_id = new.id
       and ended_at is null;
  end if;

  return new;
end;
$$;

revoke all on function app.end_platform_sessions_on_revoke() from public;

create trigger platform_admins_revoke_sessions
  after update of status on public.platform_admins
  for each row execute function app.end_platform_sessions_on_revoke();

-- -----------------------------------------------------------------------------
-- Platform audit is append-only
-- -----------------------------------------------------------------------------

create or replace function app.prevent_platform_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'platform_audit_logs is append-only';
end;
$$;

revoke all on function app.prevent_platform_audit_mutation() from public;

create trigger platform_audit_logs_append_only
  before update or delete on public.platform_audit_logs
  for each row execute function app.prevent_platform_audit_mutation();

-- -----------------------------------------------------------------------------
-- RLS and privileges — deny everything to tenant roles
-- -----------------------------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.platform_tenant_sessions enable row level security;
alter table public.platform_audit_logs enable row level security;

revoke all on public.platform_admins,
  public.platform_tenant_sessions,
  public.platform_audit_logs from anon, authenticated;

-- No policies are created. The service role bypasses RLS and is used only by
-- the server-side platform module.

commit;
