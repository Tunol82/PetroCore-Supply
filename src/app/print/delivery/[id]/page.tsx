import { notFound, redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { BrandMark } from "@/components/shell/brand-mark";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const dynamic = "force-dynamic";

type Delivery = {
  id: string;
  trip_id: string;
  sales_order_item_id: string;
  trip_loading_record_id: string | null;
  customer_location_id: string;
  product_id: string;
  delivered_quantity: number;
  customer_confirmed_quantity: number | null;
  corrected_quantity: number | null;
  delivery_status: string;
  delivery_time: string;
  waybill_reference: string | null;
  customer_acknowledgement: string | null;
  observed_temperature_c: number | null;
  density_15c: number | null;
  correction_method: string | null;
  correction_factor: number | null;
};

type SalesOrderItem = { id: string; sales_order_id: string; product_id: string; quantity: number };
type SalesOrder = { id: string; order_number: string; customer_id: string };
type Customer = { id: string; name: string };
type CustomerLocation = {
  id: string;
  location_name: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
};
type Product = { id: string; product_name: string; product_code: string; unit_of_measure: string };
type Trip = { id: string; trip_number: string; departure_time: string | null };
type Assignment = {
  truck_id: string | null;
  driver_id: string | null;
  transporter_id: string | null;
  assignment_role: string;
  released_at: string | null;
};
type Truck = { id: string; registration_number: string };
type Driver = { id: string; full_name: string; driver_code: string };
type Transporter = { id: string; business_name: string };
type LoadingRecord = { id: string; loaded_quantity: number };

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}

