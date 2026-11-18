import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { ReceiptForm, type BatchCostHint } from "./forms";

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

type Movement = {
  id: string;
  inventory_batch_id: string;
  movement_type: string;
  quantity_in: number;
  quantity_out: number;
  reference_type: string;
  movement_date: string;
};

type ProcurementBatch = {
  id: string;
  batch_number: string;
  product_id: string;
  purchase_order_item_id: string | null;
  supplier_quantity: number;
  loaded_quantity: number | null;
  received_quantity: number | null;
  fulfilment_type: string;
};

type Product = { id: string; product_name: string };
type Location = { id: string; location_name: string; is_storage_location: boolean };

const TABS = ["stock", "receive", "movements"] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 4,
  }).format(value);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "stock";

  const [batchesResult, movementsResult, procurementResult, productsResult, locationsResult] =
    await Promise.all([
      supabase
        .from("inventory_batches")
        .select(
          "id, procurement_batch_id, product_id, location_id, original_quantity, remaining_quantity, landed_cost_per_unit, status, received_at",
        )
        .order("received_at", { ascending: false })
        .limit(100),
      supabase
        .from("inventory_movements")
        .select("id, inventory_batch_id, movement_type, quantity_in, quantity_out, reference_type, movement_date")
        .order("movement_date", { ascending: false })
        .limit(100),
      supabase
        .from("procurement_batches")
        .select(
          "id, batch_number, product_id, purchase_order_item_id, supplier_quantity, loaded_quantity, received_quantity, fulfilment_type",
        )
        .eq("fulfilment_type", "storage_receipt")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("products").select("id, product_name").order("product_name"),
      supabase
        .from("business_locations")
        .select("id, location_name, is_storage_location")
        .eq("status", "active")
        .order("location_name"),
    ]);

  const queryError =
    batchesResult.error ??
    movementsResult.error ??
    procurementResult.error ??
    productsResult.error ??
    locationsResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Inventory" title="Unavailable" description="Inventory data could not be loaded." />
      </div>
    );
  }

  const batches = (batchesResult.data ?? []) as Batch[];
  const movements = (movementsResult.data ?? []) as Movement[];
  const procurementBatches = (procurementResult.data ?? []) as ProcurementBatch[];
  const products = (productsResult.data ?? []) as Product[];
  const locations = (locationsResult.data ?? []) as Location[];

  const purchaseItemIds = Array.from(
    new Set(
      procurementBatches
        .map((batch) => batch.purchase_order_item_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [purchaseItemsResult, componentsResult, costCategoriesResult] = await Promise.all([
    purchaseItemIds.length > 0
      ? supabase
          .from("purchase_order_items")
          .select("id, agreed_unit_price, ordered_quantity, line_total")
          .in("id", purchaseItemIds)
      : Promise.resolve({ data: [], error: null }),
    procurementBatches.length > 0
      ? supabase
          .from("procurement_cost_components")
          .select("id, procurement_batch_id, amount, cost_category_id, approval_status")
          .in(
            "procurement_batch_id",
            procurementBatches.map((batch) => batch.id),
          )
      : Promise.resolve({ data: [], error: null }),
    supabase.from("cost_categories").select("id, landed_cost_inclusion"),
  ]);

  if (purchaseItemsResult.error || componentsResult.error || costCategoriesResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Inventory" title="Unavailable" description="Cost hints could not be loaded." />
      </div>
    );
  }

  const purchaseItems = (purchaseItemsResult.data ?? []) as {
    id: string;
    agreed_unit_price: number;
    ordered_quantity: number;
    line_total: number;
  }[];
  const costComponents = (componentsResult.data ?? []) as {
    id: string;
    procurement_batch_id: string;
    amount: number;
    cost_category_id: string;
    approval_status: string;
  }[];
  const costCategories = (costCategoriesResult.data ?? []) as { id: string; landed_cost_inclusion: boolean }[];

  const purchaseItemById = new Map(purchaseItems.map((item) => [item.id, item]));
  const landedCategoryById = new Map(costCategories.map((category) => [category.id, category.landed_cost_inclusion]));
  const componentsByBatch = new Map<string, typeof costComponents>();
  for (const component of costComponents) {
    const current = componentsByBatch.get(component.procurement_batch_id) ?? [];
    current.push(component);
    componentsByBatch.set(component.procurement_batch_id, current);
  }

  const costHints: Record<string, BatchCostHint> = {};
  for (const batch of procurementBatches) {
    const purchaseItem = batch.purchase_order_item_id
      ? purchaseItemById.get(batch.purchase_order_item_id)
      : undefined;
    const unitPrice = purchaseItem
      ? Number(purchaseItem.ordered_quantity) > 0
        ? Number(purchaseItem.line_total) / Number(purchaseItem.ordered_quantity)
        : Number(purchaseItem.agreed_unit_price)
      : null;
    const quantity =
      Number(batch.loaded_quantity ?? batch.supplier_quantity ?? batch.received_quantity ?? 0) || null;
    const components = componentsByBatch.get(batch.id) ?? [];
    const landedComponents = components
      .filter((component) => landedCategoryById.get(component.cost_category_id))
      .reduce((sum, component) => sum + Number(component.amount), 0);
    const purchaseValue =
      unitPrice !== null && Number.isFinite(unitPrice) && quantity ? unitPrice * quantity : null;
    const indicativeUnitCost =
      purchaseValue !== null && quantity ? (purchaseValue + landedComponents) / quantity : null;

    costHints[batch.id] = {
      purchaseUnitPrice: unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice : null,
      purchaseValue,
      landedComponents,
      componentCount: components.length,
      quantity,
      indicativeUnitCost,
    };
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const procurementById = new Map(procurementBatches.map((batch) => [batch.id, batch]));
  const inventoryById = new Map(batches.map((batch) => [batch.id, batch]));

  const receivedByProcurement = new Map<string, number>();
  for (const batch of batches) {
    receivedByProcurement.set(
      batch.procurement_batch_id,
      (receivedByProcurement.get(batch.procurement_batch_id) ?? 0) + Number(batch.original_quantity),
    );
  }

  const receiptOptions = procurementBatches
    .map((batch) => {
      const verifiedQuantity = Number(batch.received_quantity ?? batch.supplier_quantity);
      const outstanding = verifiedQuantity - (receivedByProcurement.get(batch.id) ?? 0);
      return {
        id: batch.id,
        outstanding,
        label: `${batch.batch_number} · ${productById.get(batch.product_id)?.product_name ?? "product"} · ${formatQuantity(
          outstanding,
        )} outstanding of ${formatQuantity(verifiedQuantity)}`,
      };
    })
    .filter((batch) => batch.outstanding > 0);

  const locationOptions = locations
    .filter((location) => location.is_storage_location)
    .map((location) => ({ id: location.id, label: location.location_name }));

  const availableBatches = batches.filter((batch) => batch.status === "available");
  const remainingTotal = batches.reduce((sum, batch) => sum + Number(batch.remaining_quantity), 0);
  const exhaustedCount = batches.filter((batch) => batch.status === "exhausted").length;

  const tabs = [
    { href: "/workspace/inventory?tab=stock", label: "Stock on hand", count: batches.length },
    { href: "/workspace/inventory?tab=receive", label: "Receive", count: receiptOptions.length },
    { href: "/workspace/inventory?tab=movements", label: "Movements", count: movements.length },
  ];
  const activeHref = `/workspace/inventory?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title={tenant.organisationName}
        description="Storage stock received from verified procurement, with an append-only movement ledger."
        actions={<ButtonLink href="/workspace/inventory/fulfilment">Fulfilment</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Batches in stock" value={availableBatches.length} hint={`${batches.length} received in total`} />
        <StatCard label="Remaining volume" value={formatQuantity(remainingTotal)} hint="Across all storage locations" tone="brand" />
        <StatCard label="Exhausted batches" value={exhaustedCount} hint="Fully consumed by issues" />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "stock" ? (
        <Card>
          <CardHeader
            title="Stock batches"
            description="Oldest received first when issuing."
            action={<ButtonLink href="/workspace/inventory?tab=receive" size="sm">Receive stock</ButtonLink>}
          />
          <CardBody>
            {batches.length === 0 ? (
              <EmptyState
                title="No stock has been received yet"
                description="Receive a storage procurement batch to create the first inventory layer."
                action={<ButtonLink href="/workspace/inventory?tab=receive" size="sm">Go to Receive</ButtonLink>}
              />
            ) : (
              <TableScroll>
                <Table minWidth={860}>
                  <THead>
                    <TR>
                      <TH>Batch</TH>
                      <TH>Product</TH>
                      <TH>Location</TH>
                      <TH align="right">Received</TH>
                      <TH align="right">Remaining</TH>
                      <TH align="right">Cost / unit</TH>
                      <TH>Status</TH>
                      <TH>Received</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {batches.map((batch) => {
                      const procurement = procurementById.get(batch.procurement_batch_id);

                      return (
                        <TR key={batch.id}>
                          <TD>
                            <Link
                              href={`/workspace/inventory/batches/${batch.id}`}
                              className="font-medium text-[var(--brand)] hover:underline"
                            >
                              {procurement?.batch_number ?? "batch"}
                            </Link>
                          </TD>
                          <TD>{productById.get(batch.product_id)?.product_name ?? "—"}</TD>
                          <TD className="text-[var(--muted)]">
                            {locationById.get(batch.location_id)?.location_name ?? "—"}
                          </TD>
                          <TD align="right">{formatQuantity(Number(batch.original_quantity))}</TD>
                          <TD align="right">{formatQuantity(Number(batch.remaining_quantity))}</TD>
                          <TD align="right">{formatMoney(Number(batch.landed_cost_per_unit))}</TD>
                          <TD>
                            <StatusBadge status={batch.status} />
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(batch.received_at).toLocaleDateString("en-GB")}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "receive" ? (
        <Card>
          <CardHeader
            title="Receive storage procurement"
            description="Only storage-receipt procurement can create stock. Receipts are cumulative up to the verified quantity."
          />
          <CardBody>
            {canManage ? (
              <ReceiptForm batches={receiptOptions} locations={locationOptions} costHints={costHints} />
            ) : (
              <EmptyState title="Read-only access" description="You can view stock but not receive it." />
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "movements" ? (
        <Card>
          <CardHeader
            title="Stock movements"
            description="Append-only ledger. Movements are posted by trusted database functions, never edited."
          />
          <CardBody>
            {movements.length === 0 ? (
              <EmptyState title="No movements yet" description="A receipt creates the first movement." />
            ) : (
              <TableScroll>
                <Table minWidth={820}>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Batch</TH>
                      <TH>Product</TH>
                      <TH>Type</TH>
                      <TH align="right">In</TH>
                      <TH align="right">Out</TH>
                      <TH>Reference</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {movements.map((movement) => {
                      const batch = inventoryById.get(movement.inventory_batch_id);
                      const procurement = batch ? procurementById.get(batch.procurement_batch_id) : undefined;

                      return (
                        <TR key={movement.id}>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(movement.movement_date).toLocaleDateString("en-GB")}
                          </TD>
                          <TD>
                            {batch ? (
                              <Link
                                href={`/workspace/inventory/batches/${batch.id}`}
                                className="text-[var(--brand)] hover:underline"
                              >
                                {procurement?.batch_number ?? "batch"}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TD>
                          <TD>{batch ? productById.get(batch.product_id)?.product_name ?? "—" : "—"}</TD>
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
                      );
                    })}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Reservations, issues and FIFO allocations live in Fulfilment. Reversals post compensating movements; nothing is
        edited in place.
      </p>
    </div>
  );
}
