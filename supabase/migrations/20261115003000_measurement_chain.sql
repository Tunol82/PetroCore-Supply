-- =============================================================================
-- PetroCore Supply — Migration 30: Measurement chain and optional correction
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115003000.
--
-- DR-01 approved subset (owner answer "both"): a variance is measured at both
-- boundaries - supplier to loaded, and loaded to delivered. The view
-- `trip_quantity_chain` presents both, per trip and product, without changing
-- any recorded quantity.
--
-- DR-02 approved subset (owner answer "optional feature"): observed temperature,
-- density at 15 C, a correction method and a correction factor may be recorded
-- on loading and delivery records. When a factor is supplied, a corrected
-- quantity is derived for reference. No method is applied by the system, and no
-- historic quantity is restated.
--
-- The correction fields are optional; leaving them empty changes nothing.
-- =============================================================================

begin;

alter table public.trip_loading_records
  add column if not exists observed_temperature_c numeric(6,2)
    check (observed_temperature_c is null or (observed_temperature_c between -30 and 90)),
  add column if not exists density_15c numeric(8,2)
    check (density_15c is null or density_15c > 0),
  add column if not exists correction_method varchar(40),
  add column if not exists correction_factor numeric(12,6)
    check (correction_factor is null or correction_factor > 0),
  add column if not exists corrected_quantity numeric(18,3)
    generated always as (
      case
        when correction_factor is null then null
        else round(loaded_quantity * correction_factor, 3)
      end
    ) stored;

alter table public.trip_delivery_records
  add column if not exists observed_temperature_c numeric(6,2)
    check (observed_temperature_c is null or (observed_temperature_c between -30 and 90)),
  add column if not exists density_15c numeric(8,2)
    check (density_15c is null or density_15c > 0),
  add column if not exists correction_method varchar(40),
  add column if not exists correction_factor numeric(12,6)
    check (correction_factor is null or correction_factor > 0),
  add column if not exists corrected_quantity numeric(18,3)
    generated always as (
      case
        when correction_factor is null then null
        else round(delivered_quantity * correction_factor, 3)
      end
    ) stored;

create or replace view public.trip_quantity_chain
with (security_invoker = true)
as
with supplier as (
  select
    t.id as trip_id,
    t.organisation_id,
    t.trip_number,
    a.product_id,
    sum(b.supplier_quantity * (a.allocated_quantity / nullif(l.loaded_quantity, 0))) as supplier_quantity
  from public.trip_loading_procurement_allocations a
  join public.procurement_batches b
    on b.id = a.procurement_batch_id
   and b.organisation_id = a.organisation_id
  join public.trip_loading_records l
    on l.id = a.trip_loading_record_id
   and l.organisation_id = a.organisation_id
  join public.trips t
    on t.id = l.trip_id
   and t.organisation_id = l.organisation_id
  group by t.id, t.organisation_id, t.trip_number, a.product_id
),
loaded as (
  select trip_id, organisation_id, product_id, sum(loaded_quantity) as loaded_quantity
  from public.trip_loading_records
  group by trip_id, organisation_id, product_id
),
delivered as (
  select trip_id, organisation_id, product_id, sum(delivered_quantity) as delivered_quantity
  from public.trip_delivery_records
  group by trip_id, organisation_id, product_id
)
select
  coalesce(s.trip_id, l.trip_id, d.trip_id) as trip_id,
  coalesce(s.organisation_id, l.organisation_id, d.organisation_id) as organisation_id,
  s.trip_number as trip_number,
  coalesce(s.product_id, l.product_id, d.product_id) as product_id,
  s.supplier_quantity as supplier_quantity,
  l.loaded_quantity as loaded_quantity,
  d.delivered_quantity as delivered_quantity,
  case
    when s.supplier_quantity is null or l.loaded_quantity is null then null
    else round(s.supplier_quantity - l.loaded_quantity, 3)
  end as supplier_to_loaded_variance,
  case
    when l.loaded_quantity is null or d.delivered_quantity is null then null
    else round(l.loaded_quantity - d.delivered_quantity, 3)
  end as loaded_to_delivered_variance
from supplier s
full join loaded l
  on l.trip_id = s.trip_id
 and l.organisation_id = s.organisation_id
 and l.product_id = s.product_id
full join delivered d
  on d.trip_id = coalesce(s.trip_id, l.trip_id)
 and d.organisation_id = coalesce(s.organisation_id, l.organisation_id)
 and d.product_id = coalesce(s.product_id, l.product_id);

revoke all on public.trip_quantity_chain from anon;
grant select on public.trip_quantity_chain to authenticated;

commit;
