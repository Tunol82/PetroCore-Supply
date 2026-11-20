import { notFound, redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

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
  created_at: string;
};

type CustomerLocation = {
  id: string;
  location_name: string;
  address: string;
  contact_person: string | null;
  phone: string | null;
  status: string;
};

type SalesOrder = {
  id: string;
  order_number: string;
  order_date: string;
  requested_delivery_date: string | null;
  status: string;
  payment_arrangement: string;
  order_source: string;
};

type OrderItem = { sales_order_id: string; line_total: number; quantity: number };

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

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
        <PageHeader eyebrow="Customer" title="Not authorised" description="You cannot view sales customers." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const { data: customerData, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, customer_code, name, customer_category, phone, email, address, credit_limit, payment_terms, credit_status, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Customer" title="Unavailable" description="This customer could not be loaded." />
        <ButtonLink href="/workspace/sales?tab=customers">Back to customers</ButtonLink>
      </div>
    );
  }

  if (!customerData) {
    notFound();
  }

  const customer = customerData as Customer;

  const [locationsResult, ordersResult] = await Promise.all([
    supabase
      .from("customer_locations")
      .select("id, location_name, address, contact_person, phone, status")
      .eq("customer_id", customer.id)
      .order("location_name"),
    supabase
      .from("sales_orders")
      .select("id, order_number, order_date, requested_delivery_date, status, payment_arrangement, order_source")
      .eq("customer_id", customer.id)
      .order("order_date", { ascending: false })
      .limit(50),
  ]);

  if (locationsResult.error || ordersResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Customer" title="Unavailable" description="Customer details could not be loaded." />
        <ButtonLink href="/workspace/sales?tab=customers">Back to customers</ButtonLink>
      </div>
    );
  }

  const locations = (locationsResult.data ?? []) as CustomerLocation[];
  const orders = (ordersResult.data ?? []) as SalesOrder[];
  const orderIds = orders.map((order) => order.id);

  const itemsResult =
    orderIds.length > 0
      ? await supabase
          .from("sales_order_items")
          .select("sales_order_id, line_total, quantity")
          .in("sales_order_id", orderIds)
      : { data: [], error: null };

  if (itemsResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Customer" title="Unavailable" description="Order lines could not be loaded." />
        <ButtonLink href="/workspace/sales?tab=customers">Back to customers</ButtonLink>
      </div>
    );
  }

  const items = (itemsResult.data ?? []) as OrderItem[];
  const itemsByOrder = new Map<string, OrderItem[]>();
  let orderValue = 0;
  let orderedQuantity = 0;

  for (const item of items) {
    const current = itemsByOrder.get(item.sales_order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.sales_order_id, current);
    orderValue += Number(item.line_total);
    orderedQuantity += Number(item.quantity);
  }

  const activeLocations = locations.filter((location) => location.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Customer · ${customer.customer_code}`}
        title={customer.name}
        description={`${customer.customer_category.replaceAll("_", " ")} · ${customer.status} · credit ${customer.credit_status.replaceAll("_", " ")}`}
        actions={
          <>
            <ButtonLink href="/workspace/sales?tab=customers">Back to customers</ButtonLink>
            {canManage ? (
              <ButtonLink href={`/workspace/sales?tab=customers&edit=${customer.id}`}>Edit customer</ButtonLink>
            ) : null}
            {canManage && customer.status === "active" ? (
              <ButtonLink href={`/workspace/sales?tab=orders&customer=${customer.id}`} variant="primary">
                New order
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Delivery locations"
          value={locations.length}
          hint={`${activeLocations} active`}
          tone="brand"
        />
        <StatCard label="Orders" value={orders.length} hint="Latest 50" />
        <StatCard label="Order value" value={formatMoney(orderValue)} hint={`${formatQuantity(orderedQuantity)} units ordered`} />
        <StatCard
          label="Credit limit"
          value={formatMoney(Number(customer.credit_limit))}
          hint={customer.payment_terms ?? "No payment terms"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Contact and credit" description="Recorded on the customer master." />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Phone</dt>
                <dd>{customer.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Email</dt>
                <dd>{customer.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Address</dt>
                <dd>{customer.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Payment terms</dt>
                <dd>{customer.payment_terms ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Customer since</dt>
                <dd>{new Date(customer.created_at).toLocaleDateString("en-GB")}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Delivery locations"
            description="Every station or site this customer receives product at."
            action={
              canManage && customer.status === "active" ? (
                <ButtonLink href={`/workspace/sales?tab=customers&customer=${customer.id}`} size="sm">
                  Add location
                </ButtonLink>
              ) : null
            }
          />
          <CardBody>
            {locations.length === 0 ? (
              <EmptyState
                title="No delivery locations yet"
                description="Add the station or site this customer receives product at."
              />
            ) : (
              <TableScroll>
                <Table minWidth={640}>
                  <THead>
                    <TR>
                      <TH>Location</TH>
                      <TH>Address</TH>
                      <TH>Contact</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {locations.map((location) => (
                      <TR key={location.id}>
                        <TD className="font-medium">{location.location_name}</TD>
                        <TD className="text-xs">{location.address}</TD>
                        <TD className="text-xs text-[var(--muted)]">
                          {location.contact_person ?? "—"}
                          {location.phone ? <span className="block">{location.phone}</span> : null}
                        </TD>
                        <TD>
                          <StatusBadge status={location.status} />
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

      <Card>
        <CardHeader title="Orders" description="Newest first. Select an order on the sales page to add lines." />
        <CardBody>
          {orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description={canManage ? "Create the first order for this customer." : "No orders recorded."}
            />
          ) : (
            <TableScroll>
              <Table minWidth={860}>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Order date</TH>
                    <TH>Requested delivery</TH>
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
                        <TD className="text-xs text-[var(--muted)]">
                          {new Date(order.order_date).toLocaleDateString("en-GB")}
                        </TD>
                        <TD className="text-xs text-[var(--muted)]">{order.requested_delivery_date ?? "—"}</TD>
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
    </div>
  );
}
