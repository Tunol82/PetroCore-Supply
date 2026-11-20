import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusToggle } from "@/components/ui/status-toggle";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { CustomerForm, CustomerLocationForm, SalesOrderForm, SalesOrderItemForm } from "./sales-forms";
import { setCustomerStatus } from "./actions";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  customer_code: string;
  name: string;
  customer_category: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  payment_terms: string | null;
  credit_status: string;
  status: string;
};

type CustomerLocation = {
  id: string;
  customer_id: string;
  location_name: string;
  address: string | null;
};

type SalesOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  order_source: string;
  payment_arrangement: string;
  status: string;
  order_date: string;
};

type SalesOrderItem = {
  id: string;
  sales_order_id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  discount_amount: number;
  delivery_fee: number;
  line_total: number;
};

type Product = { id: string; product_code: string; product_name: string; status: string };

const TABS = ["orders", "customers"] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string; customer?: string }>;
}) {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const { supabase, user, tenant, can } = await getWorkspaceContext();

  if (!user) {
    redirect("/login");
  }

  if (!tenant) {
    redirect("/workspace");
  }

  const canView = can("sales.view");
  const canManage = can("sales.manage");

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Sales" title="Not authorised" description="You cannot view sales for this workspace." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "orders";

  const [customersResult, locationsResult, ordersResult, itemsResult, productsResult] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, customer_code, name, customer_category, phone, email, address, credit_limit, payment_terms, credit_status, status",
      )
      .order("name"),
    supabase
      .from("customer_locations")
      .select("id, customer_id, location_name, address")
      .order("location_name"),
    supabase
      .from("sales_orders")
      .select("id, order_number, customer_id, order_source, payment_arrangement, status, order_date")
      .order("order_date", { ascending: false })
      .limit(50),
    supabase
      .from("sales_order_items")
      .select("id, sales_order_id, product_id, quantity, selling_price, discount_amount, delivery_fee, line_total"),
    supabase.from("products").select("id, product_code, product_name, status").order("product_name"),
  ]);

  const queryError =
    customersResult.error ??
    locationsResult.error ??
    ordersResult.error ??
    itemsResult.error ??
    productsResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Sales" title="Unavailable" description="Sales data could not be loaded." />
      </div>
    );
  }

  const customers = (customersResult.data ?? []) as Customer[];
  const locations = (locationsResult.data ?? []) as CustomerLocation[];
  const orders = (ordersResult.data ?? []) as SalesOrder[];
  const items = (itemsResult.data ?? []) as SalesOrderItem[];
  const products = (productsResult.data ?? []) as Product[];

  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const productById = new Map(products.map((product) => [product.id, product]));

  const itemsByOrder = new Map<string, SalesOrderItem[]>();
  for (const item of items) {
    const current = itemsByOrder.get(item.sales_order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.sales_order_id, current);
  }

  const activeCustomers = customers.filter((customer) => customer.status === "active");

  const customerOptions = activeCustomers.map((customer) => ({
    id: customer.id,
    label: `${customer.name} (${customer.customer_code})`,
  }));

  const editId = params.edit;
  const editingCustomer = editId ? customers.find((customer) => customer.id === editId) ?? null : null;
  const editMissing = Boolean(editId) && !editingCustomer;
  const preselectedCustomerId =
    params.customer && customers.some((customer) => customer.id === params.customer) ? params.customer : "";

  const locationOptions = locations.map((location) => ({
    id: location.id,
    customerId: location.customer_id,
    label: `${location.location_name} · ${customerById.get(location.customer_id)?.name ?? "customer"}`,
  }));

  const orderOptions = orders.map((order) => ({
    id: order.id,
    label: `${order.order_number} · ${customerById.get(order.customer_id)?.name ?? "customer"}`,
  }));

  const productOptions = products
    .filter((product) => product.status === "active")
    .map((product) => ({
      id: product.id,
      label: `${product.product_code} · ${product.product_name}`,
    }));

  const orderValue = items.reduce((sum, item) => sum + Number(item.line_total), 0);

  const tabs = [
    { href: "/workspace/sales?tab=orders", label: "Sales orders", count: orders.length },
    { href: "/workspace/sales?tab=customers", label: "Customers", count: customers.length },
  ];
  const activeHref = `/workspace/sales?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title={tenant.organisationName}
        description="Customers, delivery locations, orders and order lines. Orders and lines are append-only."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales orders" value={orders.length} hint="Latest 50" />
        <StatCard label="Order value" value={formatMoney(orderValue)} hint="All listed lines" tone="brand" />
        <StatCard label="Customers" value={customers.length} hint={`${activeCustomers.length} active`} />
        <StatCard label="Delivery locations" value={locations.length} hint="Across all customers" />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "orders" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Sales orders" description="Latest 50, newest first." />
            <CardBody>
              {orders.length === 0 ? (
                <EmptyState title="No sales orders yet" description="Create the first order below." />
              ) : (
                <TableScroll>
                  <Table minWidth={880}>
                    <THead>
                      <TR>
                        <TH>Order</TH>
                        <TH>Customer</TH>
                        <TH>Source</TH>
                        <TH>Payment</TH>
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
                            <TD className="font-medium">{order.order_number}</TD>
                            <TD>{customerById.get(order.customer_id)?.name ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">{order.order_source.replaceAll("_", " ")}</TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {order.payment_arrangement.replaceAll("_", " ")}
                            </TD>
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
            <CardHeader title="Order lines" description="Product, quantity, price and line total." />
            <CardBody>
              {items.length === 0 ? (
                <EmptyState title="No order lines" description="Add a line to an order below." />
              ) : (
                <TableScroll>
                  <Table minWidth={940}>
                    <THead>
                      <TR>
                        <TH>Order</TH>
                        <TH>Product</TH>
                        <TH align="right">Quantity</TH>
                        <TH align="right">Selling price</TH>
                        <TH align="right">Discount</TH>
                        <TH align="right">Delivery fee</TH>
                        <TH align="right">Line total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {items.map((line) => (
                        <TR key={line.id}>
                          <TD className="text-xs">{orderById.get(line.sales_order_id)?.order_number ?? "—"}</TD>
                          <TD>{productById.get(line.product_id)?.product_name ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(line.quantity))}</TD>
                          <TD align="right">{formatMoney(Number(line.selling_price))}</TD>
                          <TD align="right">{formatMoney(Number(line.discount_amount))}</TD>
                          <TD align="right">{formatMoney(Number(line.delivery_fee))}</TD>
                          <TD align="right">{formatMoney(Number(line.line_total))}</TD>
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
                <CardHeader title="Create sales order" description="One customer and optional delivery location." />
                <CardBody>
                  {customerOptions.length === 0 ? (
                    <EmptyState
                      title="No active customer"
                      description="Add or reactivate a customer before creating an order."
                    />
                  ) : (
                    <SalesOrderForm
                      customers={customerOptions}
                      locations={locationOptions}
                      defaultCustomerId={preselectedCustomerId}
                    />
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add order line" description="Price, discount and delivery fee are recorded as supplied." />
                <CardBody>
                  {orders.length === 0 ? (
                    <EmptyState title="No order yet" description="Create a sales order before adding lines." />
                  ) : productOptions.length === 0 ? (
                    <EmptyState
                      title="No active product"
                      description="Add or reactivate a product before adding lines."
                    />
                  ) : (
                    <SalesOrderItemForm orders={orderOptions} products={productOptions} />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "customers" ? (
        <div className="space-y-6">
          {editMissing ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That record could not be found. It may have been removed.
            </p>
          ) : null}

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Customers"
                description="Codes, category, credit status and state. Deactivating keeps history but hides the customer from new orders."
              />
              <CardBody>
                {customers.length === 0 ? (
                  <EmptyState title="No customers yet" description="Add the first customer below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={820}>
                      <THead>
                        <TR>
                          <TH>Code</TH>
                          <TH>Name</TH>
                          <TH>Category</TH>
                          <TH>Credit</TH>
                          <TH>Status</TH>
                          {canManage ? <TH>Actions</TH> : null}
                        </TR>
                      </THead>
                      <TBody>
                        {customers.map((customer) => (
                          <TR
                            key={customer.id}
                            className={editingCustomer?.id === customer.id ? "bg-[var(--brand-soft)]/40" : ""}
                          >
                            <TD className="font-medium">{customer.customer_code}</TD>
                            <TD>{customer.name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{customer.customer_category}</TD>
                            <TD className="text-xs text-[var(--muted)]">{customer.credit_status}</TD>
                            <TD>
                              <StatusBadge status={customer.status} />
                            </TD>
                            {canManage ? (
                              <TD>
                                <div className="flex flex-wrap items-center gap-2">
                                  <ButtonLink
                                    href={`/workspace/sales/customers/${customer.id}`}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    View
                                  </ButtonLink>
                                  <ButtonLink
                                    href={`/workspace/sales?tab=customers&edit=${customer.id}`}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Edit
                                  </ButtonLink>
                                  <StatusToggle
                                    action={setCustomerStatus}
                                    id={customer.id}
                                    name={customer.name}
                                    active={customer.status === "active"}
                                  />
                                </div>
                              </TD>
                            ) : null}
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Delivery locations" description="Where each customer receives product." />
              <CardBody>
                {locations.length === 0 ? (
                  <EmptyState title="No delivery locations" description="Add one below." />
                ) : (
                  <TableScroll>
                    <Table minWidth={560}>
                      <THead>
                        <TR>
                          <TH>Customer</TH>
                          <TH>Location</TH>
                          <TH>Address</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {locations.map((location) => (
                          <TR key={location.id}>
                            <TD className="text-xs">{customerById.get(location.customer_id)?.name ?? "—"}</TD>
                            <TD>{location.location_name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{location.address ?? "—"}</TD>
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
                <CardHeader
                  title={editingCustomer ? "Edit customer" : "Add customer"}
                  description={
                    editingCustomer
                      ? "Changes apply to future documents. Existing orders keep their recorded customer details."
                      : "Code must be unique for this company."
                  }
                />
                <CardBody>
                  <CustomerForm key={editingCustomer?.id ?? "new"} customer={editingCustomer ?? undefined} />
                  {editingCustomer ? (
                    <div className="mt-3">
                      <ButtonLink href="/workspace/sales?tab=customers" size="sm">
                        Cancel edit
                      </ButtonLink>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add delivery location" description="Linked to an active customer." />
                <CardBody>
                  {customerOptions.length === 0 ? (
                    <EmptyState
                      title="No active customer"
                      description="Add or reactivate a customer before a location."
                    />
                  ) : (
                    <CustomerLocationForm
                      customers={customerOptions}
                      defaultCustomerId={preselectedCustomerId}
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Orders and lines are append-only. Pricing and payment terms are recorded as supplied; no invoice or receivable is
        created here.
      </p>
    </div>
  );
}
