-- =============================================================================
-- PetroCore Supply — Migration 25: Payment records and profitability evidence
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002500.
--
-- Scope: record money actually received from a customer, or paid to a supplier
-- or transporter, and derive an operational profitability view.
--
-- This is a recording layer, not an accounting subsystem:
--   * a payment records an amount, a method, a reference and a date as supplied;
--   * linking to an order or invoice is explicit and optional - there is no
--     automatic matching, allocation policy, ageing bucket or write-off;
--   * `status` only distinguishes a live record from a void one;
--   * the profitability view subtracts FIFO cost of sales (issues minus
--     reversals) from order revenue and adds recorded receipts, and is labelled
--     operational evidence rather than statutory profit.
--
-- Receipts use the approved `sales.manage` permission; payments use
-- `procurement.manage`. No new permission key is introduced.
-- =============================================================================

begin;

create table public.payments (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null references public.organisations (id) on delete restrict,
  direction               varchar(10) not null check (direction in ('receipt', 'payment')),
  customer_id             uuid,
  supplier_id             uuid,
  transporter_id          uuid,
  sales_order_id          uuid,
  purchase_order_id       uuid,
  transporter_invoice_id  uuid,
  amount                  numeric(18,2) not null check (amount > 0),
  currency                char(3) not null default 'NGN',
  method                  varchar(30) not null
                          check (method in ('cash', 'bank_transfer', 'cheque', 'pos', 'other')),
  reference               varchar(120),
  paid_at                 timestamptz not null default now(),
  status                  varchar(20) not null default 'recorded'
                          check (status in ('recorded', 'void')),
  notes                   text,
  recorded_by             uuid references public.profiles (id) on delete restrict,
  recorded_at             timestamptz not null default now(),
  constraint payments_tenant_key unique (id, organisation_id),
  constraint payments_party check (
    (direction = 'receipt' and customer_id is not null and supplier_id is null and transporter_id is null)
    or (direction = 'payment' and customer_id is null
        and ((supplier_id is not null and transporter_id is null)
          or (transporter_id is not null and supplier_id is null)))
  ),
  constraint payments_customer_fk
    foreign key (customer_id, organisation_id)
    references public.customers (id, organisation_id) on delete restrict,
  constraint payments_supplier_fk
    foreign key (supplier_id, organisation_id)
    references public.suppliers (id, organisation_id) on delete restrict,
  constraint payments_transporter_fk
    foreign key (transporter_id, organisation_id)
    references public.transporters (id, organisation_id) on delete restrict,
  constraint payments_sales_order_fk
    foreign key (sales_order_id, organisation_id)
    references public.sales_orders (id, organisation_id) on delete restrict,
  constraint payments_purchase_order_fk
    foreign key (purchase_order_id, organisation_id)
    references public.purchase_orders (id, organisation_id) on delete restrict,
  constraint payments_transporter_invoice_fk
    foreign key (transporter_invoice_id, organisation_id)
    references public.transporter_invoices (id, organisation_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------

create or replace function app.audit_payment()
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
    'finance.payment_recorded',
    'payments',
    new.id,
    null,
    to_jsonb(new),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_payment() from public;

create trigger payments_audit
  after insert on public.payments
  for each row execute function app.audit_payment();

-- -----------------------------------------------------------------------------
-- Operational profitability evidence
-- -----------------------------------------------------------------------------

create view public.sales_order_profitability
with (security_invoker = true)
as
select
  so.id                                                   as sales_order_id,
  so.organisation_id                                      as organisation_id,
  so.order_number                                         as order_number,
  so.status                                               as order_status,
  coalesce(revenue.revenue, 0)                            as revenue,
  coalesce(cost.cost_of_sales, 0)                         as cost_of_sales,
  coalesce(revenue.revenue, 0) - coalesce(cost.cost_of_sales, 0) as gross_margin,
  coalesce(receipts.received, 0)                          as receipts
from public.sales_orders so
left join (
  select sales_order_id, sum(line_total) as revenue
  from public.sales_order_items
  group by sales_order_id
) revenue on revenue.sales_order_id = so.id
left join (
  select soi.sales_order_id,
         sum(case when fa.allocation_type = 'issue' then fa.total_cost else -fa.total_cost end) as cost_of_sales
  from public.fifo_allocations fa
  join public.sales_order_items soi
    on soi.id = fa.sales_order_item_id
   and soi.organisation_id = fa.organisation_id
  group by soi.sales_order_id
) cost on cost.sales_order_id = so.id
left join (
  select sales_order_id, sum(amount) as received
  from public.payments
  where direction = 'receipt'
    and status = 'recorded'
    and sales_order_id is not null
  group by sales_order_id
) receipts on receipts.sales_order_id = so.id;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index payments_org_idx on public.payments (organisation_id, paid_at desc);
create index payments_customer_idx on public.payments (customer_id);
create index payments_supplier_idx on public.payments (supplier_id);
create index payments_sales_order_idx on public.payments (sales_order_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.payments enable row level security;

create policy payments_read on public.payments
  for select to authenticated
  using (
    organisation_id = app.current_organisation_id()
    and (
      app.has_permission('sales.view')
      or app.has_permission('sales.manage')
      or app.has_permission('procurement.view')
      or app.has_permission('procurement.manage')
    )
  );

create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    organisation_id = app.current_organisation_id()
    and recorded_by = app.current_profile_id()
    and (
      (direction = 'receipt' and app.has_permission('sales.manage'))
      or (direction = 'payment' and app.has_permission('procurement.manage'))
    )
  );

-- Payments are append-only records; corrections are recorded as a void plus a
-- replacement once the correction rule is approved.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.payments from anon;
grant select, insert on public.payments to authenticated;
revoke update, delete, truncate on public.payments from authenticated, anon;

revoke all on public.sales_order_profitability from anon;
grant select on public.sales_order_profitability to authenticated;

commit;
