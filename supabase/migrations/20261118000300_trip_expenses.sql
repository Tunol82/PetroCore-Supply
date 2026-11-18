-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: trip expenses
--
-- Records costs incurred on a specific trip: fuel, tolls, loading, driver
-- allowance, maintenance and other. Amounts are recorded as supplied and are
-- append-only. Fuel litres may be captured for later efficiency reporting.
--
-- Purchase cost and transport invoices stay where they are; this table covers
-- the expenses that are neither a supplier invoice nor a transporter invoice.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000300.
-- -----------------------------------------------------------------------------

begin;

create table public.trip_expenses (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  trip_id         uuid not null,
  expense_type    varchar(30) not null
                  check (expense_type in ('fuel', 'toll', 'loading', 'driver_allowance', 'maintenance', 'other')),
  description     varchar(160),
  amount          numeric(18,2) not null check (amount > 0),
  litres          numeric(18,3) check (litres is null or litres > 0),
  reference       varchar(80),
  incurred_on     date not null default current_date,
  recorded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint trip_expenses_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict,
  constraint trip_expenses_tenant_key unique (id, organisation_id)
);

create index trip_expenses_trip_idx on public.trip_expenses (organisation_id, trip_id, incurred_on desc);

create or replace function app.audit_trip_expense()
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
    'transport.trip_expense_recorded',
    'trip_expenses',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_trip_expense() from public;

create trigger trip_expenses_audit
  after insert on public.trip_expenses
  for each row execute function app.audit_trip_expense();

alter table public.trip_expenses enable row level security;

create policy trip_expenses_read on public.trip_expenses
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_expenses_write on public.trip_expenses
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and recorded_by = app.current_profile_id()
  );

revoke all on public.trip_expenses from anon;
grant select, insert on public.trip_expenses to authenticated;
revoke update, delete, truncate on public.trip_expenses from authenticated, anon;

commit;
