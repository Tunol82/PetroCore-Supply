-- =============================================================================
-- PetroCore Supply — Migration 24: Transporter invoices
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002400.
--
-- Records the invoice a transporter presents for a trip, exactly as supplied.
--
-- DR-13 (liability and charge rules for shortages and transporter charges) is
-- still open, so nothing here decides who bears a loss or what may be deducted.
-- Every invoice is therefore recorded with `liability_status = not_assessed`,
-- and no payment, payable or deduction is created.
--
-- Records are append-only: an invoice is never edited or deleted. A disputed
-- invoice is recorded as a new record with the corrected figures.
-- =============================================================================

begin;

create table public.transporter_invoices (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  transporter_id   uuid not null,
  trip_id          uuid,
  invoice_number   varchar(80) not null,
  invoice_date     date not null,
  currency         char(3) not null default 'NGN',
  subtotal         numeric(18,2) not null check (subtotal >= 0),
  tax_amount       numeric(18,2) not null default 0 check (tax_amount >= 0),
  total_amount     numeric(18,2) generated always as (subtotal + tax_amount) stored,
  liability_status varchar(20) not null default 'not_assessed'
                   check (liability_status in ('not_assessed', 'confirmed', 'rejected')),
  notes            text,
  recorded_by      uuid references public.profiles (id) on delete restrict,
  recorded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint transporter_invoices_number_unique unique (organisation_id, transporter_id, invoice_number),
  constraint transporter_invoices_tenant_key unique (id, organisation_id),
  constraint transporter_invoices_total check (total_amount >= 0),
  constraint transporter_invoices_transporter_fk
    foreign key (transporter_id, organisation_id)
    references public.transporters (id, organisation_id) on delete restrict,
  constraint transporter_invoices_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict
);

create table public.transporter_invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  invoice_id       uuid not null,
  description      varchar(200) not null,
  quantity         numeric(18,3) not null default 1 check (quantity > 0),
  unit_rate        numeric(18,2) not null check (unit_rate >= 0),
  line_total       numeric(18,2) generated always as (round(quantity * unit_rate, 2)) stored,
  created_at       timestamptz not null default now(),
  constraint transporter_invoice_lines_tenant_key unique (id, organisation_id),
  constraint transporter_invoice_lines_invoice_fk
    foreign key (invoice_id, organisation_id)
    references public.transporter_invoices (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------

create or replace function app.audit_transporter_invoice()
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
    case tg_table_name
      when 'transporter_invoices' then 'transport.transporter_invoice_recorded'
      else 'transport.transporter_invoice_line_recorded'
    end,
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

revoke all on function app.audit_transporter_invoice() from public;

create trigger transporter_invoices_audit
  after insert on public.transporter_invoices
  for each row execute function app.audit_transporter_invoice();

create trigger transporter_invoice_lines_audit
  after insert on public.transporter_invoice_lines
  for each row execute function app.audit_transporter_invoice();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index transporter_invoices_org_idx
  on public.transporter_invoices (organisation_id, invoice_date desc);
create index transporter_invoices_trip_idx
  on public.transporter_invoices (trip_id);
create index transporter_invoice_lines_invoice_idx
  on public.transporter_invoice_lines (invoice_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.transporter_invoices enable row level security;
alter table public.transporter_invoice_lines enable row level security;

create policy transporter_invoices_read on public.transporter_invoices
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy transporter_invoices_insert on public.transporter_invoices
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and recorded_by = app.current_profile_id()
  );

create policy transporter_invoice_lines_read on public.transporter_invoice_lines
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy transporter_invoice_lines_insert on public.transporter_invoice_lines
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and exists (
      select 1
      from public.transporter_invoices ti
      where ti.id = invoice_id
        and ti.organisation_id = app.current_organisation_id()
    )
  );

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.transporter_invoices, public.transporter_invoice_lines from anon;

grant select, insert on public.transporter_invoices,
  public.transporter_invoice_lines to authenticated;

revoke update, delete, truncate on public.transporter_invoices,
  public.transporter_invoice_lines from authenticated, anon;

commit;
