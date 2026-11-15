import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import {
  IssueForm,
  IssueLineForm,
  PostIssueForm,
  ReleaseForm,
  ReservationForm,
  ReservationItemForm,
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
  inventory_movement_id: string;
  inventory_batch_id: string;
  sales_order_item_id: string;
  allocated_quantity: number;
  allocated_unit_cost: number;
  total_cost: number;
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

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function FulfilmentPage() {
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
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view stock fulfilment.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

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
      .limit(20),
    supabase
      .from("inventory_reservation_items")
      .select(
        "id, reservation_id, sales_order_item_id, inventory_batch_id, reserved_quantity, released_quantity, fulfilled_quantity",
      )
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("inventory_issues")
      .select("id, issue_number, sales_order_id, location_id, trip_id, status, issue_date, posted_at")
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("inventory_issue_lines")
      .select("id, issue_id, sales_order_item_id, requested_quantity, issued_quantity")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("fifo_allocations")
      .select(
        "id, inventory_movement_id, inventory_batch_id, sales_order_item_id, allocated_quantity, allocated_unit_cost, total_cost, allocation_date",
      )
      .order("allocation_date", { ascending: false })
      .limit(40),
    supabase.from("sales_orders").select("id, order_number, customer_id").order("order_date", { ascending: false }).limit(40),
    supabase.from("sales_order_items").select("id, sales_order_id, product_id, quantity"),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(30),
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
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Fulfilment data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed. Try again.</p>
          </section>
        </div>
      </main>
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

  const orderOptions = orders.map((order) => ({
    id: order.id,
    label: order.order_number,
  }));

  const orderItemOptions = orderItems.map((item) => {
    const order = orderById.get(item.sales_order_id);
    return {
      id: item.id,
      label: `${order?.order_number ?? "order"} · ${
        productById.get(item.product_id)?.product_name ?? "product"
      } · ${formatQuantity(Number(item.quantity))}`,
    };
  });

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
      label: `${reservation.reservation_number} · ${orderById.get(reservation.sales_order_id)?.order_number ?? "order"}`,
    }));

  const draftIssueOptions = issues
    .filter((issue) => issue.status === "draft")
    .map((issue) => ({
      id: issue.id,
      label: `${issue.issue_number} · ${orderById.get(issue.sales_order_id)?.order_number ?? "order"}`,
    }));

  const tripOptions = trips.map((trip) => ({ id: trip.id, label: trip.trip_number }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Stock fulfilment</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Reservations commit stock without moving it. Only a posted issue reduces stock, oldest batches first.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Reservations</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Reservations reduce available-to-promise stock, never physical stock.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Sales order</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-2 pr-3 font-medium">{reservation.reservation_number}</td>
                    <td className="py-2 pr-3">
                      {orderById.get(reservation.sales_order_id)?.order_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {locationById.get(reservation.location_id)?.location_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{reservation.status.replaceAll("_", " ")}</td>
                    <td className="py-2 text-xs">
                      {new Date(reservation.reservation_date).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No reservations yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Create reservation</h3>
              <div className="mt-3">
                <ReservationForm salesOrders={orderOptions} locations={storageLocations} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Reservation lines</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Reservation</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3 text-right">Reserved</th>
                  <th className="py-2 pr-3 text-right">Fulfilled</th>
                  <th className="py-2 pr-3 text-right">Released</th>
                  <th className="py-2">Release</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {reservationItems.map((item) => {
                  const batch = batchById.get(item.inventory_batch_id);
                  const orderItem = orderItemById.get(item.sales_order_item_id);
                  const outstanding =
                    Number(item.reserved_quantity) - Number(item.released_quantity) - Number(item.fulfilled_quantity);
                  const reservation = reservationById.get(item.reservation_id);
                  const releasable =
                    canManage &&
                    outstanding > 0 &&
                    (reservation?.status === "active" || reservation?.status === "partially_fulfilled");

                  return (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 text-xs">
                        {reservation?.reservation_number ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {productById.get(orderItem?.product_id ?? "")?.product_name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {batch
                          ? procurementById.get(batch.procurement_batch_id)?.batch_number ??
                            productById.get(batch.product_id)?.product_name ??
                            "—"
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQuantity(Number(item.reserved_quantity))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQuantity(Number(item.fulfilled_quantity))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQuantity(Number(item.released_quantity))}
                      </td>
                      <td className="py-2 text-xs">
                        {releasable ? (
                          <ReleaseForm reservationItemId={item.id} outstanding={outstanding} />
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {reservationItems.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No reservation lines yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Reserve stock</h3>
              {reservationOptions.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Create an active reservation before reserving stock.
                </p>
              ) : availableBatchOptions.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">No stock is available to reserve.</p>
              ) : (
                <div className="mt-3">
                  <ReservationItemForm
                    reservations={reservationOptions}
                    orderItems={orderItemOptions}
                    batches={availableBatchOptions}
                  />
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Issues</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Only a posted issue reduces physical stock. Posting consumes the oldest received batches first.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Sales order</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td className="py-2 pr-3 font-medium">{issue.issue_number}</td>
                    <td className="py-2 pr-3">{orderById.get(issue.sales_order_id)?.order_number ?? "—"}</td>
                    <td className="py-2 pr-3">{locationById.get(issue.location_id)?.location_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {issue.trip_id ? trips.find((trip) => trip.id === issue.trip_id)?.trip_number ?? "—" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {issue.status}
                      {issue.posted_at ? (
                        <span className="block text-[var(--muted)]">
                          {new Date(issue.posted_at).toLocaleDateString("en-GB")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-xs">
                      {canManage && issue.status === "draft" ? (
                        <PostIssueForm issueId={issue.id} />
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issues.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No issues yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Create draft issue</h3>
              <div className="mt-3">
                <IssueForm salesOrders={orderOptions} locations={storageLocations} trips={tripOptions} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Issue lines</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Issue</th>
                  <th className="py-2 pr-3">Sales order line</th>
                  <th className="py-2 pr-3 text-right">Requested</th>
                  <th className="py-2 pr-3 text-right">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {issueLines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-3 text-xs">{issueById.get(line.issue_id)?.issue_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {orderItemOptions.find((option) => option.id === line.sales_order_item_id)?.label ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatQuantity(Number(line.requested_quantity))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatQuantity(Number(line.issued_quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issueLines.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No issue lines yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Add issue line</h3>
              {draftIssueOptions.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">Create a draft issue before adding lines.</p>
              ) : (
                <div className="mt-3">
                  <IssueLineForm issues={draftIssueOptions} orderItems={orderItemOptions} />
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">FIFO allocations</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Historical cost is preserved per batch at posting. These allocations are not yet posted to accounting.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Sales order line</th>
                  <th className="py-2 pr-3 text-right">Quantity</th>
                  <th className="py-2 pr-3 text-right">Unit cost</th>
                  <th className="py-2 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {allocations.map((allocation) => {
                  const batch = batchById.get(allocation.inventory_batch_id);
                  return (
                    <tr key={allocation.id}>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(allocation.allocation_date).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {batch ? procurementById.get(batch.procurement_batch_id)?.batch_number ?? "—" : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {orderItemOptions.find((option) => option.id === allocation.sales_order_item_id)?.label ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQuantity(Number(allocation.allocated_quantity))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatMoney(Number(allocation.allocated_unit_cost))}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(Number(allocation.total_cost))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allocations.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No allocations yet.</p>
            ) : null}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Reversals, credit notes and cost-of-sales posting are not implemented. A posted issue is immutable; corrections
          will use reversal entries once that rule is approved.
        </p>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
          P
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
          <p className="text-xs text-[var(--muted)]">Stock fulfilment</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/inventory"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Stock
        </Link>
        <Link
          href="/workspace/sales"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Sales
        </Link>
        <Link
          href="/workspace"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Workspace
        </Link>
        <form action={signOut}>
          <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
