-- =============================================================================
-- PetroCore Supply — Migration 16: Cumulative inventory receipts
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001600.
--
-- Migration 15 allowed exactly one inventory batch per procurement batch. A
-- partial receipt would therefore permanently under-record stock, with no way
-- to receive the remainder.
--
-- This migration allows several receipts against one procurement batch as long
-- as their combined quantity does not exceed the verified quantity. Each
-- receipt still creates its own inventory batch and its own receipt movement,
-- which keeps FIFO layers and the ledger intact.
--
-- Receipts against the same procurement batch are serialised with a row lock
-- so two concurrent receipts cannot both pass the remaining-quantity check.
-- =============================================================================

begin;

alter table public.inventory_batches
  drop constraint inventory_batches_receipt_unique;

create index inventory_batches_procurement_idx
  on public.inventory_batches (organisation_id, procurement_batch_id);

create or replace function app.validate_inventory_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_procurement_product uuid;
  v_fulfilment_type varchar(40);
  v_verified numeric;
  v_already_received numeric;
begin
  select product_id, fulfilment_type, coalesce(received_quantity, supplier_quantity)
    into v_procurement_product, v_fulfilment_type, v_verified
  from public.procurement_batches
  where id = new.procurement_batch_id
    and organisation_id = new.organisation_id
  for update;

  if v_procurement_product is null then
    raise exception 'procurement batch not found for this organisation';
  end if;

  if v_fulfilment_type <> 'storage_receipt' then
    raise exception 'only storage-receipt procurement can create inventory';
  end if;

  if v_procurement_product <> new.product_id then
    raise exception 'inventory product does not match the procurement batch';
  end if;

  if not exists (
    select 1
    from public.business_locations
    where id = new.location_id
      and organisation_id = new.organisation_id
      and is_storage_location
  ) then
    raise exception 'inventory must be received into a storage location';
  end if;

  select coalesce(sum(original_quantity), 0)
    into v_already_received
  from public.inventory_batches
  where procurement_batch_id = new.procurement_batch_id
    and organisation_id = new.organisation_id;

  if v_already_received + new.original_quantity > v_verified then
    raise exception 'receipt quantity % exceeds the outstanding verified quantity %',
      new.original_quantity, v_verified - v_already_received;
  end if;

  return new;
end;
$$;

revoke all on function app.validate_inventory_batch() from public;

commit;
