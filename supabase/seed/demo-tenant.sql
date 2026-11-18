-- ---------------------------------------------------------------------------
-- PetroCore Supply — demo tenant seed
--
-- Purpose: recreate the demo operational data used for screenshots and manual
-- review on the non-production Supabase project. Safe to run more than once:
-- every insert is keyed on a stable UUID or a natural key and skipped when the
-- row already exists. Also links BAT-DEMO-1 to PO-DEMO-1 so purchase cost and
-- the landed-cost preview have a real price.
--
-- Prerequisites (created once, not by this script):
--   organisation ORG-A, product PMS-915996, customer "DB Customer" with
--   location "DB Station", supplier "North Depot 915996", transporter
--   "DB Transport", trip TRIP-DEMO-1, sales order SO-DEMO-1 and procurement
--   batch BAT-DEMO-1.
--
-- Not covered here: auth users, storage objects. Evidence metadata is seeded
-- against a path created by the app; run the app upload once if the object is
-- missing and the signed link renders as plain text.
--
-- Run with the Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f supabase/seed/demo-tenant.sql
-- ---------------------------------------------------------------------------

-- Delivery record -----------------------------------------------------------
insert into trip_delivery_records (
  id, organisation_id, trip_id, sales_order_item_id, customer_location_id, product_id,
  delivered_quantity, customer_confirmed_quantity, delivery_status, waybill_reference,
  delivery_time, created_at
)
select
  'd0000000-0000-4000-8000-000000000001',
  trip.organisation_id,
  trip.id,
  item.id,
  location.id,
  item.product_id,
  4800, 4750, 'complete', 'WB-DEMO-1',
  now() - interval '1 day', now() - interval '1 day'
from trips trip
join sales_orders sales_order
  on sales_order.organisation_id = trip.organisation_id
 and sales_order.order_number = 'SO-DEMO-1'
join lateral (
  select id, product_id
  from sales_order_items
  where sales_order_id = sales_order.id
  order by id
  limit 1
) item on true
join customers customer
  on customer.organisation_id = trip.organisation_id
 and customer.name = 'DB Customer'
