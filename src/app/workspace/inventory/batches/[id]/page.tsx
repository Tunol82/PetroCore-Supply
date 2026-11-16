import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Batch = {
  id: string;
  procurement_batch_id: string;
  product_id: string;
  location_id: string;
  original_quantity: number;
  remaining_quantity: number;
  landed_cost_per_unit: number;
  status: string;
  received_at: string;
};

type Procurement = {
  batch_number: string;
  supplier_id: string;
  supplier_depot_id: string | null;
  supplier_quantity: number;
  loaded_quantity: number | null;
  received_quantity: number | null;
  supplier_invoice_number: string | null;
  fulfilment_type: string;
};

type Movement = {
  id: string;
  movement_type: string;
  quantity_in: number;
  quantity_out: number;
  reference_type: string;
  movement_date: string;
};

type Allocation = {
  id: string;
  inventory_movement_id: string;
  sales_order_item_id: string;
  allocated_quantity: number;
  allocated_unit_cost: number;
  total_cost: number;
  allocation_type: string;
  allocation_date: string;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number, digits = 2) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: digits,
  }).format(value);
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { tenant } = await getCurrentTenant(supabase, userData.user.id);

  if (!tenant) {
    redirect("/workspace");
  }

  const [{ data: canView }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_permission", { p_permission_key: "inventory.view" }),
    supabase.rpc("has_permission", { p_permission_key: "inventory.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Inventory" title="Not authorised" description="You cannot view inventory." />
        <ButtonLink href="/workspace/inventory">Back to inventory</ButtonLink>
      </div>
    );
  }

  const { id } = await params;

  const { data: batchData } = await supabase
    .from("inventory_batches")
    .select(
      "id, procurement_batch_id, product_id, location_id, original_quantity, remaining_quantity, landed_cost_per_unit, status, received_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!batchData) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Inventory · Batch" title="Batch not found" />
        <EmptyState
          title="That batch is not available"
          description="It may belong to another company, or the identifier is wrong."
          action={<ButtonLink href="/workspace/inventory">Back to inventory</ButtonLink>}
        />
      </div>
    );
  }

  const batch = batchData as Batch;

  const [procurementResult, productResult, locationResult, movementsResult, allocationsResult] =
    await Promise.all([
      supabase
        .from("procurement_batches")
        .select(
          "batch_number, supplier_id, supplier_depot_id, supplier_quantity, loaded_quantity, received_quantity, supplier_invoice_number, fulfilment_type",
        )
        .eq("id", batch.procurement_batch_id)
        .maybeSingle(),
      supabase.from("products").select("product_name").eq("id", batch.product_id).maybeSingle(),
      supabase.from("business_locations").select("location_name").eq("id", batch.location_id).maybeSingle(),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity_in, quantity_out, reference_type, movement_date")
        .eq("inventory_batch_id", batch.id)
        .order("movement_date", { ascending: true }),
      supabase
        .from("fifo_allocations")
        .select(
          "id, inventory_movement_id, sales_order_item_id, allocated_quantity, allocated_unit_cost, total_cost, allocation_type, allocation_date",
        )
        .eq("inventory_batch_id", batch.id)
        .order("allocation_date", { ascending: true }),
    ]);

  const procurement = (procurementResult.data ?? null) as Procurement | null;
  const productName = productResult.data?.product_name ?? "Product";
  const locationName = locationResult.data?.location_name ?? "Location";
  const movements = (movementsResult.data ?? []) as Movement[];
  const allocations = (allocationsResult.data ?? []) as Allocation[];

  const supplierResult = procurement
    ? await supabase.from("suppliers").select("name").eq("id", procurement.supplier_id).maybeSingle()
    : { data: null };

  const orderItemIds = [...new Set(allocations.map((allocation) => allocation.sales_order_item_id))];
  const orderItemsResult =
    orderItemIds.length > 0
      ? await supabase.from("sales_order_items").select("id, sales_order_id").in("id", orderItemIds)
      : { data: [] as { id: string; sales_order_id: string }[] };

  const orderItems = (orderItemsResult.data ?? []) as { id: string; sales_order_id: string }[];
  const orderIds = [...new Set(orderItems.map((item) => item.sales_order_id))];
  const ordersResult =
    orderIds.length > 0
      ? await supabase.from("sales_orders").select("id, order_number").in("id", orderIds)
      : { data: [] as { id: string; order_number: string }[] };

  const orders = (ordersResult.data ?? []) as { id: string; order_number: string }[];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const orderItemById = new Map(orderItems.map((item) => [item.id, item]));

  const consumed = Number(batch.original_quantity) - Number(batch.remaining_quantity);
  const issuedValue = allocations
    .filter((allocation) => allocation.allocation_type === "issue")
    .reduce((sum, allocation) => sum + Number(allocation.total_cost), 0);
  const reversedValue = allocations
    .filter((allocation) => allocation.allocation_type === "reversal")
    .reduce((sum, allocation) => sum + Number(allocation.total_cost), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory · Batch"
        title={`${procurement?.batch_number ?? "Batch"} · ${productName}`}
        description={`${locationName} · received ${new Date(batch.received_at).toLocaleDateString("en-GB")}`}
        actions={
          <>
            <StatusBadge status={batch.status} />
            <ButtonLink href="/workspace/inventory">Back to inventory</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Received" value={formatQuantity(Number(batch.original_quantity))} hint="Original quantity" />
        <StatCard label="Remaining" value={formatQuantity(Number(batch.remaining_quantity))} hint="Available to issue" tone="brand" />
        <StatCard label="Consumed" value={formatQuantity(consumed)} hint="Issued, net of reversals" />
        <StatCard
          label="Cost / unit"
          value={formatMoney(Number(batch.landed_cost_per_unit), 4)}
          hint="Preserved at receipt"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Source" description="Procurement batch behind this layer." />
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Supplier</span>
              <span className="text-right font-medium">{supplierResult.data?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Supplier quantity</span>
              <span className="tabular">{formatQuantity(Number(procurement?.supplier_quantity ?? 0))}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Loaded</span>
              <span className="tabular">
                {procurement?.loaded_quantity === null || procurement?.loaded_quantity === undefined
                  ? "—"
                  : formatQuantity(Number(procurement.loaded_quantity))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Verified received</span>
              <span className="tabular">
                {procurement?.received_quantity === null || procurement?.received_quantity === undefined
                  ? "—"
                  : formatQuantity(Number(procurement.received_quantity))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Supplier invoice</span>
              <span className="text-right text-xs">{procurement?.supplier_invoice_number ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">Fulfilment</span>
              <span className="text-xs">{procurement?.fulfilment_type.replaceAll("_", " ") ?? "—"}</span>
            </div>
            <div className="border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
              Issued value {formatMoney(issuedValue)} · reversed {formatMoney(reversedValue)}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Movements" description="Every change to this layer, oldest first." />
          <CardBody>
            {movements.length === 0 ? (
              <EmptyState title="No movements" description="This layer has not moved yet." />
            ) : (
              <TableScroll>
                <Table minWidth={560}>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Type</TH>
                      <TH align="right">In</TH>
                      <TH align="right">Out</TH>
                      <TH>Reference</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {movements.map((movement) => (
                      <TR key={movement.id}>
                        <TD className="text-xs text-[var(--muted)]">
                          {new Date(movement.movement_date).toLocaleDateString("en-GB")}
                        </TD>
                        <TD>
                          <StatusBadge status={movement.movement_type} />
                        </TD>
                        <TD align="right">
                          {Number(movement.quantity_in) > 0 ? formatQuantity(Number(movement.quantity_in)) : "—"}
                        </TD>
                        <TD align="right">
                          {Number(movement.quantity_out) > 0 ? formatQuantity(Number(movement.quantity_out)) : "—"}
                        </TD>
                        <TD className="text-xs text-[var(--muted)]">{movement.reference_type.replaceAll("_", " ")}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="FIFO allocations" description="Which sales order line consumed this layer, and at what cost." />
        <CardBody>
          {allocations.length === 0 ? (
            <EmptyState title="No allocations" description="This layer has not been issued to an order line." />
          ) : (
            <TableScroll>
              <Table minWidth={760}>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Type</TH>
                    <TH>Order</TH>
                    <TH align="right">Quantity</TH>
                    <TH align="right">Unit cost</TH>
                    <TH align="right">Total cost</TH>
                  </TR>
                </THead>
                <TBody>
                  {allocations.map((allocation) => {
                    const orderItem = orderItemById.get(allocation.sales_order_item_id);
                    const order = orderItem ? orderById.get(orderItem.sales_order_id) : undefined;

                    return (
                      <TR key={allocation.id}>
                        <TD className="text-xs text-[var(--muted)]">
                          {new Date(allocation.allocation_date).toLocaleDateString("en-GB")}
                        </TD>
                        <TD>
                          <StatusBadge status={allocation.allocation_type} />
                        </TD>
                        <TD>
                          {order ? (
                            <Link href="/workspace/sales" className="text-[var(--brand)] hover:underline">
                              {order.order_number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD align="right">{formatQuantity(Number(allocation.allocated_quantity))}</TD>
                        <TD align="right">{formatMoney(Number(allocation.allocated_unit_cost))}</TD>
                        <TD align="right">{formatMoney(Number(allocation.total_cost))}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
