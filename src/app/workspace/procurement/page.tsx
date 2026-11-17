import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import {
  BatchForm,
  DepotForm,
  ProductForm,
  PurchaseOrderForm,
  PurchaseOrderItemForm,
  SupplierForm,
  SupplierProductForm,
} from "./procurement-forms";

export const dynamic = "force-dynamic";

type Supplier = { id: string; supplier_code: string; name: string; status: string };
type Depot = { id: string; supplier_id: string; depot_code: string; name: string };
type Product = { id: string; product_code: string; product_name: string; unit_of_measure: string };
type Location = { id: string; location_name: string; location_code: string; status: string };

type Batch = {
  id: string;
  batch_number: string;
  supplier_id: string;
  supplier_depot_id: string;
  product_id: string;
  purchase_order_item_id: string | null;
  supplier_quantity: number;
  loaded_quantity: number | null;
  received_quantity: number | null;
  total_quantity_variance: number | null;
  fulfilment_type: string;
  variance_status: string;
  created_at: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  status: string;
  currency: string;
};

type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  ordered_quantity: number;
  agreed_unit_price: number;
  discount_amount: number;
  line_total: number;
};

type SupplierProduct = {
  id: string;
  supplier_id: string;
  product_id: string;
  supplier_product_code: string | null;
  status: string;
};