join lateral (
  select id
  from customer_locations
  where customer_id = customer.id
  order by id
  limit 1
) location on true
where trip.trip_number = 'TRIP-DEMO-1'
  and not exists (
    select 1 from trip_delivery_records existing
    where existing.id = 'd0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

-- Delivery evidence metadata -------------------------------------------------
insert into delivery_evidence (
  id, organisation_id, trip_delivery_record_id, evidence_type, file_path,
  original_filename, file_size, content_type, uploaded_at
)
select
  'e0000000-0000-4000-8000-000000000001',
  delivery.organisation_id,
  delivery.id,
  'waybill',
  delivery.organisation_id::text || '/' || delivery.id::text || '/demo-waybill.png',
  'demo-waybill.png', 70, 'image/png',
  now() - interval '1 day'
from trip_delivery_records delivery
where delivery.id = 'd0000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from delivery_evidence existing
    where existing.id = 'e0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

-- Customer receipt and supplier payment -------------------------------------
insert into payments (
  id, organisation_id, direction, customer_id, sales_order_id,
  amount, method, reference, paid_at, status
)
select
  'f0000000-0000-4000-8000-000000000001',
  customer.organisation_id,
  'receipt',
  customer.id,
  sales_order.id,
  3200000, 'bank_transfer', 'TRF-DEMO-1',
  now() - interval '2 days', 'recorded'
from customers customer
join sales_orders sales_order
  on sales_order.organisation_id = customer.organisation_id
 and sales_order.order_number = 'SO-DEMO-1'
where customer.name = 'DB Customer'
  and not exists (
    select 1 from payments existing
    where existing.id = 'f0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

insert into payments (
  id, organisation_id, direction, supplier_id,
  amount, method, reference, paid_at, status
)
select
  'f0000000-0000-4000-8000-000000000002',
  supplier.organisation_id,
  'payment',
  supplier.id,
  1150000, 'cheque', 'CHQ-DEMO-1',
  now() - interval '1 day', 'recorded'
from suppliers supplier
where supplier.name = 'North Depot 915996'
  and not exists (
    select 1 from payments existing
    where existing.id = 'f0000000-0000-4000-8000-000000000002'
  )
on conflict (id) do nothing;

-- Transporter invoice and charge lines --------------------------------------
insert into transporter_invoices (
  id, organisation_id, transporter_id, trip_id, invoice_number, invoice_date,
  subtotal, tax_amount, notes
)
select
  'a0000000-0000-4000-8000-000000000001',
  transporter.organisation_id,
  transporter.id,
  trip.id,
  'DB-INV-1',
  current_date - 3,
  450000, 33750,
  'Haulage and waiting time, 14 Nov.'
from transporters transporter
join trips trip
  on trip.organisation_id = transporter.organisation_id
 and trip.trip_number = 'TRIP-DEMO-1'
where transporter.business_name = 'DB Transport'
  and not exists (
    select 1 from transporter_invoices existing
    where existing.id = 'a0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

insert into transporter_invoice_lines (
  id, organisation_id, invoice_id, description, quantity, unit_rate, charge_category
)
select line.id, invoice.organisation_id, invoice.id, line.description, line.quantity, line.unit_rate,
       line.charge_category
from transporter_invoices invoice
cross join (
  values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'Haulage Lagos to Ibadan', 1::numeric, 400000::numeric, 'haulage'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'Waiting time at depot', 2::numeric, 25000::numeric, 'waiting')
) as line(id, description, quantity, unit_rate, charge_category)
where invoice.id = 'a0000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from transporter_invoice_lines existing
    where existing.id = line.id
  )
on conflict (id) do nothing;

-- Procurement cost category and batch component ----------------------------
insert into cost_categories (
  id, organisation_id, category_name, category_type,
  landed_cost_inclusion, allocation_method, status
)
select
  'c0000000-0000-4000-8000-000000000001',
  batch.organisation_id,
  'Inbound haulage', 'inbound_transport',
  true, 'per_litre', 'active'
from procurement_batches batch
where batch.batch_number = 'BAT-DEMO-1'
  and not exists (
    select 1 from cost_categories existing
    where existing.id = 'c0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

insert into procurement_cost_components (
  id, organisation_id, procurement_batch_id, cost_category_id,
  amount, supplier_id, reference_number, description, approval_status
)
select
  'c0000000-0000-4000-8000-000000000002',
  batch.organisation_id,
  batch.id,
  category.id,
  180000, supplier.id, 'HAUL-DEMO-1',
  'Depot to Lagos terminal', 'pending'
from procurement_batches batch
join cost_categories category
  on category.organisation_id = batch.organisation_id
 and category.category_name = 'Inbound haulage'
left join suppliers supplier
  on supplier.organisation_id = batch.organisation_id
 and supplier.name = 'North Depot 915996'
where batch.batch_number = 'BAT-DEMO-1'
  and not exists (
    select 1 from procurement_cost_components existing
    where existing.id = 'c0000000-0000-4000-8000-000000000002'
  )
on conflict (id) do nothing;

-- Purchase order and price for the demo batch -------------------------------
-- Gives purchase cost, the landed-cost preview and the trip statement a real
-- unit price (10,000 L at N900). The batch is linked below when it has no link.
insert into purchase_orders (
  id, organisation_id, po_number, supplier_id, supplier_depot_id,
  order_date, currency, status, notes
)
select
  'b0000000-0000-4000-8000-0000000000b1',
  supplier.organisation_id,
  'PO-DEMO-1',
  supplier.id,
  depot.id,
  current_date - 5,
  'NGN',
  'approved',
  'Demo purchase order for cost views'
from suppliers supplier
left join supplier_depots depot
  on depot.supplier_id = supplier.id
 and depot.organisation_id = supplier.organisation_id
where supplier.name = 'North Depot 915996'
  and not exists (
    select 1 from purchase_orders existing
    where existing.id = 'b0000000-0000-4000-8000-0000000000b1'
  )
limit 1
on conflict (id) do nothing;

insert into purchase_order_items (
  id, organisation_id, purchase_order_id, product_id, ordered_quantity, agreed_unit_price
)
select
  'b0000000-0000-4000-8000-0000000000b2',
  orders.organisation_id,
  orders.id,
  product.id,
  10000, 900
from purchase_orders orders
join products product
  on product.organisation_id = orders.organisation_id
 and product.product_code = 'PMS-915996'
where orders.id = 'b0000000-0000-4000-8000-0000000000b1'
  and not exists (
    select 1 from purchase_order_items existing
    where existing.id = 'b0000000-0000-4000-8000-0000000000b2'
  )
on conflict (id) do nothing;

update procurement_batches
   set purchase_order_item_id = 'b0000000-0000-4000-8000-0000000000b2'
 where batch_number = 'BAT-DEMO-1'
   and purchase_order_item_id is null;