export default async function WaybillPage({ params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const { id } = await params;
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
    redirect("/workspace/deliveries");
  }

  const { data: deliveryData, error: deliveryError } = await supabase
    .from("trip_delivery_records")
    .select(
      "id, trip_id, sales_order_item_id, trip_loading_record_id, customer_location_id, product_id, delivered_quantity, customer_confirmed_quantity, corrected_quantity, delivery_status, delivery_time, waybill_reference, customer_acknowledgement, observed_temperature_c, density_15c, correction_method, correction_factor",
    )
    .eq("id", id)
    .maybeSingle();

  if (deliveryError || !deliveryData) {
    notFound();
  }

  const delivery = deliveryData as Delivery;

  const [
    salesItemResult,
    productResult,
    locationResult,
    tripResult,
    assignmentResult,
    loadingResult,
  ] = await Promise.all([
    supabase
      .from("sales_order_items")
      .select("id, sales_order_id, product_id, quantity")
      .eq("id", delivery.sales_order_item_id)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id, product_name, product_code, unit_of_measure")
      .eq("id", delivery.product_id)
      .maybeSingle(),
    supabase
      .from("customer_locations")
      .select("id, location_name, address, contact_person, phone, customer_id")
      .eq("id", delivery.customer_location_id)
      .maybeSingle(),
    supabase
      .from("trips")
      .select("id, trip_number, departure_time")
      .eq("id", delivery.trip_id)
      .maybeSingle(),
    supabase
      .from("trip_assignments")
      .select("truck_id, driver_id, transporter_id, assignment_role, released_at")
      .eq("trip_id", delivery.trip_id),
    delivery.trip_loading_record_id
      ? supabase
          .from("trip_loading_records")
          .select("id, loaded_quantity")
          .eq("id", delivery.trip_loading_record_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const salesItem = (salesItemResult.data ?? null) as SalesOrderItem | null;

  const [orderResult, customerResult, trucksResult, driversResult, transportersResult] = await Promise.all([
    salesItem
      ? supabase
          .from("sales_orders")
          .select("id, order_number, customer_id")
          .eq("id", salesItem.sales_order_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    (locationResult.data as { customer_id?: string } | null)?.customer_id
      ? supabase
          .from("customers")
          .select("id, name")
          .eq("id", (locationResult.data as { customer_id: string }).customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("trucks").select("id, registration_number"),
    supabase.from("drivers").select("id, full_name, driver_code"),
    supabase.from("transporters").select("id, business_name"),
  ]);

  const order = (orderResult.data ?? null) as SalesOrder | null;
  const customer = (customerResult.data ?? null) as Customer | null;
  const product = (productResult.data ?? null) as Product | null;
  const location = (locationResult.data ?? null) as CustomerLocation | null;
  const trip = (tripResult.data ?? null) as Trip | null;
  const loadingRecord = (loadingResult.data ?? null) as LoadingRecord | null;
  const assignments = (assignmentResult.data ?? []) as Assignment[];

  const truckById = new Map(((trucksResult.data ?? []) as Truck[]).map((truck) => [truck.id, truck]));
  const driverById = new Map(((driversResult.data ?? []) as Driver[]).map((driver) => [driver.id, driver]));
  const transporterById = new Map(
    ((transportersResult.data ?? []) as Transporter[]).map((transporters) => [transporters.id, transporters]),
  );

  const primaryAssignment = assignments.find((assignment) => !assignment.released_at) ?? assignments[0] ?? null;
  const delivered = Number(delivery.delivered_quantity);
  const confirmed =
    delivery.customer_confirmed_quantity === null ? null : Number(delivery.customer_confirmed_quantity);
  const variance = confirmed === null ? null : confirmed - delivered;
  const unit = product?.unit_of_measure ?? "l";

  const waybillRef = delivery.waybill_reference ?? `WB-${delivery.id.slice(0, 8).toUpperCase()}`;
  const hasMeasurement =
    delivery.corrected_quantity !== null ||
    delivery.observed_temperature_c !== null ||
    delivery.density_15c !== null;

  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  return (
    <div>
      <PrintToolbar title={`Waybill ${waybillRef}`} backHref="/workspace/deliveries" backLabel="Deliveries" />

      <article className="print-sheet mx-auto my-6 max-w-[860px] bg-white p-10 shadow-[var(--shadow)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <h1 className="sr-only">
          Delivery waybill {waybillRef} for {customer?.name ?? "customer"}
        </h1>

        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <p className="text-[15px] font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-[12px] text-[var(--muted)]">{tenant.organisationName}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                {tenant.organisationCode}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
              Delivery waybill
            </p>
            <p className="mono mt-1 text-xl font-semibold">{waybillRef}</p>
            <p className="mt-0.5 text-[12px] capitalize text-[var(--muted)]">
              {delivery.delivery_status.replaceAll("_", " ")}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 border-b border-[var(--line)] py-5 sm:grid-cols-4">
          <Field label="Trip" value={trip?.trip_number ?? "—"} />
          <Field label="Sales order" value={order?.order_number ?? "—"} />
          <Field label="Delivery date" value={formatDate(delivery.delivery_time)} />
          <Field label="Departure" value={formatDate(trip?.departure_time ?? null)} />
        </section>

        <section className="grid gap-6 border-b border-[var(--line)] py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Customer</p>
            <p className="mt-1 text-[15px] font-semibold">{customer?.name ?? "—"}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">{location?.address ?? "No address recorded"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Delivery point
            </p>
            <p className="mt-1 text-[15px] font-semibold">{location?.location_name ?? "—"}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
              {location?.contact_person ?? "No contact"}
              {location?.phone ? ` · ${location.phone}` : ""}
            </p>
          </div>
        </section>

        <section className="py-5">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                <th className="pb-2 pr-4 font-semibold">Product</th>
                <th className="pb-2 pr-4 font-semibold">Code</th>
                <th className="pb-2 pr-4 text-right font-semibold">Ordered</th>
                <th className="pb-2 pr-4 text-right font-semibold">Loaded</th>
                <th className="pb-2 pr-4 text-right font-semibold">Delivered</th>
                <th className="pb-2 pr-4 text-right font-semibold">Confirmed</th>
                <th className="pb-2 text-right font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2.5 pr-4 font-medium">{product?.product_name ?? "—"}</td>
                <td className="py-2.5 pr-4 text-[var(--muted)]">{product?.product_code ?? "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular">
                  {salesItem ? `${formatQuantity(Number(salesItem.quantity))} ${unit}` : "—"}
                </td>
                <td className="py-2.5 pr-4 text-right tabular">
                  {loadingRecord ? `${formatQuantity(Number(loadingRecord.loaded_quantity))} ${unit}` : "—"}
                </td>
                <td className="py-2.5 pr-4 text-right font-semibold tabular">
                  {formatQuantity(delivered)} {unit}
                </td>
                <td className="py-2.5 pr-4 text-right tabular">
                  {confirmed === null ? "—" : `${formatQuantity(confirmed)} ${unit}`}
                </td>
                <td className="py-2.5 text-right tabular">
                  {variance === null ? "—" : `${formatQuantity(variance)} ${unit}`}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 border-t border-[var(--line)] py-5 sm:grid-cols-3">
          <Field
            label="Truck"
            value={primaryAssignment?.truck_id ? truckById.get(primaryAssignment.truck_id)?.registration_number ?? "—" : "—"}
          />
          <Field
            label="Driver"
            value={
              primaryAssignment?.driver_id
                ? `${driverById.get(primaryAssignment.driver_id)?.full_name ?? "—"} (${
                    driverById.get(primaryAssignment.driver_id)?.driver_code ?? "—"
                  })`
                : "—"
            }
          />
          <Field
            label="Transporter"
            value={
              primaryAssignment?.transporter_id
                ? transporterById.get(primaryAssignment.transporter_id)?.business_name ?? "—"
                : "Company vehicle"
            }
          />
        </section>

        {hasMeasurement ? (
          <section className="border-t border-[var(--line)] py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Measurement recorded at delivery
            </p>
            <div className="mt-2 grid gap-4 sm:grid-cols-4">
              <Field
                label="Observed temperature"
                value={delivery.observed_temperature_c === null ? "—" : `${Number(delivery.observed_temperature_c)} °C`}
              />
              <Field
                label="Density at 15 °C"
                value={delivery.density_15c === null ? "—" : String(Number(delivery.density_15c))}
              />
              <Field label="Correction method" value={delivery.correction_method ?? "—"} />
              <Field
                label="Corrected quantity"
                value={
                  delivery.corrected_quantity === null
                    ? "—"
                    : `${formatQuantity(Number(delivery.corrected_quantity))} ${unit}`
                }
              />
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              Temperature correction is recorded for information only; no correction method is mandated.
            </p>
          </section>
        ) : null}

        {delivery.customer_acknowledgement ? (
          <section className="border-t border-[var(--line)] py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Customer acknowledgement
            </p>
            <p className="mt-1 text-[13px]">{delivery.customer_acknowledgement}</p>
          </section>
        ) : null}

        <section className="mt-2 border-t border-[var(--line)] pt-6 print:break-inside-avoid">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Received in good order
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div className="border-t border-[var(--line-strong)] pt-1.5 text-[11px] text-[var(--muted)]">
              Name
            </div>
            <div className="border-t border-[var(--line-strong)] pt-1.5 text-[11px] text-[var(--muted)]">
              Signature
            </div>
            <div className="border-t border-[var(--line-strong)] pt-1.5 text-[11px] text-[var(--muted)]">
              Date
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--muted)]">
          <p>
            Generated {generatedAt} · Delivery {delivery.id.slice(0, 8).toUpperCase()}
          </p>
          <p>Quantities are recorded as measured. This waybill is not a tax invoice.</p>
        </footer>
      </article>
    </div>
  );
}
