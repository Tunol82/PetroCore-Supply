-- -----------------------------------------------------------------------------
-- PetroCore Supply - E2E tenant seed
--
-- Creates an isolated tenant for the authenticated Playwright suite. It never
-- touches the demo tenants (ORG-A / ORG-B). Apply this before running
-- `npm run test:e2e:auth` against the non-production project.
--
-- Fixed ids keep the seed idempotent. Auth users and profiles are created by
-- tests/e2e-auth/global-setup.ts because auth users cannot be seeded safely in
-- plain SQL.
-- -----------------------------------------------------------------------------

begin;

insert into public.organisations (id, organisation_code, legal_name, display_name, status)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'ORG-E2E',
  'PetroCore Supply E2E Ltd',
  'E2E Tenant',
  'active'
)
on conflict (id) do update
set display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    status = 'active';

insert into public.business_locations (
  id, organisation_id, location_code, location_name, location_type,
  address, is_storage_location, status
)
values (
  'e2e10000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-LOC',
  'E2E Depot',
  'depot',
  '1 E2E Road',
  true,
  'active'
)
on conflict (id) do update
set location_name = excluded.location_name,
    is_storage_location = true,
    status = 'active';

insert into public.roles (id, organisation_id, name, description, is_system_role)
values
  ('e2e00000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Administrator', 'Full access for E2E tests', true),
  ('e2e00000-0000-4000-8000-000000000002', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'E2E Viewer', 'View-only access for E2E tests', true)
on conflict (id) do nothing;

insert into public.role_permissions (organisation_id, role_id, permission_id)
select
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e00000-0000-4000-8000-000000000001',
  p.id
from public.permissions p
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = 'e2e00000-0000-4000-8000-000000000001'
    and rp.permission_id = p.id
);

insert into public.role_permissions (organisation_id, role_id, permission_id)
select
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e00000-0000-4000-8000-000000000002',
  p.id
from public.permissions p
where p.permission_key like '%.view'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = 'e2e00000-0000-4000-8000-000000000002'
      and rp.permission_id = p.id
  );

insert into public.suppliers (
  id, organisation_id, supplier_code, name, contact_person, phone, email, address, payment_terms, status
)
values (
  'e2e20000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-SUP',
  'E2E Supplier',
  'E2E Contact',
  '0800 000 0000',
  'supplier@e2e.test',
  '1 E2E Road',
  '30 days',
  'active'
)
on conflict (id) do update
set name = excluded.name,
    status = 'active';

insert into public.supplier_depots (
  id, organisation_id, supplier_id, depot_code, name, location_description, contact_person, phone, status
)
values (
  'e2e20000-0000-4000-8000-000000000002',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e20000-0000-4000-8000-000000000001',
  'E2E-DEP',
  'E2E Supplier Depot',
  'E2E Depot',
  'E2E Contact',
  '0800 000 0000',
  'active'
)
on conflict (id) do update
set name = excluded.name,
    status = 'active';

insert into public.products (
  id, organisation_id, product_code, product_name, product_type, unit_of_measure, status
)
values (
  'e2e30000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-PMS',
  'E2E Petrol',
  'fuel',
  'litres',
  'active'
)
on conflict (id) do update
set product_name = excluded.product_name,
    status = 'active';

insert into public.customers (
  id, organisation_id, customer_code, name, customer_category, phone, email, address,
  credit_limit, payment_terms, credit_status, status
)
values (
  'e2e40000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-CUS',
  'E2E Customer',
  'business',
  '0800 000 0001',
  'customer@e2e.test',
  '2 E2E Road',
  0,
  '30 days',
  'active',
  'active'
)
on conflict (id) do update
set name = excluded.name,
    status = 'active';

insert into public.customer_locations (
  id, organisation_id, customer_id, location_name, address, contact_person, phone, status
)
values (
  'e2e40000-0000-4000-8000-000000000002',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e40000-0000-4000-8000-000000000001',
  'E2E Station',
  '2 E2E Road',
  'E2E Contact',
  '0800 000 0001',
  'active'
)
on conflict (id) do update
set location_name = excluded.location_name,
    status = 'active';

insert into public.transporters (
  id, organisation_id, transporter_code, business_name, contact_person, phone, email, address, payment_terms, status
)
values (
  'e2e50000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-TRP',
  'E2E Transporter',
  'E2E Contact',
  '0800 000 0002',
  'transporter@e2e.test',
  '3 E2E Road',
  '30 days',
  'active'
)
on conflict (id) do update
set business_name = excluded.business_name,
    status = 'active';

insert into public.trucks (
  id, organisation_id, transporter_id, registration_number, make, model, year, ownership_type, status
)
values (
  'e2e50000-0000-4000-8000-000000000002',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  null,
  'E2E-TRK-1',
  'E2E Make',
  'E2E Model',
  2024,
  'company',
  'active'
)
on conflict (id) do update
set registration_number = excluded.registration_number,
    status = 'active';

insert into public.truck_compartments (
  id, organisation_id, truck_id, compartment_number, capacity, product_compatibility, status
)
values (
  'e2e50000-0000-4000-8000-000000000003',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e50000-0000-4000-8000-000000000002',
  '1',
  20000,
  'E2E Petrol',
  'active'
)
on conflict (id) do update
set capacity = excluded.capacity,
    status = 'active';

insert into public.drivers (
  id, organisation_id, transporter_id, driver_code, full_name, phone, licence_number, driver_type, status
)
values (
  'e2e50000-0000-4000-8000-000000000004',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  null,
  'E2E-DRV',
  'E2E Driver',
  '0800 000 0003',
  'E2E-LIC-1',
  'employee',
  'active'
)
on conflict (id) do update
set full_name = excluded.full_name,
    status = 'active';

insert into public.purchase_orders (
  id, organisation_id, po_number, supplier_id, supplier_depot_id, order_date,
  currency, payment_terms, status, created_by
)
values (
  'e2e60000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'E2E-PO-1',
  'e2e20000-0000-4000-8000-000000000001',
  'e2e20000-0000-4000-8000-000000000002',
  current_date,
  'NGN',
  '30 days',
  'approved',
  null
)
on conflict (id) do update
set status = 'approved',
    supplier_id = excluded.supplier_id,
    supplier_depot_id = excluded.supplier_depot_id;

insert into public.purchase_order_items (
  id, organisation_id, purchase_order_id, product_id, ordered_quantity, agreed_unit_price, discount_amount
)
values (
  'e2e60000-0000-4000-8000-000000000002',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e2e60000-0000-4000-8000-000000000001',
  'e2e30000-0000-4000-8000-000000000001',
  1000,
  900,
  0
)
on conflict (id) do update
set ordered_quantity = 1000,
    agreed_unit_price = 900,
    discount_amount = 0;

commit;
