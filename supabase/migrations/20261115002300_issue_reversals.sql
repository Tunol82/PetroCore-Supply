-- =============================================================================
-- PetroCore Supply — Migration 23: Issue reversal
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002300.
--
-- The dictionary's FIFO rule states that corrections use reversal or
-- compensating allocations. A posted issue is therefore never edited: it is
-- reversed by posting compensating movements that return the same quantities to
-- the same batches at the same preserved unit cost.
--
-- Guarantees enforced here:
--   * only a posted issue can be reversed, and a reversal needs a reason;
--   * each allocation is mirrored by a reversal movement and a reversal
--     allocation, so net cost of sales is issue cost minus reversal cost;
--   * returned stock goes back to the batch it came from, at its original cost;
--   * reservation fulfilment is undone for the reversed sales order lines, so a
--     released reservation can be fulfilled again;
--   * the whole reversal aborts if any part fails.
--
-- This records stock and cost evidence only. It does not post a journal entry,
-- issue a credit note or decide financial liability.
-- =============================================================================

begin;

alter table public.inventory_issues
  add column if not exists reversed_by uuid references public.profiles (id) on delete restrict,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text;

alter table public.fifo_allocations
  add column if not exists allocation_type varchar(20) not null default 'issue'
    check (allocation_type in ('issue', 'reversal'));

create index if not exists fifo_allocations_type_idx
  on public.fifo_allocations (organisation_id, allocation_type);

create index if not exists inventory_issues_status_idx
  on public.inventory_issues (organisation_id, status);

create or replace function app.reverse_inventory_issue(p_issue_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_issue public.inventory_issues%rowtype;
  v_allocation record;
  v_line record;
  v_reservation_item record;
  v_movement_id uuid;
  v_needed numeric;
  v_take numeric;
  v_reversed integer := 0;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('inventory.manage') then
    raise exception 'permission denied for inventory issues';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a reversal reason is required';
  end if;

  select *
    into v_issue
  from public.inventory_issues
  where id = p_issue_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'issue not found for this organisation';
  end if;

  if v_issue.status = 'reversed' then
    raise exception 'that issue has already been reversed';
  end if;

  if v_issue.status <> 'posted' then
    raise exception 'only a posted issue can be reversed';
  end if;

  for v_allocation in
    select fa.*
    from public.fifo_allocations fa
    join public.inventory_movements m on m.id = fa.inventory_movement_id
    where fa.organisation_id = v_organisation_id
      and fa.allocation_type = 'issue'
      and m.reference_type = 'inventory_issue'
      and m.reference_id = p_issue_id
    order by fa.created_at
  loop
    insert into public.inventory_movements (
      organisation_id, product_id, location_id, inventory_batch_id,
      movement_type, quantity_in, quantity_out,
      reference_type, reference_id, movement_date, created_by
    )
    select
      v_organisation_id, m.product_id, m.location_id, v_allocation.inventory_batch_id,
      'reversal', v_allocation.allocated_quantity, 0,
      'inventory_issue_reversal', p_issue_id, now(), v_profile_id
    from public.inventory_movements m
    where m.id = v_allocation.inventory_movement_id
    returning id into v_movement_id;

    insert into public.fifo_allocations (
      organisation_id, inventory_movement_id, inventory_batch_id,
      sales_order_item_id, allocated_quantity, allocated_unit_cost,
      allocation_type, allocation_date
    ) values (
      v_organisation_id, v_movement_id, v_allocation.inventory_batch_id,
      v_allocation.sales_order_item_id, v_allocation.allocated_quantity,
      v_allocation.allocated_unit_cost, 'reversal', now()
    );

    update public.inventory_batches
       set remaining_quantity = remaining_quantity + v_allocation.allocated_quantity,
           status = case when status = 'exhausted' then 'available' else status end
     where id = v_allocation.inventory_batch_id;

    v_reversed := v_reversed + 1;
  end loop;

  if v_reversed = 0 then
    raise exception 'that issue has no allocations to reverse';
  end if;

  -- Undo reservation fulfilment for the reversed sales order lines.
  for v_line in
    select sales_order_item_id, issued_quantity
    from public.inventory_issue_lines
    where issue_id = p_issue_id
      and organisation_id = v_organisation_id
  loop
    v_needed := v_line.issued_quantity;

    for v_reservation_item in
      select ri.id, ri.reservation_id, ri.fulfilled_quantity
      from public.inventory_reservation_items ri
      join public.inventory_reservations r
        on r.id = ri.reservation_id
       and r.organisation_id = ri.organisation_id
      where ri.organisation_id = v_organisation_id
        and ri.sales_order_item_id = v_line.sales_order_item_id
        and r.location_id = v_issue.location_id
        and r.status in ('fulfilled', 'partially_fulfilled')
        and ri.fulfilled_quantity > 0
      order by r.reservation_date desc, ri.created_at desc
    loop
      exit when v_needed <= 0;

      v_take := least(v_needed, v_reservation_item.fulfilled_quantity);

      update public.inventory_reservation_items
         set fulfilled_quantity = fulfilled_quantity - v_take
       where id = v_reservation_item.id;

      perform app.refresh_reservation_status(v_reservation_item.reservation_id);

      v_needed := v_needed - v_take;
    end loop;
  end loop;

  update public.inventory_issues
     set status = 'reversed',
         reversed_by = v_profile_id,
         reversed_at = now(),
         reversal_reason = btrim(p_reason)
   where id = p_issue_id;

  perform app.record_audit(
    'inventory.issue_reversed',
    'inventory_issues',
    p_issue_id,
    jsonb_build_object('status', v_issue.status),
    jsonb_build_object('status', 'reversed', 'reason', btrim(p_reason), 'allocations', v_reversed),
    btrim(p_reason),
    null
  );

  return p_issue_id;
end;
$$;

revoke all on function app.reverse_inventory_issue(uuid, text) from public;
grant execute on function app.reverse_inventory_issue(uuid, text) to authenticated;

create or replace function public.reverse_inventory_issue(p_issue_id uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.reverse_inventory_issue(p_issue_id, p_reason)
$$;

revoke all on function public.reverse_inventory_issue(uuid, text) from public;
grant execute on function public.reverse_inventory_issue(uuid, text) to authenticated;

commit;
