import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import {
  IssueForm,
  IssueLineForm,
  PostIssueForm,
  ReleaseForm,
  ReservationForm,
  ReservationItemForm,
  ReverseIssueForm,
} from "./forms";

export const dynamic = "force-dynamic";

type Reservation = {
  id: string;
  reservation_number: string;
  sales_order_id: string;
  location_id: string;
  status: string;
  reservation_date: string;
};

type ReservationItem = {
  id: string;
  reservation_id: string;
  sales_order_item_id: string;
  inventory_batch_id: string;
  reserved_quantity: number;
  released_quantity: number;
  fulfilled_quantity: number;
};

type Issue = {
  id: string;
  issue_number: string;
  sales_order_id: string;
  location_id: string;
  trip_id: string | null;
  status: string;
  issue_date: string;
  posted_at: string | null;
};

type IssueLine = {
  id: string;
  issue_id: string;
  sales_order_item_id: string;
  requested_quantity: number;
  issued_quantity: number;
};

type Allocation = {
  id: string;
  inventory_batch_id: string;
  sales_order_item_id: string;
  allocated_quantity: number;
  allocated_unit_cost: number;
  total_cost: number;
  allocation_type: string;
  allocation_date: string;
};

type SalesOrder = { id: string; order_number: string; customer_id: string };
type SalesOrderItem = { id: string; sales_order_id: string; product_id: string; quantity: number };
type Trip = { id: string; trip_number: string };
type Product = { id: string; product_name: string };
type Location = { id: string; location_name: string; is_storage_location: boolean };
type Batch = {
  id: string;
  procurement_batch_id: string;
  product_id: string;
  location_id: string;
  remaining_quantity: number;
  status: string;
};
type ProcurementBatch = { id: string; batch_number: string };

