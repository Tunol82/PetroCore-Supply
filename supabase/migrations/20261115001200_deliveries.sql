-- =============================================================================
-- PetroCore Supply — Migration 12: Deliveries and evidence
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001200.
--
-- Scope: trip delivery records and delivery evidence metadata.
--
-- Enforced now:
--   * delivery product matches the sales order line and, when supplied, the
--     loading record;
--   * the customer location belongs to the order's customer;
--   * cumulative delivered quantity cannot exceed the ordered quantity;
--   * customer-confirmed quantity cannot exceed the delivered quantity.
--
-- Delivery confirmation as a separate immutable event and evidence file
-- storage are deferred (DR-18). Evidence rows store a secure storage reference
-- only; file access is not implemented.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Delivery records
-- -----------------------------------------------------------------------------

create table public.trip_delivery_records (
  id                         uuid primary key default gen_random_uuid(),
  organisation_id            uuid not null references public.organisations (id) on delete restrict,
  trip_id                    uuid not null,
  sales_order_item_id        uuid not null,
  trip_loading_record_id     uuid,
  customer_location_id       uuid not null,
  product_id                 uuid not null,
  delivered_quantity         numeric(18,3) not null check (delivered_quantity > 0),
  customer_confirmed_quantity numeric(18,3)
                             check (customer_confirmed_quantity is null or customer_confirmed_quantity >= 0),
  delivery_time              timestamptz not null default now(),
  customer_acknowledgement   varchar(150),
  delivery_status            varchar(25) not null
                             check (delivery_status in (
                               'complete', 'partial', 'rejected', 'disputed', 'failed'
                             )),
  waybill_reference          varchar(100),
  created_by                 uuid references public.profiles (id) on delete restrict,
  created_at                 timestamptz not null default now(),
  constraint trip_delivery_records_tenant_key unique (id, organisation_id),
  constraint trip_delivery_records_trip_fk
    foreign key (trip_id, organisation_id)
    references public.trips (id, organisation_id) on delete restrict,
  constraint trip_delivery_records_sales_item_fk
    foreign key (sales_order_item_id, organisation_id)
    references public.sales_order_items (id, organisation_id) on delete restrict,
  constraint trip_delivery_records_loading_fk
    foreign key (trip_loading_record_id, organisation_id)
    references public.trip_loading_records (id, organisation_id) on delete restrict,
  constraint trip_delivery_records_location_fk
    foreign key (customer_location_id, organisation_id)
    references public.customer_locations (id, organisation_id) on delete restrict,
  constraint trip_delivery_records_product_fk
    foreign key (product_id, organisation_id)
    references public.products (id, organisation_id) on delete restrict
);

create table public.delivery_evidence (
  id                        uuid primary key default gen_random_uuid(),
  organisation_id           uuid not null references public.organisations (id) on delete restrict,
  trip_delivery_record_id   uuid not null,
  evidence_type             varchar(40) not null
                            check (evidence_type in ('signature', 'photo', 'waybill', 'other')),
  file_path                 text not null,
  uploaded_by               uuid references public.profiles (id) on delete restrict,
  uploaded_at               timestamptz not null default now(),
  notes                     text,
  constraint delivery_evidence_tenant_key unique (id, organisation_id),
  constraint delivery_evidence_delivery_fk
    foreign key (trip_delivery_record_id, organisation_id)
    references public.trip_delivery_records (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Validation trigger
-- -----------------------------------------------------------------------------

create or replace function app.validate_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_product uuid;
  v_ordered_quantity numeric;
  v_order_id uuid;
  v_order_customer uuid;
  v_location_customer uuid;
  v_loading_product uuid;
  v_delivered_total numeric;
begin
  select soi.product_id, soi.quantity, so.customer_id
    into v_order_product, v_ordered_quantity, v_order_customer
  from public.sales_order_items soi
  join public.sales_orders so
    on so.id = soi.sales_order_id
   and so.organisation_id = soi.organisation_id
  where soi.id = new.sales_order_item_id
    and soi.organisation_id = new.organisation_id;

  if v_order_product is null then
    raise exception 'sales order line not found for this organisation';
  end if;

  if v_order_product <> new.product_id then
    raise exception 'delivery product does not match the sales order line';
  end if;

  select customer_id into v_location_customer
  from public.customer_locations
  where id = new.customer_location_id
    and organisation_id = new.organisation_id;

  if v_location_customer is null or v_location_customer <> v_order_customer then
    raise exception 'delivery location does not belong to the customer on this order';
  end if;

  if new.trip_loading_record_id is not null then
    select product_id into v_loading_product
    from public.trip_loading_records
    where id = new.trip_loading_record_id
      and organisation_id = new.organisation_id;

    if v_loading_product is null or v_loading_product <> new.product_id then
      raise exception 'delivery product does not match the loading record';
    end if;
  end if;

  if new.customer_confirmed_quantity is not null
     and new.customer_confirmed_quantity > new.delivered_quantity then
    raise exception 'customer-confirmed quantity cannot exceed the delivered quantity';
  end if;

  select coalesce(sum(delivered_quantity), 0)
    into v_delivered_total
  from public.trip_delivery_records
  where sales_order_item_id = new.sales_order_item_id;

  if v_delivered_total + new.delivered_quantity > v_ordered_quantity then
    raise exception 'cumulative deliveries exceed the ordered quantity for this line';
  end if;

  return new;
end;
$$;

revoke all on function app.validate_delivery() from public;

create trigger trip_delivery_records_validate
  before insert on public.trip_delivery_records
  for each row execute function app.validate_delivery();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index trip_delivery_records_org_idx
  on public.trip_delivery_records (organisation_id, delivery_time desc);
create index trip_delivery_records_trip_idx on public.trip_delivery_records (trip_id);
create index trip_delivery_records_order_item_idx
  on public.trip_delivery_records (sales_order_item_id);
create index delivery_evidence_delivery_idx
  on public.delivery_evidence (trip_delivery_record_id);

-- -----------------------------------------------------------------------------
-- Audit: delivery recorded
-- -----------------------------------------------------------------------------

create or replace function app.audit_delivery_record()
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
    'dispatch.delivery_recorded',
    'trip_delivery_records',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_delivery_record() from public;

create trigger trip_delivery_records_audit
  after insert on public.trip_delivery_records
  for each row execute function app.audit_delivery_record();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.trip_delivery_records enable row level security;
alter table public.delivery_evidence enable row level security;

create policy trip_delivery_records_read on public.trip_delivery_records
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy trip_delivery_records_insert on public.trip_delivery_records
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and created_by = app.current_profile_id()
  );

create policy delivery_evidence_read on public.delivery_evidence
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (app.has_permission('transport.view') or app.has_permission('transport.manage'))
  );

create policy delivery_evidence_insert on public.delivery_evidence
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and app.has_permission('transport.manage')
    and uploaded_by = app.current_profile_id()
  );

-- No update or delete policies: delivery evidence is append-only.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.trip_delivery_records, public.delivery_evidence from anon;

grant select, insert on public.trip_delivery_records, public.delivery_evidence
  to authenticated;
revoke update, delete, truncate on public.trip_delivery_records,
  public.delivery_evidence from authenticated, anon;

commit;