const TABS = ["orders", "batches", "suppliers", "catalogue"] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default async function ProcurementPage({
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
    supabase.rpc("has_permission", { p_permission_key: "procurement.view" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Procurement" title="Not authorised" description="You cannot view procurement." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "orders";

  const [
    suppliersResult,
    depotsResult,
    productsResult,
    locationsResult,
    batchesResult,
    ordersResult,
    orderItemsResult,
    supplierProductsResult,
  ] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_code, name, status").order("name"),
    supabase.from("supplier_depots").select("id, supplier_id, depot_code, name").order("name"),
    supabase.from("products").select("id, product_code, product_name, unit_of_measure").order("product_name"),
    supabase
      .from("business_locations")
      .select("id, location_name, location_code, status")
      .eq("status", "active")
      .order("location_name"),
    supabase
      .from("procurement_batches")
      .select(
        "id, batch_number, supplier_id, supplier_depot_id, product_id, purchase_order_item_id, supplier_quantity, loaded_quantity, received_quantity, total_quantity_variance, fulfilment_type, variance_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("purchase_orders")
      .select("id, po_number, supplier_id, order_date, expected_date, status, currency")
      .order("order_date", { ascending: false })
      .limit(50),
    supabase
      .from("purchase_order_items")
      .select("id, purchase_order_id, product_id, ordered_quantity, agreed_unit_price, discount_amount, line_total")
      .order("created_at", { ascending: true }),
    supabase
      .from("supplier_products")
      .select("id, supplier_id, product_id, supplier_product_code, status")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const queryError =
    suppliersResult.error ??
    depotsResult.error ??
    productsResult.error ??
    locationsResult.error ??
    batchesResult.error ??
    ordersResult.error ??
    orderItemsResult.error ??
    supplierProductsResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Procurement" title="Unavailable" description="Procurement data could not be loaded." />
      </div>
    );
  }

  const suppliers = (suppliersResult.data ?? []) as Supplier[];
  const depots = (depotsResult.data ?? []) as Depot[];
  const products = (productsResult.data ?? []) as Product[];
  const locations = (locationsResult.data ?? []) as Location[];
  const batches = (batchesResult.data ?? []) as Batch[];
  const orders = (ordersResult.data ?? []) as PurchaseOrder[];
  const orderItems = (orderItemsResult.data ?? []) as PurchaseOrderItem[];
  const supplierProducts = (supplierProductsResult.data ?? []) as SupplierProduct[];

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const depotById = new Map(depots.map((depot) => [depot.id, depot]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const orderItemById = new Map(orderItems.map((item) => [item.id, item]));

  const itemsByOrder = new Map<string, PurchaseOrderItem[]>();
  for (const item of orderItems) {
    const current = itemsByOrder.get(item.purchase_order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.purchase_order_id, current);
  }

  const orderOptions = orders.map((order) => ({
    id: order.id,
    label: `${order.po_number} · ${supplierById.get(order.supplier_id)?.name ?? "Unknown supplier"}`,
  }));

  const purchaseOrderLineOptions = orderItems.map((item) => {
    const order = orderById.get(item.purchase_order_id);
    const product = productById.get(item.product_id);
    return {
      id: item.id,
      label: `${order?.po_number ?? "Order"} · ${product?.product_name ?? "Product"}`,
    };
  });

  const supplierOptions = suppliers.map((supplier) => ({
    id: supplier.id,
    label: `${supplier.name} (${supplier.supplier_code})`,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    label: `${product.product_name} (${product.product_code})`,
  }));

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.location_name} (${location.location_code})`,
  }));

  const depotOptions = depots.map((depot) => ({
    id: depot.id,
    supplierId: depot.supplier_id,
    label: `${depot.name} (${depot.depot_code})`,
  }));

  const orderValue = orderItems.reduce((sum, item) => sum + Number(item.line_total), 0);
  const storageBatches = batches.filter((batch) => batch.fulfilment_type === "storage_receipt").length;

  const tabs = [
    { href: "/workspace/procurement?tab=orders", label: "Purchase orders", count: orders.length },
    { href: "/workspace/procurement?tab=batches", label: "Batches", count: batches.length },
    { href: "/workspace/procurement?tab=suppliers", label: "Suppliers", count: suppliers.length },
    { href: "/workspace/procurement?tab=catalogue", label: "Catalogue", count: products.length },
  ];
  const activeHref = `/workspace/procurement?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title={tenant.organisationName}
        description="Suppliers, depots, products, purchase orders and procurement batches. Quantities are recorded as measured."
        actions={
          <>
            <ButtonLink href="/workspace/procurement/costs">Costs</ButtonLink>
            <ButtonLink href="/workspace/inventory">Inventory</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Purchase orders" value={orders.length} hint={`${formatMoney(orderValue)} total`} tone="brand" />
        <StatCard label="Procurement batches" value={batches.length} hint={`${storageBatches} storage receipt${storageBatches === 1 ? "" : "s"}`} />
        <StatCard label="Suppliers" value={suppliers.length} hint={`${depots.length} depots`} />
        <StatCard label="Products" value={products.length} hint={`${supplierProducts.length} supplier link${supplierProducts.length === 1 ? "" : "s"}`} />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "orders" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Purchase orders"
              description="Commitments only. Creating a purchase order does not create inventory."
            />
            <CardBody>
              {orders.length === 0 ? (
                <EmptyState title="No purchase orders yet" description="Create one below." />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>PO</TH>
                        <TH>Supplier</TH>
                        <TH>Order date</TH>
                        <TH>Expected</TH>
                        <TH>Status</TH>
                        <TH align="right">Lines</TH>
                        <TH align="right">Value</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {orders.map((order) => {
                        const lines = itemsByOrder.get(order.id) ?? [];
                        const total = lines.reduce((sum, line) => sum + Number(line.line_total), 0);

                        return (
                          <TR key={order.id}>
                            <TD className="font-medium">{order.po_number}</TD>
                            <TD>{supplierById.get(order.supplier_id)?.name ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">{order.order_date}</TD>
                            <TD className="text-xs text-[var(--muted)]">{order.expected_date ?? "—"}</TD>
                            <TD>
                              <StatusBadge status={order.status} />
                            </TD>
                            <TD align="right">{lines.length}</TD>
                            <TD align="right">{formatMoney(total)}</TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Order lines" description="Ordered quantity, agreed price, discount and line total." />
            <CardBody>
              {orderItems.length === 0 ? (
                <EmptyState title="No order lines" description="Add a line to a purchase order below." />
              ) : (
                <TableScroll>
                  <Table minWidth={920}>
                    <THead>
                      <TR>
                        <TH>PO</TH>
                        <TH>Product</TH>
                        <TH align="right">Ordered</TH>
                        <TH align="right">Unit price</TH>
                        <TH align="right">Discount</TH>
                        <TH align="right">Line total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {orderItems.map((item) => (
                        <TR key={item.id}>
                          <TD className="text-xs">{orderById.get(item.purchase_order_id)?.po_number ?? "—"}</TD>
                          <TD>{productById.get(item.product_id)?.product_name ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(item.ordered_quantity))}</TD>
                          <TD align="right">{formatMoney(Number(item.agreed_unit_price))}</TD>
                          <TD align="right">{formatMoney(Number(item.discount_amount))}</TD>
                          <TD align="right">{formatMoney(Number(item.line_total))}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Create purchase order" description="Depot options follow the chosen supplier." />
                <CardBody>
                  <PurchaseOrderForm suppliers={supplierOptions} depots={depotOptions} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add order line" description="Price and discount are recorded as agreed." />
                <CardBody>
                  {orders.length === 0 ? (
                    <EmptyState title="No purchase order yet" description="Create one before adding lines." />
                  ) : (
                    <PurchaseOrderItemForm orders={orderOptions} products={productOptions} />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "batches" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Procurement batches"
              description="Append-only. Corrections will use a separate adjustment workflow."
            />
            <CardBody>
              {batches.length === 0 ? (
                <EmptyState title="No batches recorded" description="Record one below." />
              ) : (
                <TableScroll>
                  <Table minWidth={1040}>
                    <THead>
                      <TR>
                        <TH>Batch</TH>
                        <TH>Product</TH>
                        <TH>Order</TH>
                        <TH>Supplier / depot</TH>
                        <TH align="right">Supplier</TH>
                        <TH align="right">Loaded</TH>
                        <TH align="right">Received</TH>
                        <TH>Path</TH>
                        <TH>Variance</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {batches.map((batch) => (
                        <TR key={batch.id}>
                          <TD className="font-medium">{batch.batch_number}</TD>
                          <TD>{productById.get(batch.product_id)?.product_name ?? "—"}</TD>
                          <TD className="text-xs">
                            {batch.purchase_order_item_id
                              ? orderById.get(
                                  orderItemById.get(batch.purchase_order_item_id)?.purchase_order_id ?? "",
                                )?.po_number ?? "—"
                              : "—"}
                          </TD>
                          <TD>
                            {supplierById.get(batch.supplier_id)?.name ?? "—"}
                            <span className="block text-xs text-[var(--muted)]">
                              {depotById.get(batch.supplier_depot_id)?.name ?? "—"}
                            </span>
                          </TD>
                          <TD align="right">{formatQuantity(Number(batch.supplier_quantity))}</TD>
                          <TD align="right">
                            {batch.loaded_quantity === null ? "—" : formatQuantity(Number(batch.loaded_quantity))}
                          </TD>
                          <TD align="right">
                            {batch.received_quantity === null ? "—" : formatQuantity(Number(batch.received_quantity))}
                          </TD>
                          <TD className="text-xs">
                            {batch.fulfilment_type === "storage_receipt" ? "Storage" : "Direct"}
                          </TD>
                          <TD className="text-xs">
                            {batch.variance_status.replaceAll("_", " ")}
                            {batch.total_quantity_variance !== null ? (
                              <span className="block text-[var(--muted)]">
                                {formatQuantity(Number(batch.total_quantity_variance))}
                              </span>
                            ) : null}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader title="Record a batch" description="Storage receipts can later be received into inventory." />
              <CardBody>
                <BatchForm
                  suppliers={supplierOptions}
                  depots={depotOptions}
                  products={productOptions}
                  locations={locationOptions}
                  purchaseOrderLines={purchaseOrderLineOptions}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "suppliers" ? (
        <div className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Suppliers" description="Codes and status." />
              <CardBody>
                {suppliers.length === 0 ? (
                  <EmptyState title="No suppliers yet" description="Add one below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={520}>
                      <THead>
                        <TR>
                          <TH>Code</TH>
                          <TH>Name</TH>
                          <TH>Status</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {suppliers.map((supplier) => (
                          <TR key={supplier.id}>
                            <TD className="font-medium">{supplier.supplier_code}</TD>
                            <TD>{supplier.name}</TD>
                            <TD>
                              <StatusBadge status={supplier.status} />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Supplier depots" description="Collection points per supplier." />
              <CardBody>
                {depots.length === 0 ? (
                  <EmptyState title="No depots yet" description="Add one below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={560}>
                      <THead>
                        <TR>
                          <TH>Supplier</TH>
                          <TH>Depot</TH>
                          <TH>Code</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {depots.map((depot) => (
                          <TR key={depot.id}>
                            <TD className="text-xs">{supplierById.get(depot.supplier_id)?.name ?? "—"}</TD>
                            <TD>{depot.name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{depot.depot_code}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardBody>
            </Card>
          </div>

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Add supplier" description="Code must be unique for this company." />
                <CardBody>
                  <SupplierForm />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add supplier depot" description="Linked to an existing supplier." />
                <CardBody>
                  {suppliers.length === 0 ? (
                    <EmptyState title="No supplier yet" description="Add a supplier before a depot." />
                  ) : (
                    <DepotForm suppliers={supplierOptions} />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "catalogue" ? (
        <div className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Products" description="Shared product catalogue for this company." />
              <CardBody>
                {products.length === 0 ? (
                  <EmptyState title="No products yet" description="Add one below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={520}>
                      <THead>
                        <TR>
                          <TH>Code</TH>
                          <TH>Product</TH>
                          <TH>Unit</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {products.map((product) => (
                          <TR key={product.id}>
                            <TD className="font-medium">{product.product_code}</TD>
                            <TD>{product.product_name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{product.unit_of_measure}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Supplier pricing" description="Supplier product codes and link status." />
              <CardBody>
                {supplierProducts.length === 0 ? (
                  <EmptyState title="No supplier links" description="Add one below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={620}>
                      <THead>
                        <TR>
                          <TH>Supplier</TH>
                          <TH>Product</TH>
                          <TH>Supplier code</TH>
                          <TH>Status</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {supplierProducts.map((link) => (
                          <TR key={link.id}>
                            <TD className="text-xs">{supplierById.get(link.supplier_id)?.name ?? "—"}</TD>
                            <TD>{productById.get(link.product_id)?.product_name ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">{link.supplier_product_code ?? "—"}</TD>
                            <TD>
                              <StatusBadge status={link.status} />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardBody>
            </Card>
          </div>

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Add product" description="Unit defaults to litres." />
                <CardBody>
                  <ProductForm />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Link supplier to product" description="Optional supplier product code." />
                <CardBody>
                  {suppliers.length === 0 || products.length === 0 ? (
                    <EmptyState title="Supplier and product required" description="Add both before linking." />
                  ) : (
                    <SupplierProductForm suppliers={supplierOptions} products={productOptions} />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Quantities are recorded as supplied; measurement tolerances and variance classification remain open decisions.
        Procurement never creates inventory until a storage receipt is received in Inventory.
      </p>
    </div>
  );
}