const TABS = ["reservations", "issues", "allocations"] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function FulfilmentPage({
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
        <PageHeader eyebrow="Stock issues" title="Not authorised" description="You cannot view stock fulfilment." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number])
    ? (params.tab as string)
    : "reservations";

  const [
    reservationsResult,
    reservationItemsResult,
    issuesResult,
    issueLinesResult,
    allocationsResult,
    ordersResult,
    orderItemsResult,
    tripsResult,
    productsResult,
    locationsResult,
    batchesResult,
    procurementResult,
  ] = await Promise.all([
    supabase
      .from("inventory_reservations")
      .select("id, reservation_number, sales_order_id, location_id, status, reservation_date")
      .order("reservation_date", { ascending: false })
      .limit(50),
    supabase
      .from("inventory_reservation_items")
      .select(
        "id, reservation_id, sales_order_item_id, inventory_batch_id, reserved_quantity, released_quantity, fulfilled_quantity",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inventory_issues")
      .select("id, issue_number, sales_order_id, location_id, trip_id, status, issue_date, posted_at")
      .order("issue_date", { ascending: false })
      .limit(50),
    supabase
      .from("inventory_issue_lines")
      .select("id, issue_id, sales_order_item_id, requested_quantity, issued_quantity")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("fifo_allocations")
      .select(
        "id, inventory_batch_id, sales_order_item_id, allocated_quantity, allocated_unit_cost, total_cost, allocation_type, allocation_date",
      )
      .order("allocation_date", { ascending: false })
      .limit(100),
    supabase.from("sales_orders").select("id, order_number, customer_id").order("order_date", { ascending: false }).limit(50),
    supabase.from("sales_order_items").select("id, sales_order_id, product_id, quantity"),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(40),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("business_locations")
      .select("id, location_name, is_storage_location")
      .eq("status", "active")
      .order("location_name"),
    supabase
      .from("inventory_batches")
      .select("id, procurement_batch_id, product_id, location_id, remaining_quantity, status")
      .order("received_at", { ascending: true }),
    supabase.from("procurement_batches").select("id, batch_number"),
  ]);

  const queryError =
    reservationsResult.error ??
    reservationItemsResult.error ??
    issuesResult.error ??
    issueLinesResult.error ??
    allocationsResult.error ??
    ordersResult.error ??
    orderItemsResult.error ??
    tripsResult.error ??
    productsResult.error ??
    locationsResult.error ??
    batchesResult.error ??
    procurementResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Stock issues" title="Unavailable" description="Fulfilment data could not be loaded." />
      </div>
    );
  }

  const reservations = (reservationsResult.data ?? []) as Reservation[];
  const reservationItems = (reservationItemsResult.data ?? []) as ReservationItem[];
  const issues = (issuesResult.data ?? []) as Issue[];
  const issueLines = (issueLinesResult.data ?? []) as IssueLine[];
  const allocations = (allocationsResult.data ?? []) as Allocation[];
  const orders = (ordersResult.data ?? []) as SalesOrder[];
  const orderItems = (orderItemsResult.data ?? []) as SalesOrderItem[];
  const trips = (tripsResult.data ?? []) as Trip[];
  const products = (productsResult.data ?? []) as Product[];
  const locations = (locationsResult.data ?? []) as Location[];
  const batches = (batchesResult.data ?? []) as Batch[];
  const procurementBatches = (procurementResult.data ?? []) as ProcurementBatch[];

  const productById = new Map(products.map((product) => [product.id, product]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const reservationById = new Map(reservations.map((item) => [item.id, item]));
  const issueById = new Map(issues.map((item) => [item.id, item]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const orderItemById = new Map(orderItems.map((item) => [item.id, item]));
  const procurementById = new Map(procurementBatches.map((batch) => [batch.id, batch]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const storageLocations = locations
    .filter((location) => location.is_storage_location)
    .map((location) => ({ id: location.id, label: location.location_name }));

  const orderOptions = orders.map((order) => ({ id: order.id, label: order.order_number }));

  const orderItemOptions = orderItems.map((item) => ({
    id: item.id,
    label: `${orderById.get(item.sales_order_id)?.order_number ?? "order"} · ${
      productById.get(item.product_id)?.product_name ?? "product"
    } · ${formatQuantity(Number(item.quantity))}`,
  }));

  const availableBatchOptions = batches
    .filter((batch) => Number(batch.remaining_quantity) > 0 && batch.status === "available")
    .map((batch) => ({
      id: batch.id,
      label: `${procurementById.get(batch.procurement_batch_id)?.batch_number ?? "batch"} · ${
        productById.get(batch.product_id)?.product_name ?? "product"
      } · ${locationById.get(batch.location_id)?.location_name ?? "location"} · ${formatQuantity(
        Number(batch.remaining_quantity),
      )} left`,
    }));

  const reservationOptions = reservations
    .filter((reservation) => reservation.status === "active" || reservation.status === "partially_fulfilled")
    .map((reservation) => ({
      id: reservation.id,
      label: `${reservation.reservation_number} · ${
        orderById.get(reservation.sales_order_id)?.order_number ?? "order"
      }`,
    }));

  const draftIssueOptions = issues
    .filter((issue) => issue.status === "draft")
    .map((issue) => ({
      id: issue.id,
      label: `${issue.issue_number} · ${orderById.get(issue.sales_order_id)?.order_number ?? "order"}`,
    }));

  const tripOptions = trips.map((trip) => ({ id: trip.id, label: trip.trip_number }));

  const tabs = [
    {
      href: "/workspace/inventory/fulfilment?tab=reservations",
      label: "Reservations",
      count: reservations.length,
    },
    { href: "/workspace/inventory/fulfilment?tab=issues", label: "Issues", count: issues.length },
    {
      href: "/workspace/inventory/fulfilment?tab=allocations",
      label: "FIFO allocations",
      count: allocations.length,
    },
  ];
  const activeHref = `/workspace/inventory/fulfilment?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock issues"
        title={tenant.organisationName}
        description="Reservations commit stock without moving it. Only a posted issue reduces stock, oldest batches first."
        actions={<ButtonLink href="/workspace/inventory">Inventory</ButtonLink>}
      />

      <Tabs items={tabs} active={activeHref} />

      {tab === "reservations" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Reservations"
              description="Reservations reduce available-to-promise stock, never physical stock."
            />
            <CardBody>
              {reservations.length === 0 ? (
                <EmptyState
                  title="No reservations yet"
                  description="Create a reservation to commit stock to a sales order without moving it."
                />
              ) : (
                <TableScroll>
                  <Table minWidth={720}>
                    <THead>
                      <TR>
                        <TH>Number</TH>
                        <TH>Sales order</TH>
                        <TH>Location</TH>
                        <TH>Status</TH>
                        <TH>Created</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {reservations.map((reservation) => (
                        <TR key={reservation.id}>
                          <TD className="font-medium">{reservation.reservation_number}</TD>
                          <TD>{orderById.get(reservation.sales_order_id)?.order_number ?? "—"}</TD>
                          <TD className="text-[var(--muted)]">
                            {locationById.get(reservation.location_id)?.location_name ?? "—"}
                          </TD>
                          <TD>
                            <StatusBadge status={reservation.status} />
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(reservation.reservation_date).toLocaleDateString("en-GB")}
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
            <CardHeader title="Reservation lines" description="Released quantity returns to available-to-promise." />
            <CardBody>
              {reservationItems.length === 0 ? (
                <EmptyState title="No reservation lines" description="Add a line to commit stock to an order line." />
              ) : (
                <TableScroll>
                  <Table minWidth={880}>
                    <THead>
                      <TR>
                        <TH>Reservation</TH>
                        <TH>Product</TH>
                        <TH>Batch</TH>
                        <TH align="right">Reserved</TH>
                        <TH align="right">Fulfilled</TH>
                        <TH align="right">Released</TH>
                        <TH>Release</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {reservationItems.map((item) => {
                        const batch = batchById.get(item.inventory_batch_id);
                        const orderItem = orderItemById.get(item.sales_order_item_id);
                        const outstanding =
                          Number(item.reserved_quantity) -
                          Number(item.released_quantity) -
                          Number(item.fulfilled_quantity);
                        const reservation = reservationById.get(item.reservation_id);
                        const releasable =
                          canManage &&
                          outstanding > 0 &&
                          (reservation?.status === "active" || reservation?.status === "partially_fulfilled");

                        return (
                          <TR key={item.id}>
                            <TD className="text-xs">{reservation?.reservation_number ?? "—"}</TD>
                            <TD>{productById.get(orderItem?.product_id ?? "")?.product_name ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {batch
                                ? procurementById.get(batch.procurement_batch_id)?.batch_number ??
                                  productById.get(batch.product_id)?.product_name ??
                                  "—"
                                : "—"}
                            </TD>
                            <TD align="right">{formatQuantity(Number(item.reserved_quantity))}</TD>
                            <TD align="right">{formatQuantity(Number(item.fulfilled_quantity))}</TD>
                            <TD align="right">{formatQuantity(Number(item.released_quantity))}</TD>
                            <TD>
                              {releasable ? (
                                <ReleaseForm reservationItemId={item.id} outstanding={outstanding} />
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
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

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Create reservation" description="One reservation per sales order and location." />
                <CardBody>
                  <ReservationForm salesOrders={orderOptions} locations={storageLocations} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Reserve stock" description="Batch must sit at the reservation location." />
                <CardBody>
                  {reservationOptions.length === 0 ? (
                    <EmptyState title="No active reservation" description="Create a reservation first." />
                  ) : availableBatchOptions.length === 0 ? (
                    <EmptyState title="No stock available" description="Receive or release stock first." />
                  ) : (
                    <ReservationItemForm
                      reservations={reservationOptions}
                      orderItems={orderItemOptions}
                      batches={availableBatchOptions}
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "issues" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Issues"
              description="Only a posted issue reduces physical stock. Posted issues can be reversed, never edited."
            />
            <CardBody>
              {issues.length === 0 ? (
                <EmptyState
                  title="No issues yet"
                  description="Create a draft issue, add lines, then post it to move stock."
                />
              ) : (
                <TableScroll>
                  <Table minWidth={880}>
                    <THead>
                      <TR>
                        <TH>Number</TH>
                        <TH>Sales order</TH>
                        <TH>Location</TH>
                        <TH>Trip</TH>
                        <TH>Status</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {issues.map((issue) => (
                        <TR key={issue.id}>
                          <TD className="font-medium">{issue.issue_number}</TD>
                          <TD>{orderById.get(issue.sales_order_id)?.order_number ?? "—"}</TD>
                          <TD className="text-[var(--muted)]">
                            {locationById.get(issue.location_id)?.location_name ?? "—"}
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {issue.trip_id ? trips.find((trip) => trip.id === issue.trip_id)?.trip_number ?? "—" : "—"}
                          </TD>
                          <TD>
                            <StatusBadge status={issue.status} />
                            {issue.posted_at ? (
                              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                                {new Date(issue.posted_at).toLocaleDateString("en-GB")}
                              </span>
                            ) : null}
                          </TD>
                          <TD>
                            {canManage && issue.status === "draft" ? (
                              <PostIssueForm issueId={issue.id} />
                            ) : canManage && issue.status === "posted" ? (
                              <ReverseIssueForm issueId={issue.id} />
                            ) : (
                              <span className="text-[var(--muted)]">
                                {issue.status === "reversed" ? "reversed" : "—"}
                              </span>
                            )}
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
            <CardHeader title="Issue lines" description="Requested quantity per sales order line." />
            <CardBody>
              {issueLines.length === 0 ? (
                <EmptyState title="No issue lines" description="Add at least one line before posting." />
              ) : (
                <TableScroll>
                  <Table minWidth={720}>
                    <THead>
                      <TR>
                        <TH>Issue</TH>
                        <TH>Sales order line</TH>
                        <TH align="right">Requested</TH>
                        <TH align="right">Issued</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {issueLines.map((line) => (
                        <TR key={line.id}>
                          <TD className="text-xs">{issueById.get(line.issue_id)?.issue_number ?? "—"}</TD>
                          <TD className="text-xs">
                            {orderItemOptions.find((option) => option.id === line.sales_order_item_id)?.label ?? "—"}
                          </TD>
                          <TD align="right">{formatQuantity(Number(line.requested_quantity))}</TD>
                          <TD align="right">{formatQuantity(Number(line.issued_quantity))}</TD>
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
                <CardHeader title="Create draft issue" description="Posting consumes the oldest batches at the location." />
                <CardBody>
                  <IssueForm salesOrders={orderOptions} locations={storageLocations} trips={tripOptions} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add issue line" description="Draft issues only." />
                <CardBody>
                  {draftIssueOptions.length === 0 ? (
                    <EmptyState title="No draft issue" description="Create a draft issue before adding lines." />
                  ) : (
                    <IssueLineForm issues={draftIssueOptions} orderItems={orderItemOptions} />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "allocations" ? (
        <Card>
          <CardHeader
            title="FIFO allocations"
            description="Historical cost is preserved per batch at posting. Not yet posted to accounting."
          />
          <CardBody>
            {allocations.length === 0 ? (
              <EmptyState title="No allocations" description="Post an issue to create cost allocations." />
            ) : (
              <TableScroll>
                <Table minWidth={860}>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Type</TH>
                      <TH>Batch</TH>
                      <TH>Sales order line</TH>
                      <TH align="right">Quantity</TH>
                      <TH align="right">Unit cost</TH>
                      <TH align="right">Total cost</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {allocations.map((allocation) => {
                      const batch = batchById.get(allocation.inventory_batch_id);

                      return (
                        <TR key={allocation.id}>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(allocation.allocation_date).toLocaleDateString("en-GB")}
                          </TD>
                          <TD>
                            <StatusBadge status={allocation.allocation_type} />
                          </TD>
                          <TD className="text-xs">
                            {batch
                              ? procurementById.get(batch.procurement_batch_id)?.batch_number ?? "—"
                              : "—"}
                          </TD>
                          <TD className="text-xs">
                            {orderItemOptions.find((option) => option.id === allocation.sales_order_item_id)?.label ??
                              "—"}
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
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Reversals post compensating movements and allocations; a reversed issue is never edited. Net cost of sales is
        issue cost minus reversal cost, and no journal entry or credit note is raised.
      </p>
    </div>
  );
}
