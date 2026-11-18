import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TFoot, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { TripArrivalForm, TripExpenseForm } from "./forms";

export const dynamic = "force-dynamic";

type Trip = {
  id: string;
  trip_number: string;
  status: string;
  departure_time: string | null;
  expected_arrival: string | null;
  actual_arrival: string | null;
  origin_supplier_depot_id: string | null;
  origin_location_id: string | null;
  destination_location_id: string | null;
  created_at: string;
};

type LoadingRecord = {
  id: string;
  compartment_id: string;
  product_id: string;
  loaded_quantity: number;
  loading_time: string;
};

type Allocation = {
  id: string;
  trip_loading_record_id: string;
  procurement_batch_id: string;
  sales_order_item_id: string | null;
  product_id: string;
  allocated_quantity: number;
};

type Delivery = {
  id: string;
  sales_order_item_id: string;
  product_id: string;
  delivered_quantity: number;
  customer_confirmed_quantity: number | null;
  delivery_status: string;
};

type SalesItem = {
  id: string;
  quantity: number;
  selling_price: number;
  line_total: number;
};

type Batch = { id: string; batch_number: string; purchase_order_item_id: string | null };
type PurchaseItem = { id: string; agreed_unit_price: number; ordered_quantity: number; line_total: number };
type Product = { id: string; product_name: string; product_code: string; unit_of_measure: string };
type ReconciliationItem = {
  id: string;
  product_id: string;
  loaded_quantity: number;
  delivered_quantity: number;
  variance_quantity: number;
  tolerance_quantity: number | null;
  reconciliation_status: string;
};
type Discrepancy = {
  id: string;
  reconciliation_item_id: string;
  variance: number;
  liability_status: string;
  liability_amount: number | null;
  provisional_financial_impact: number | null;
};
type Invoice = {
  id: string;
  invoice_number: string;
  transporter_id: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  liability_status: string;
};
type Assignment = { truck_id: string | null; driver_id: string | null; transporter_id: string | null; released_at: string | null };
type Truck = { id: string; registration_number: string };
type Driver = { id: string; full_name: string };
type Transporter = { id: string; business_name: string };
type Depot = { id: string; name: string; depot_code: string };
type Location = { id: string; location_name: string; location_code: string };

type TripExpense = {
  id: string;
  expense_type: string;
  description: string | null;
  amount: number;
  litres: number | null;
  reference: string | null;
  incurred_on: string;
};

