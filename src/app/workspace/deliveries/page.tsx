import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { DeliveryForm, EvidenceForm } from "./forms";

export const dynamic = "force-dynamic";

type Delivery = {
  id: string;
  trip_id: string;
  sales_order_item_id: string;
  customer_location_id: string;
  product_id: string;
  delivered_quantity: number;
  customer_confirmed_quantity: number | null;
  delivery_status: string;
  delivery_time: string;
  waybill_reference: string | null;
};

type Evidence = {
  id: string;
  trip_delivery_record_id: string;
  evidence_type: string;
  file_path: string;
  original_filename: string | null;
  uploaded_at: string;
};

type Trip = { id: string; trip_number: string };
type SalesOrderItem = { id: string; sales_order_id: string; product_id: string; quantity: number };
type SalesOrder = { id: string; order_number: string; customer_id: string };
type Customer = { id: string; name: string };
type CustomerLocation = { id: string; customer_id: string; location_name: string };
type Product = { id: string; product_name: string };
type LoadingRecord = { id: string; trip_id: string; product_id: string; loaded_quantity: number };

export default async function DeliveriesPage() {
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
    supabase.rpc("has_permission", { p_permission_key: "transport.view" }),
    supabase.rpc("has_permission", { p_permission_key: "transport.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view deliveries.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const [
    deliveriesResult,
    evidenceResult,
    tripsResult,
    salesItemsResult,
    salesOrdersResult,
    customersResult,
    locationsResult,
    productsResult,
    loadingResult,
  ] = await Promise.all([
    supabase
      .from("trip_delivery_records")
      .select(
        "id, trip_id, sales_order_item_id, customer_location_id, product_id, delivered_quantity, customer_confirmed_quantity, delivery_status, delivery_time, waybill_reference",
      )
      .order("delivery_time", { ascending: false })
      .limit(30),
    supabase
      .from("delivery_evidence")
      .select("id, trip_delivery_record_id, evidence_type, file_path, original_filename, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(30),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(30),
    supabase.from("sales_order_items").select("id, sales_order_id, product_id, quantity"),
    supabase.from("sales_orders").select("id, order_number, customer_id"),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("customer_locations").select("id, customer_id, location_name").order("location_name"),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("trip_loading_records")
      .select("id, trip_id, product_id, loaded_quantity")
      .order("loading_time", { ascending: false })
      .limit(30),
  ]);

  const queryError =
    deliveriesResult.error ??
    evidenceResult.error ??
    tripsResult.error ??
    salesItemsResult.error ??
    salesOrdersResult.error ??
    customersResult.error ??
    locationsResult.error ??
    productsResult.error ??
    loadingResult.error;

  if (queryError) {
    return (
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Delivery data could not be loaded.</h1>
          </section>
        </div>
      </div>
    );
  }

  const deliveries = (deliveriesResult.data ?? []) as Delivery[];
  const evidence = (evidenceResult.data ?? []) as Evidence[];

  const evidenceLinks = new Map<string, string>();
  await Promise.all(
    evidence.map(async (item) => {
      const { data } = await supabase.storage.from("delivery-evidence").createSignedUrl(item.file_path, 600);

      if (data?.signedUrl) {
        evidenceLinks.set(item.id, data.signedUrl);
      }
    }),
  );

  const trips = (tripsResult.data ?? []) as Trip[];
  const salesItems = (salesItemsResult.data ?? []) as SalesOrderItem[];
  const salesOrders = (salesOrdersResult.data ?? []) as SalesOrder[];
  const customers = (customersResult.data ?? []) as Customer[];
  const locations = (locationsResult.data ?? []) as CustomerLocation[];
  const products = (productsResult.data ?? []) as Product[];
  const loadingRecords = (loadingResult.data ?? []) as LoadingRecord[];

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const salesItemById = new Map(salesItems.map((item) => [item.id, item]));
  const salesOrderById = new Map(salesOrders.map((order) => [order.id, order]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const deliveryById = new Map(deliveries.map((delivery) => [delivery.id, delivery]));

  const tripOptions = trips.map((trip) => ({ id: trip.id, label: trip.trip_number }));

  const salesLineOptions = salesItems.map((item) => {
    const order = salesOrderById.get(item.sales_order_id);
    return {
      id: item.id,
      label: `${order?.order_number ?? "order"} · ${productById.get(item.product_id)?.product_name ?? "product"}`,
    };
  });

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.location_name} · ${customerById.get(location.customer_id)?.name ?? "customer"}`,
  }));

  const productOptions = products.map((product) => ({ id: product.id, label: product.product_name }));

  const loadingOptions = loadingRecords.map((record) => ({
    id: record.id,
    label: `${tripById.get(record.trip_id)?.trip_number ?? "trip"} · ${
      productById.get(record.product_id)?.product_name ?? "product"
    }`,
  }));

  const deliveryOptions = deliveries.map((delivery) => ({
    id: delivery.id,
    label: `${tripById.get(delivery.trip_id)?.trip_number ?? "trip"} · ${
      productById.get(delivery.product_id)?.product_name ?? "product"
    } · ${Number(delivery.delivered_quantity).toLocaleString("en-NG")}`,
  }));

  return (
    <div>
      <div className="space-y-6">
<section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Delivery</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Delivery records, customer-confirmed quantities and evidence references.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Deliveries</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Order line</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2 pr-3 text-right">Confirmed</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {deliveries.map((delivery) => {
                  const item = salesItemById.get(delivery.sales_order_item_id);
                  const order = item ? salesOrderById.get(item.sales_order_id) : undefined;
                  const location = locationById.get(delivery.customer_location_id);

                  return (
                    <tr key={delivery.id}>
                      <td className="py-2 pr-3 font-medium">
                        {tripById.get(delivery.trip_id)?.trip_number ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {order?.order_number ?? "—"} · {productById.get(delivery.product_id)?.product_name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {location?.location_name ?? "—"}
                        <span className="block text-[var(--muted)]">
                          {customerById.get(location?.customer_id ?? "")?.name ?? ""}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {Number(delivery.delivered_quantity).toLocaleString("en-NG")}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {delivery.customer_confirmed_quantity === null
                          ? "—"
                          : Number(delivery.customer_confirmed_quantity).toLocaleString("en-NG")}
                      </td>
                      <td className="py-2 pr-3 text-xs">{delivery.delivery_status}</td>
                      <td className="py-2 text-xs">
                        {new Date(delivery.delivery_time).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {deliveries.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No deliveries recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record delivery</h3>
              <div className="mt-3">
                <DeliveryForm
                  trips={tripOptions}
                  salesLines={salesLineOptions}
                  loadingRecords={loadingOptions}
                  locations={locationOptions}
                  products={productOptions}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Delivery evidence</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Delivery</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {evidence.map((item) => {
                  const delivery = deliveryById.get(item.trip_delivery_record_id);

                  return (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 text-xs">
                        {delivery ? tripById.get(delivery.trip_id)?.trip_number ?? "delivery" : "-"}
                      </td>
                      <td className="py-2 pr-3 text-xs">{item.evidence_type}</td>
                      <td className="py-2 pr-3 text-xs break-all">
                        {evidenceLinks.has(item.id) ? (
                          <a
                            className="font-semibold text-[var(--brand)]"
                            href={evidenceLinks.get(item.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.original_filename ?? "Open file"}
                          </a>
                        ) : (
                          item.original_filename ?? item.file_path
                        )}
                      </td>
                      <td className="py-2 text-xs">
                        {new Date(item.uploaded_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {evidence.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No evidence recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Upload evidence</h3>
              <div className="mt-3">
                <EvidenceForm deliveries={deliveryOptions} />
              </div>
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Evidence files upload to private tenant storage and are append-only; signed links expire after ten minutes.
          Delivery confirmation is stored on the delivery row; a separate immutable confirmation event is a pending
          decision.
        </p>
      </div>
    </div>
  );
}

