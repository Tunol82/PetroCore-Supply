-- ---------------------------------------------------------------------------
-- PetroCore Supply — demo tenant teardown
--
-- Removes only the rows created by supabase/seed/demo-tenant.sql, by stable id
-- and in dependency order. Master data (suppliers, products, customers, trips,
-- orders, batches) is left untouched.
--
-- Run with the Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f supabase/seed/demo-tenant-teardown.sql
-- ---------------------------------------------------------------------------

delete from delivery_evidence
where id = 'e0000000-0000-4000-8000-000000000001';

delete from trip_delivery_records
where id = 'd0000000-0000-4000-8000-000000000001';

delete from payments
where id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
);

delete from transporter_invoice_lines
where id in (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002'
);

delete from transporter_invoices
where id = 'a0000000-0000-4000-8000-000000000001';

delete from procurement_cost_components
where id = 'c0000000-0000-4000-8000-000000000002';

delete from cost_categories
where id = 'c0000000-0000-4000-8000-000000000001';

update procurement_batches
   set purchase_order_item_id = null
 where batch_number = 'BAT-DEMO-1'
   and purchase_order_item_id = 'b0000000-0000-4000-8000-0000000000b2';

delete from purchase_order_items
where id = 'b0000000-0000-4000-8000-0000000000b2';

delete from purchase_orders
where id = 'b0000000-0000-4000-8000-0000000000b1';
