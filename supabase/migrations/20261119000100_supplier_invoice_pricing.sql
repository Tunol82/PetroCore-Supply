-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: supplier invoice pricing
--
-- Adds optional invoice price and amount to a procurement batch. The batch
-- already records the supplier quantity and invoice reference; the price lets
-- the three-way match compare the invoiced rate with the agreed PO rate.
--
-- Prices are recorded as supplied. No tax, discount or charge allocation is
-- inferred, and no payable is created.
--
-- Applied to the non-production project on 2026-11-19.
-- Migration history version: 20261119000100.
-- -----------------------------------------------------------------------------

begin;

alter table public.procurement_batches
  add column if not exists supplier_invoice_unit_price numeric(18,4),
  add column if not exists supplier_invoice_amount numeric(18,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'procurement_batches_invoice_unit_price_nonnegative'
  ) then
    alter table public.procurement_batches
      add constraint procurement_batches_invoice_unit_price_nonnegative
      check (supplier_invoice_unit_price is null or supplier_invoice_unit_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'procurement_batches_invoice_amount_nonnegative'
  ) then
    alter table public.procurement_batches
      add constraint procurement_batches_invoice_amount_nonnegative
      check (supplier_invoice_amount is null or supplier_invoice_amount >= 0);
  end if;
end $$;

comment on column public.procurement_batches.supplier_invoice_unit_price is
  'Unit price on the supplier invoice, as supplied. Used for the three-way price comparison.';
comment on column public.procurement_batches.supplier_invoice_amount is
  'Supplier invoice line amount, optional. Takes precedence over quantity x unit price when present.';

commit;