const EXPENSE_LABELS: Record<string, string> = {
  fuel: "Fuel",
  toll: "Toll",
  loading: "Loading",
  driver_allowance: "Driver allowance",
  maintenance: "Maintenance",
  other: "Other",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tripDuration(departure: string | null, arrival: string | null) {
  if (!departure || !arrival) {
    return null;
  }

  const hours = (new Date(arrival).getTime() - new Date(departure).getTime()) / 3_600_000;

  if (!Number.isFinite(hours) || hours < 0) {
    return null;
  }

  return hours;
}

function arrivalPunctuality(expected: string | null, actual: string | null) {
  if (!expected || !actual) {
    return null;
  }

  const diffHours = (new Date(actual).getTime() - new Date(expected).getTime()) / 3_600_000;

  if (Math.abs(diffHours) < 0.5) {
    return { label: "On time", tone: "success" as const };
  }

  if (diffHours > 0) {
    return { label: `${diffHours.toFixed(1)} h late`, tone: "warning" as const };
  }

  return { label: `${Math.abs(diffHours).toFixed(1)} h early`, tone: "brand" as const };
}

export default async function TripPnlPage({ params }: { params: Promise<{ id: string }> }) {
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
    redirect("/workspace/dispatch");
  }

  const { data: tripData, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, trip_number, status, departure_time, expected_arrival, actual_arrival, origin_supplier_depot_id, origin_location_id, destination_location_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (tripError || !tripData) {
    notFound();
  }

  const trip = tripData as Trip;

  const [
    loadingResult,
    deliveryResult,
    assignmentsResult,
    reconciliationsResult,
    invoicesResult,
    depotsResult,
    locationsResult,
    transportersResult,
    trucksResult,
    driversResult,
    productsResult,
  ] = await Promise.all([
    supabase
      .from("trip_loading_records")
      .select("id, compartment_id, product_id, loaded_quantity, loading_time")
      .eq("trip_id", trip.id)
      .order("loading_time"),
    supabase
      .from("trip_delivery_records")
      .select("id, sales_order_item_id, product_id, delivered_quantity, customer_confirmed_quantity, delivery_status")
      .eq("trip_id", trip.id)
      .order("delivery_time"),
    supabase
      .from("trip_assignments")
      .select("truck_id, driver_id, transporter_id, released_at")
      .eq("trip_id", trip.id),
    supabase.from("trip_reconciliations").select("id").eq("trip_id", trip.id),
    supabase
      .from("transporter_invoices")
      .select("id, invoice_number, transporter_id, invoice_date, subtotal, tax_amount, total_amount, liability_status")
      .eq("trip_id", trip.id)
      .order("invoice_date"),
    supabase.from("supplier_depots").select("id, name, depot_code"),
    supabase.from("business_locations").select("id, location_name, location_code"),
    supabase.from("transporters").select("id, business_name"),
    supabase.from("trucks").select("id, registration_number"),
    supabase.from("drivers").select("id, full_name"),
    supabase.from("products").select("id, product_name, product_code, unit_of_measure"),
  ]);

  const queryError =
    loadingResult.error ??
    deliveryResult.error ??
    assignmentsResult.error ??
    reconciliationsResult.error ??
    invoicesResult.error ??
    depotsResult.error ??
    locationsResult.error ??
    transportersResult.error ??
    trucksResult.error ??
    driversResult.error ??
    productsResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Trip P&L" title="Unavailable" description="This trip could not be loaded." />
        <ButtonLink href="/workspace/dispatch">Back to dispatch</ButtonLink>
      </div>
    );
  }

  const loadingRecords = (loadingResult.data ?? []) as LoadingRecord[];
  const deliveries = (deliveryResult.data ?? []) as Delivery[];
  const assignments = (assignmentsResult.data ?? []) as Assignment[];
  const reconciliations = (reconciliationsResult.data ?? []) as { id: string }[];
  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const products = (productsResult.data ?? []) as Product[];

  const productById = new Map(products.map((product) => [product.id, product]));
  const transporterById = new Map(((transportersResult.data ?? []) as Transporter[]).map((item) => [item.id, item]));
  const truckById = new Map(((trucksResult.data ?? []) as Truck[]).map((item) => [item.id, item]));
  const driverById = new Map(((driversResult.data ?? []) as Driver[]).map((item) => [item.id, item]));
  const depotById = new Map(((depotsResult.data ?? []) as Depot[]).map((item) => [item.id, item]));
  const locationById = new Map(((locationsResult.data ?? []) as Location[]).map((item) => [item.id, item]));

  const primaryAssignment = assignments.find((assignment) => !assignment.released_at) ?? assignments[0] ?? null;

  const loadingIds = loadingRecords.map((record) => record.id);

  const [allocationsResult, reconciliationItemsResult] = await Promise.all([
    loadingIds.length > 0
      ? supabase
          .from("trip_loading_procurement_allocations")
          .select(
            "id, trip_loading_record_id, procurement_batch_id, sales_order_item_id, product_id, allocated_quantity",
          )
          .in("trip_loading_record_id", loadingIds)
      : Promise.resolve({ data: [], error: null }),
    reconciliations.length > 0
      ? supabase
          .from("trip_reconciliation_items")
          .select(
            "id, product_id, loaded_quantity, delivered_quantity, variance_quantity, tolerance_quantity, reconciliation_status",
          )
          .in(
            "reconciliation_id",
            reconciliations.map((reconciliation) => reconciliation.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (allocationsResult.error || reconciliationItemsResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Trip P&L" title="Unavailable" description="Costing data could not be loaded." />
        <ButtonLink href="/workspace/dispatch">Back to dispatch</ButtonLink>
      </div>
    );
  }

  const allocations = (allocationsResult.data ?? []) as Allocation[];
  const reconciliationItems = (reconciliationItemsResult.data ?? []) as ReconciliationItem[];

  const batchIds = Array.from(new Set(allocations.map((allocation) => allocation.procurement_batch_id)));
  const salesItemIds = Array.from(
    new Set([
      ...allocations.map((allocation) => allocation.sales_order_item_id).filter((value): value is string => Boolean(value)),
      ...deliveries.map((delivery) => delivery.sales_order_item_id),
    ]),
  );

  const [batchesResult, salesItemsResult, discrepanciesResult] = await Promise.all([
    batchIds.length > 0
      ? supabase
          .from("procurement_batches")
          .select("id, batch_number, purchase_order_item_id")
          .in("id", batchIds)
      : Promise.resolve({ data: [], error: null }),
    salesItemIds.length > 0
      ? supabase
          .from("sales_order_items")
          .select("id, quantity, selling_price, line_total")
          .in("id", salesItemIds)
      : Promise.resolve({ data: [], error: null }),
    reconciliationItems.length > 0
      ? supabase
          .from("delivery_discrepancies")
          .select(
            "id, reconciliation_item_id, variance, liability_status, liability_amount, provisional_financial_impact",
          )
          .in(
            "reconciliation_item_id",
            reconciliationItems.map((item) => item.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const batches = (batchesResult.data ?? []) as Batch[];
  const salesItems = (salesItemsResult.data ?? []) as SalesItem[];
  const discrepancies = (discrepanciesResult.data ?? []) as Discrepancy[];

  const purchaseItemIds = Array.from(
    new Set(batches.map((batch) => batch.purchase_order_item_id).filter((value): value is string => Boolean(value))),
  );
  const discrepancyIds = discrepancies.map((discrepancy) => discrepancy.id);

  const [purchaseItemsResult, recoveriesResult, landedCostsResult, expensesResult] = await Promise.all([
    purchaseItemIds.length > 0
      ? supabase
          .from("purchase_order_items")
          .select("id, agreed_unit_price, ordered_quantity, line_total")
          .in("id", purchaseItemIds)
      : Promise.resolve({ data: [], error: null }),
    discrepancyIds.length > 0
      ? supabase.from("transporter_recoveries").select("id, discrepancy_id, amount").in("discrepancy_id", discrepancyIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length > 0
      ? supabase
          .from("inventory_batches")
          .select("procurement_batch_id, landed_cost_per_unit")
          .in("procurement_batch_id", batchIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("trip_expenses")
      .select("id, expense_type, description, amount, litres, reference, incurred_on")
      .eq("trip_id", trip.id)
      .order("incurred_on", { ascending: false }),
  ]);

  if (purchaseItemsResult.error || recoveriesResult.error || landedCostsResult.error || expensesResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Trip P&L" title="Unavailable" description="Costing data could not be loaded." />
        <ButtonLink href="/workspace/dispatch">Back to dispatch</ButtonLink>
      </div>
    );
  }

  const purchaseItems = (purchaseItemsResult.data ?? []) as PurchaseItem[];
  const recoveries = (recoveriesResult.data ?? []) as { id: string; discrepancy_id: string; amount: number }[];
  const landedCosts = (landedCostsResult.data ?? []) as {
    procurement_batch_id: string;
    landed_cost_per_unit: number;
  }[];
  const expenses = (expensesResult.data ?? []) as TripExpense[];

  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const purchaseItemById = new Map(purchaseItems.map((item) => [item.id, item]));
  const salesItemById = new Map(salesItems.map((item) => [item.id, item]));

  const loadedByProduct = new Map<string, number>();
  for (const record of loadingRecords) {
    loadedByProduct.set(record.product_id, (loadedByProduct.get(record.product_id) ?? 0) + Number(record.loaded_quantity));
  }

  const deliveredByProduct = new Map<string, number>();
  for (const delivery of deliveries) {
    deliveredByProduct.set(
      delivery.product_id,
      (deliveredByProduct.get(delivery.product_id) ?? 0) + Number(delivery.delivered_quantity),
    );
  }

  const totalLoaded = Array.from(loadedByProduct.values()).reduce((sum, value) => sum + value, 0);
  const totalDelivered = Array.from(deliveredByProduct.values()).reduce((sum, value) => sum + value, 0);

  let purchaseCost = 0;
  let uncostedPurchaseLitres = 0;
  const purchaseCostByProduct = new Map<string, number>();
  const landedCostByBatch = new Map(
    landedCosts.map((row) => [row.procurement_batch_id, Number(row.landed_cost_per_unit)]),
  );

  for (const allocation of allocations) {
    const batch = batchById.get(allocation.procurement_batch_id);
    const purchaseItem = batch?.purchase_order_item_id
      ? purchaseItemById.get(batch.purchase_order_item_id)
      : undefined;

    const poUnitPrice = purchaseItem
      ? Number(purchaseItem.ordered_quantity) > 0
        ? Number(purchaseItem.line_total) / Number(purchaseItem.ordered_quantity)
        : Number(purchaseItem.agreed_unit_price)
      : null;

    const landedUnitPrice = landedCostByBatch.get(allocation.procurement_batch_id) ?? 0;

    const effectiveUnitPrice =
      poUnitPrice !== null && Number.isFinite(poUnitPrice) && poUnitPrice > 0
        ? poUnitPrice
        : landedUnitPrice > 0
          ? landedUnitPrice
          : null;

    const quantity = Number(allocation.allocated_quantity);

    if (effectiveUnitPrice === null) {
      uncostedPurchaseLitres += quantity;
      continue;
    }

    const cost = quantity * effectiveUnitPrice;
    purchaseCost += cost;
    purchaseCostByProduct.set(
      allocation.product_id,
      (purchaseCostByProduct.get(allocation.product_id) ?? 0) + cost,
    );
  }

  let revenue = 0;
  let uncostedSalesLitres = 0;
  const revenueByProduct = new Map<string, number>();

  for (const delivery of deliveries) {
    const salesItem = salesItemById.get(delivery.sales_order_item_id);
    const quantity = Number(delivery.delivered_quantity);

    const unitPrice = salesItem
      ? Number(salesItem.quantity) > 0
        ? Number(salesItem.line_total) / Number(salesItem.quantity)
        : Number(salesItem.selling_price)
      : null;

    if (unitPrice === null || !Number.isFinite(unitPrice)) {
      uncostedSalesLitres += quantity;
      continue;
    }

    const value = quantity * unitPrice;
    revenue += value;
    revenueByProduct.set(delivery.product_id, (revenueByProduct.get(delivery.product_id) ?? 0) + value);
  }

  const transportCost = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const recovered = recoveries.reduce((sum, recovery) => sum + Number(recovery.amount), 0);

  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const fuelLitres = expenses
    .filter((expense) => expense.expense_type === "fuel" && expense.litres !== null)
    .reduce((sum, expense) => sum + Number(expense.litres), 0);
  const fuelCost = expenses
    .filter((expense) => expense.expense_type === "fuel")
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const confirmedLiability = discrepancies
    .filter((discrepancy) => discrepancy.liability_status === "confirmed")
    .reduce((sum, discrepancy) => sum + Number(discrepancy.liability_amount ?? 0), 0);

  const provisionalLiability = discrepancies
    .filter((discrepancy) => discrepancy.liability_status !== "confirmed")
    .reduce((sum, discrepancy) => sum + Number(discrepancy.provisional_financial_impact ?? 0), 0);

  const netCost = purchaseCost + transportCost + expenseTotal - recovered;
  const contribution = revenue - transportCost - expenseTotal + recovered;
  const grossMargin = purchaseCost > 0 ? revenue - netCost : null;
  const costPerDeliveredLitre = totalDelivered > 0 && purchaseCost > 0 ? netCost / totalDelivered : null;

  const shortage = totalLoaded - totalDelivered;
  const productIds = Array.from(
    new Set([
      ...loadedByProduct.keys(),
      ...deliveredByProduct.keys(),
      ...reconciliationItems.map((item) => item.product_id),
    ]),
  );

  const reconciliationByProduct = new Map<string, ReconciliationItem>();
  for (const item of reconciliationItems) {
    reconciliationByProduct.set(item.product_id, item);
  }

  const origin = trip.origin_supplier_depot_id
    ? depotById.get(trip.origin_supplier_depot_id)?.name ?? "Supplier depot"
    : trip.origin_location_id
      ? locationById.get(trip.origin_location_id)?.location_name ?? "Storage location"
      : "Origin not set";

  const destination = trip.destination_location_id
    ? locationById.get(trip.destination_location_id)?.location_name ?? "Destination"
    : "Destination not set";

  const gaps: string[] = [];

  if (allocations.length === 0) {
    gaps.push("No loading allocations: purchase cost cannot be derived for this trip.");
  }

  if (uncostedPurchaseLitres > 0) {
    gaps.push(
      `${formatQuantity(uncostedPurchaseLitres)} litres allocated to a batch without a purchase order price or a landed cost.`,
    );
  }

  if (uncostedSalesLitres > 0) {
    gaps.push(`${formatQuantity(uncostedSalesLitres)} delivered litres have no sales price on the order line.`);
  }

  if (invoices.length === 0) {
    gaps.push("No transporter invoice is linked to this trip, so transport cost is zero here.");
  }

  if (trip.actual_arrival === null) {
    gaps.push("Actual arrival is not recorded, so trip duration and on-time performance are unavailable.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trip P&L"
        title={trip.trip_number}
        description={`${origin} → ${destination}${
          trip.departure_time ? ` · departed ${formatDate(trip.departure_time)}` : ""
        } · operational statement, not statutory profit.`}
        actions={
          <>
            <ButtonLink href="/workspace/dispatch">Dispatch</ButtonLink>
            <ButtonLink href="/workspace/reconciliation">Trip checks</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatMoney(revenue)}
          hint={uncostedSalesLitres > 0 ? `${formatQuantity(uncostedSalesLitres)} L unpriced` : "Delivered × order price"}
          tone="brand"
        />
        <StatCard label="Transport cost" value={formatMoney(transportCost)} hint={`${invoices.length} linked invoice${invoices.length === 1 ? "" : "s"}`} />
        <StatCard
          label="Purchase cost"
          value={purchaseCost > 0 ? formatMoney(purchaseCost) : "Not costed"}
          hint={
            purchaseCost > 0
              ? `${formatQuantity(totalLoaded)} L loaded`
              : allocations.length === 0
                ? "No loading allocations"
                : `${formatQuantity(uncostedPurchaseLitres)} L missing a PO price`
          }
        />
        <StatCard
          label="Contribution"
          value={formatMoney(contribution)}
          hint={grossMargin === null ? "After transport and expenses, before purchase cost" : "After transport, expenses and purchase cost"}
          tone={contribution < 0 ? "danger" : "accent"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Volume chain"
            description="Loaded versus delivered by product, with the reconciliation tolerance status where one exists."
          />
          <CardBody>
            {productIds.length === 0 ? (
              <EmptyState title="No quantities recorded" description="Load the trip or record a delivery first." />
            ) : (
              <TableScroll>
                <Table minWidth={680}>
                  <THead>
                    <TR>
                      <TH>Product</TH>
                      <TH align="right">Loaded</TH>
                      <TH align="right">Delivered</TH>
                      <TH align="right">Variance</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {productIds.map((productId) => {
                      const product = productById.get(productId);
                      const loaded = loadedByProduct.get(productId) ?? 0;
                      const delivered = deliveredByProduct.get(productId) ?? 0;
                      const item = reconciliationByProduct.get(productId);
                      const unit = product?.unit_of_measure ?? "L";

                      return (
                        <TR key={productId}>
                          <TD className="font-medium">
                            {product?.product_name ?? "Product"}
                            <span className="block text-xs text-[var(--muted)]">{product?.product_code ?? ""}</span>
                          </TD>
                          <TD align="right">{formatQuantity(loaded)} {unit}</TD>
                          <TD align="right">{formatQuantity(delivered)} {unit}</TD>
                          <TD align="right">
                            {loadingsVariance(loaded, delivered, unit)}
                          </TD>
                          <TD>
                            {item ? (
                              <div className="space-y-1">
                                <StatusBadge status={item.reconciliation_status} />
                                <span className="block text-xs text-[var(--muted)]">
                                  Reconciled Δ {formatQuantity(Number(item.variance_quantity))} {unit}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--muted)]">Not reconciled</span>
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

        <Card>
          <CardHeader title="Trip detail" description="Assignment, timing and closure context." />
          <CardBody>
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={<StatusBadge status={trip.status} />} />
              <Row
                label="Truck"
                value={
                  primaryAssignment?.truck_id
                    ? truckById.get(primaryAssignment.truck_id)?.registration_number ?? "—"
                    : "—"
                }
              />
              <Row
                label="Driver"
                value={primaryAssignment?.driver_id ? driverById.get(primaryAssignment.driver_id)?.full_name ?? "—" : "—"}
              />
              <Row
                label="Transporter"
                value={
                  primaryAssignment?.transporter_id
                    ? transporterById.get(primaryAssignment.transporter_id)?.business_name ?? "—"
                    : "Company vehicle"
                }
              />
              <Row label="Departure" value={formatDate(trip.departure_time)} />
              <Row label="Expected arrival" value={formatDate(trip.expected_arrival)} />
              <Row
                label="Actual arrival"
                value={trip.actual_arrival ? formatDateTime(trip.actual_arrival) : "Not recorded"}
              />
              <Row
                label="Duration"
                value={
                  tripDuration(trip.departure_time, trip.actual_arrival) === null
                    ? "—"
                    : `${tripDuration(trip.departure_time, trip.actual_arrival)!.toFixed(1)} h`
                }
              />
              <Row
                label="Punctuality"
                value={
                  arrivalPunctuality(trip.expected_arrival, trip.actual_arrival) ? (
                    <Badge tone={arrivalPunctuality(trip.expected_arrival, trip.actual_arrival)!.tone}>
                      {arrivalPunctuality(trip.expected_arrival, trip.actual_arrival)!.label}
                    </Badge>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Compartments loaded" value={String(loadingRecords.length)} />
            </dl>

            {canManage && !trip.actual_arrival ? <TripArrivalForm tripId={trip.id} /> : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Money statement"
          description="Operational view: revenue from delivered quantities at the order price, purchase from allocated lifting at PO price, transport from linked invoices."
        />
        <CardBody>
          <dl className="divide-y divide-[var(--line)]">
            <MoneyRow label="Revenue (delivered × order price)" amount={revenue} />
            <MoneyRow
              label="Purchase cost (allocated lifting × PO price)"
              amount={purchaseCost}
              muted={purchaseCost === 0}
              note={purchaseCost === 0 ? "Not recorded for this trip" : undefined}
            />
            <MoneyRow label="Transport cost (linked invoices)" amount={transportCost} />
            <MoneyRow
              label="Trip expenses (fuel, tolls, other)"
              amount={expenseTotal}
              muted={expenseTotal === 0}
              note={expenseTotal === 0 ? "None recorded" : undefined}
            />
            <MoneyRow label="Recoveries from transporter" amount={-recovered} muted={recovered === 0} />
            <MoneyRow label="Contribution after transport and expenses" amount={contribution} strong />
            <MoneyRow
              label="Gross margin after purchase, transport and expenses"
              amount={grossMargin ?? 0}
              strong
              muted={grossMargin === null}
              note={grossMargin === null ? "Needs a costed purchase quantity" : undefined}
            />
            <MoneyRow
              label="Net cost per delivered litre"
              amount={costPerDeliveredLitre ?? 0}
              muted={costPerDeliveredLitre === null}
              note={costPerDeliveredLitre === null ? "Needs purchase cost" : undefined}
              isRate
            />
          </dl>
          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
            {totalLoaded === 0 && totalDelivered > 0
              ? "No loading recorded for this trip, so the loaded-versus-delivered chain is incomplete."
              : `Chain variance ${formatQuantity(shortage)} L`}{" "}
            · confirmed liability {formatMoney(confirmedLiability)} · provisional {formatMoney(provisionalLiability)}.
            Excludes overheads, driver costs and statutory items.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Trip expenses"
          description="Fuel, tolls, loading and other costs recorded against this trip. Append-only; they feed the statement above."
        />
        <CardBody>
          {expenses.length === 0 ? (
            <EmptyState
              title="No trip expenses"
              description="Record fuel, tolls or loading costs below to include them in the margin."
            />
          ) : (
            <TableScroll>
              <Table minWidth={760}>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH align="right">Litres</TH>
                    <TH align="right">Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {expenses.map((expense) => (
                    <TR key={expense.id}>
                      <TD className="font-medium">{EXPENSE_LABELS[expense.expense_type] ?? expense.expense_type}</TD>
                      <TD className="text-xs text-[var(--muted)]">{formatDate(expense.incurred_on)}</TD>
                      <TD className="text-xs">
                        {expense.description ?? "—"}
                        {expense.reference ? (
                          <span className="block text-[var(--muted)]">{expense.reference}</span>
                        ) : null}
                      </TD>
                      <TD align="right">
                        {expense.litres === null ? (
                          <span className="text-[var(--muted)]">—</span>
                        ) : (
                          formatQuantity(Number(expense.litres))
                        )}
                      </TD>
                      <TD align="right">{formatMoney(Number(expense.amount))}</TD>
                    </TR>
                  ))}
                </TBody>
                <TFoot>
                  <TR>
                    <TD>Total</TD>
                    <TD />
                    <TD className="text-xs text-[var(--muted)]">
                      {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                    </TD>
                    <TD align="right">{fuelLitres > 0 ? formatQuantity(fuelLitres) : ""}</TD>
                    <TD align="right">{formatMoney(expenseTotal)}</TD>
                  </TR>
                </TFoot>
              </Table>
            </TableScroll>
          )}

          {fuelLitres > 0 ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Fuel {formatQuantity(fuelLitres)} L · {formatMoney(fuelCost / fuelLitres)} per litre recorded.
            </p>
          ) : null}

          {canManage ? (
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <TripExpenseForm tripId={trip.id} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Transport invoices"
            description="Only invoices explicitly linked to this trip appear here."
          />
          <CardBody>
            {invoices.length === 0 ? (
              <EmptyState
                title="No linked invoice"
                description="Record a transporter invoice and link it to this trip to cost the haulage."
              />
            ) : (
              <TableScroll>
                <Table minWidth={520}>
                  <THead>
                    <TR>
                      <TH>Invoice</TH>
                      <TH>Transporter</TH>
                      <TH>Date</TH>
                      <TH align="right">Total</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {invoices.map((invoice) => (
                      <TR key={invoice.id}>
                        <TD className="font-medium">
                          <Link
                            href={`/print/transporter-invoice/${invoice.id}`}
                            className="text-[var(--brand)] hover:underline"
                          >
                            {invoice.invoice_number}
                          </Link>
                        </TD>
                        <TD className="text-xs">
                          {transporterById.get(invoice.transporter_id)?.business_name ?? "—"}
                        </TD>
                        <TD className="text-xs text-[var(--muted)]">{formatDate(invoice.invoice_date)}</TD>
                        <TD align="right">{formatMoney(Number(invoice.total_amount))}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Shortages, liability and recovery" description="Confirmed amounts and any recovery recorded." />
          <CardBody>
            {discrepancies.length === 0 ? (
              <EmptyState title="No discrepancy" description="Nothing flagged for this trip." />
            ) : (
              <TableScroll>
                <Table minWidth={480}>
                  <THead>
                    <TR>
                      <TH>Item</TH>
                      <TH>Liability</TH>
                      <TH align="right">Amount</TH>
                      <TH align="right">Recovered</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {discrepancies.map((discrepancy) => {
                      const item = reconciliationItems.find((row) => row.id === discrepancy.reconciliation_item_id);
                      const recoveredForItem = recoveries
                        .filter((recovery) => recovery.discrepancy_id === discrepancy.id)
                        .reduce((sum, recovery) => sum + Number(recovery.amount), 0);
                      const amount =
                        discrepancy.liability_status === "confirmed"
                          ? discrepancy.liability_amount
                          : discrepancy.provisional_financial_impact;

                      return (
                        <TR key={discrepancy.id}>
                          <TD>
                            {productById.get(item?.product_id ?? "")?.product_name ?? "—"}
                            <span className="block text-xs text-[var(--muted)]">
                              Variance {formatQuantity(Number(discrepancy.variance))}
                            </span>
                          </TD>
                          <TD>
                            <StatusBadge status={discrepancy.liability_status} />
                          </TD>
                          <TD align="right">
                            {amount === null ? (
                              <span className="text-[var(--muted)]">—</span>
                            ) : (
                              formatMoney(Number(amount))
                            )}
                          </TD>
                          <TD align="right">{formatMoney(recoveredForItem)}</TD>
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

      {gaps.length > 0 ? (
        <Card>
          <CardHeader title="Data gaps on this trip" description="What to fill in before trusting the margin." />
          <CardBody>
            <ul className="space-y-1.5 text-sm text-[var(--ink-2)]">
              {gaps.map((gap) => (
                <li key={gap} className="flex gap-2">
                  <span aria-hidden className="text-[var(--warning)]">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function MoneyRow({
  label,
  amount,
  strong = false,
  muted = false,
  note,
  isRate = false,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  muted?: boolean;
  note?: string;
  isRate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={`text-sm ${strong ? "font-semibold" : ""} ${muted ? "text-[var(--muted)]" : ""}`}>
        {label}
        {note ? <span className="block text-xs text-[var(--muted)]">{note}</span> : null}
      </dt>
      <dd
        className={`tabular text-right ${strong ? "text-base font-semibold" : "text-sm"} ${
          muted ? "text-[var(--muted)]" : amount < 0 ? "text-[var(--danger)]" : ""
        }`}
      >
        {muted && amount === 0 ? (
          "—"
        ) : (
          <>
            {formatMoney(amount)}
            {isRate ? <span className="text-xs text-[var(--muted)]"> / L</span> : null}
          </>
        )}
      </dd>
    </div>
  );
}

function loadingsVariance(loaded: number, delivered: number, unit: string) {
  const variance = delivered - loaded;

  if (loaded === 0 && delivered === 0) {
    return "—";
  }

  if (variance === 0) {
    return "0";
  }

  return `${variance > 0 ? "+" : ""}${formatQuantity(variance)} ${unit}`;
}
