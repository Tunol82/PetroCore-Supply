import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
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
  notes: string | null;
  uploaded_at: string;
};

type Trip = { id: string; trip_number: string };
type SalesOrderItem = { id: string; sales_order_id: string; product_id: string; quantity: number };
type SalesOrder = { id: string; order_number: string; customer_id: string };
type Customer = { id: string; name: string };
type CustomerLocation = { id: string; customer_id: string; location_name: string };
type Product = { id: string; product_name: string };
type LoadingRecord = { id: string; trip_id: string; product_id: string; loaded_quantity: number };

const TABS = ["deliveries", "evidence"] as const;

const EVIDENCE_TONES: Record<string, "brand" | "success" | "accent" | "neutral"> = {
  signature: "success",
  photo: "brand",
  waybill: "accent",
  other: "neutral",
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export default async function DeliveriesPage({
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
    supabase.rpc("has_permission", { p_permission_key: "transport.view" }),
    supabase.rpc("has_permission", { p_permission_key: "transport.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Deliveries" title="Not authorised" description="You cannot view deliveries." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "deliveries";

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
      .limit(50),
    supabase
      .from("delivery_evidence")
      .select("id, trip_delivery_record_id, evidence_type, file_path, original_filename, notes, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(50),
    supabase.from("sales_order_items").select("id, sales_order_id, product_id, quantity"),
    supabase.from("sales_orders").select("id, order_number, customer_id"),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("customer_locations").select("id, customer_id, location_name").order("location_name"),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("trip_loading_records")
      .select("id, trip_id, product_id, loaded_quantity")
      .order("loading_time", { ascending: false })
      .limit(50),
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
      <div className="space-y-6">
        <PageHeader eyebrow="Deliveries" title="Unavailable" description="Delivery data could not be loaded." />
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
    } · ${formatQuantity(Number(delivery.delivered_quantity))}`,
  }));

  const confirmed = deliveries.filter((delivery) => delivery.customer_confirmed_quantity !== null).length;
  const pendingConfirmation = deliveries.length - confirmed;
  const deliveredVolume = deliveries.reduce((sum, delivery) => sum + Number(delivery.delivered_quantity), 0);

  const tabs = [
    { href: "/workspace/deliveries?tab=deliveries", label: "Deliveries", count: deliveries.length },
    { href: "/workspace/deliveries?tab=evidence", label: "Evidence", count: evidence.length },
  ];
  const activeHref = `/workspace/deliveries?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deliveries"
        title={tenant.organisationName}
        description="Delivery records, customer-confirmed quantities and evidence references. Evidence files stay in private tenant storage."
        actions={
          <>
            <ButtonLink href="/workspace/dispatch">Dispatch</ButtonLink>
            <ButtonLink href="/workspace/sales">Sales</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Deliveries" value={deliveries.length} hint={`${formatQuantity(deliveredVolume)} delivered`} tone="brand" />
        <StatCard label="Confirmed" value={confirmed} hint="Customer-confirmed quantity recorded" />
        <StatCard
          label="Pending confirmation"
          value={pendingConfirmation}
          hint={
            deliveries.length === 0 ? "No deliveries yet" : pendingConfirmation === 0 ? "All confirmed" : "Awaiting customer sign-off"
          }
        />
        <StatCard label="Evidence files" value={evidence.length} hint="Signed links valid 10 minutes" />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "deliveries" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Delivery records"
              description="Cumulative deliveries cannot exceed the ordered quantity; confirmed quantity cannot exceed delivered quantity."
            />
            <CardBody>
              {deliveries.length === 0 ? (
                <EmptyState title="No deliveries recorded" description="Record the first delivery below." />
              ) : (
                <TableScroll>
                  <Table minWidth={980}>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Order line</TH>
                        <TH>Location</TH>
                        <TH align="right">Delivered</TH>
                        <TH align="right">Confirmed</TH>
                        <TH>Status</TH>
                        <TH>Waybill</TH>
                        <TH>Date</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {deliveries.map((delivery) => {
                        const item = salesItemById.get(delivery.sales_order_item_id);
                        const order = item ? salesOrderById.get(item.sales_order_id) : undefined;
                        const location = locationById.get(delivery.customer_location_id);

                        return (
                          <TR key={delivery.id}>
                            <TD className="font-medium">{tripById.get(delivery.trip_id)?.trip_number ?? "—"}</TD>
                            <TD className="text-xs">
                              {order?.order_number ?? "—"}
                              <span className="block text-[var(--muted)]">
                                {productById.get(delivery.product_id)?.product_name ?? "—"}
                              </span>
                            </TD>
                            <TD className="text-xs">
                              {location?.location_name ?? "—"}
                              <span className="block text-[var(--muted)]">
                                {customerById.get(location?.customer_id ?? "")?.name ?? ""}
                              </span>
                            </TD>
                            <TD align="right">{formatQuantity(Number(delivery.delivered_quantity))}</TD>
                            <TD align="right">
                              {delivery.customer_confirmed_quantity === null ? (
                                <span className="text-[var(--muted)]">—</span>
                              ) : (
                                formatQuantity(Number(delivery.customer_confirmed_quantity))
                              )}
                            </TD>
                            <TD>
                              <StatusBadge status={delivery.delivery_status} />
                            </TD>
                            <TD className="text-xs">
                              <Link
                                href={`/print/delivery/${delivery.id}`}
                                className="font-medium text-[var(--brand)] hover:underline"
                              >
                                {delivery.waybill_reference ?? "Print waybill"}
                              </Link>
                            </TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {new Date(delivery.delivery_time).toLocaleDateString("en-GB")}
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
            <Card>
              <CardHeader
                title="Record delivery"
                description="Link the trip, order line, product and delivery location. Measurement fields are optional."
              />
              <CardBody>
                <DeliveryForm
                  trips={tripOptions}
                  salesLines={salesLineOptions}
                  loadingRecords={loadingOptions}
                  locations={locationOptions}
                  products={productOptions}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "evidence" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Delivery evidence"
              description="Signatures, photos and waybills attached to a delivery record. Evidence is append-only."
            />
            <CardBody>
              {evidence.length === 0 ? (
                <EmptyState title="No evidence uploaded" description="Upload the first file below." />
              ) : (
                <TableScroll>
                  <Table minWidth={760}>
                    <THead>
                      <TR>
                        <TH>Delivery</TH>
                        <TH>Type</TH>
                        <TH>File</TH>
                        <TH>Notes</TH>
                        <TH>Uploaded</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {evidence.map((item) => {
                        const delivery = deliveryById.get(item.trip_delivery_record_id);

                        return (
                          <TR key={item.id}>
                            <TD className="text-xs">
                              {delivery ? tripById.get(delivery.trip_id)?.trip_number ?? "delivery" : "—"}
                            </TD>
                            <TD>
                              <Badge tone={EVIDENCE_TONES[item.evidence_type] ?? "neutral"}>{item.evidence_type}</Badge>
                            </TD>
                            <TD className="break-all text-xs">
                              {evidenceLinks.has(item.id) ? (
                                <a
                                  className="font-semibold text-[var(--brand)] hover:underline"
                                  href={evidenceLinks.get(item.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {item.original_filename ?? "Open file"}
                                </a>
                              ) : (
                                <span className="text-[var(--muted)]">{item.original_filename ?? item.file_path}</span>
                              )}
                            </TD>
                            <TD className="text-xs text-[var(--muted)]">{item.notes ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {new Date(item.uploaded_at).toLocaleDateString("en-GB")}
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
            <Card>
              <CardHeader
                title="Upload evidence"
                description="JPEG, PNG, WebP or PDF up to 5 MB. Files upload to private tenant storage."
              />
              <CardBody>
                {deliveries.length === 0 ? (
                  <EmptyState title="No delivery to attach to" description="Record a delivery before uploading evidence." />
                ) : (
                  <EvidenceForm deliveries={deliveryOptions} />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Evidence files upload to private tenant storage and are append-only; signed links expire after ten minutes.
        Delivery confirmation is stored on the delivery row; a separate immutable confirmation event is a pending
        decision.
      </p>
    </div>
  );
}
