import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import {
  DiscrepancyForm,
  InvestigationForm,
  DeleteToleranceRuleForm,
  LiabilityForm,
  ReconciliationForm,
  ReconciliationItemForm,
  RecoveryForm,
  RejectLiabilityForm,
  ToleranceRuleForm,
} from "./forms";

export const dynamic = "force-dynamic";

type Reconciliation = {
  id: string;
  trip_id: string;
  reconciliation_number: string;
  status: string;
  created_at: string;
};

type Item = {
  id: string;
  reconciliation_id: string;
  product_id: string;
  loaded_quantity: number;
  delivered_quantity: number;
  variance_quantity: number;
  reconciliation_status: string;
  tolerance_quantity: number | null;
};

type Recovery = { id: string; discrepancy_id: string; amount: number };

type QuantityChainRow = {
  trip_id: string;
  trip_number: string | null;
  product_id: string;
  supplier_quantity: number | null;
  loaded_quantity: number | null;
  delivered_quantity: number | null;
  supplier_to_loaded_variance: number | null;
  loaded_to_delivered_variance: number | null;
};

type ToleranceRule = {
  id: string;
  product_id: string | null;
  basis: string;
  percentage: number | null;
  absolute_quantity: number | null;
};

type Discrepancy = {
  id: string;
  reconciliation_item_id: string;
  discrepancy_type: string;
  expected_quantity: number;
  actual_quantity: number;
  variance: number;
  status: string;
  liability_status: string;
  liability_basis: string | null;
  liability_unit_cost: number | null;
  liability_amount: number | null;
};

type Investigation = {
  id: string;
  discrepancy_id: string;
  responsible_party_type: string | null;
  responsibility_status: string;
  findings: string | null;
  created_at: string;
};

type Trip = { id: string; trip_number: string };
type Product = { id: string; product_name: string };
type LoadingRecord = { id: string; trip_id: string; product_id: string; loaded_quantity: number };
type Invoice = { id: string; invoice_number: string; trip_id: string | null };
type Delivery = { id: string; trip_id: string; product_id: string; delivered_quantity: number };

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function ReconciliationPage() {
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
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view reconciliation.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const [
    reconciliationsResult,
    itemsResult,
    discrepanciesResult,
    investigationsResult,
    tripsResult,
    productsResult,
    loadingResult,
    deliveriesResult,
    invoicesResult,
    toleranceResult,
    chainResult,
    recoveriesResult,
  ] = await Promise.all([
    supabase
      .from("trip_reconciliations")
      .select("id, trip_id, reconciliation_number, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("trip_reconciliation_items")
      .select("id, reconciliation_id, product_id, loaded_quantity, delivered_quantity, variance_quantity, tolerance_quantity, reconciliation_status")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("delivery_discrepancies")
      .select("id, reconciliation_item_id, discrepancy_type, expected_quantity, actual_quantity, variance, status, liability_status, liability_basis, liability_unit_cost, liability_amount")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("discrepancy_investigations")
      .select("id, discrepancy_id, responsible_party_type, responsibility_status, findings, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(30),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("trip_loading_records")
      .select("id, trip_id, product_id, loaded_quantity")
      .order("loading_time", { ascending: false })
      .limit(30),
    supabase
      .from("trip_delivery_records")
      .select("id, trip_id, product_id, delivered_quantity")
      .order("delivery_time", { ascending: false })
      .limit(30),
    supabase
      .from("transporter_invoices")
      .select("id, invoice_number, trip_id")
      .order("invoice_date", { ascending: false })
      .limit(50),
    supabase.from("tolerance_rules").select("id, product_id, basis, percentage, absolute_quantity").order("created_at", { ascending: false }),
    supabase
      .from("trip_quantity_chain")
      .select("trip_id, trip_number, product_id, supplier_quantity, loaded_quantity, delivered_quantity, supplier_to_loaded_variance, loaded_to_delivered_variance")
      .limit(40),
    supabase.from("transporter_recoveries").select("id, discrepancy_id, amount")
      .order("recorded_at", { ascending: false })
      .limit(100),
  ]);

  const queryError =
    reconciliationsResult.error ??
    itemsResult.error ??
    discrepanciesResult.error ??
    investigationsResult.error ??
    tripsResult.error ??
    productsResult.error ??
    loadingResult.error ??
    deliveriesResult.error ??
    invoicesResult.error ??
    toleranceResult.error ??
    chainResult.error ??
    recoveriesResult.error;

  if (queryError) {
    return (
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Reconciliation data could not be loaded.</h1>
          </section>
        </div>
      </div>
    );
  }

  const reconciliations = (reconciliationsResult.data ?? []) as Reconciliation[];
  const items = (itemsResult.data ?? []) as Item[];
  const discrepancies = (discrepanciesResult.data ?? []) as Discrepancy[];
  const investigations = (investigationsResult.data ?? []) as Investigation[];
  const trips = (tripsResult.data ?? []) as Trip[];
  const products = (productsResult.data ?? []) as Product[];
  const loadingRecords = (loadingResult.data ?? []) as LoadingRecord[];
  const deliveries = (deliveriesResult.data ?? []) as Delivery[];
  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const toleranceRules = (toleranceResult.data ?? []) as ToleranceRule[];
  const quantityChain = (chainResult.data ?? []) as QuantityChainRow[];
  const recoveries = (recoveriesResult.data ?? []) as Recovery[];

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const reconciliationById = new Map(reconciliations.map((item) => [item.id, item]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const discrepancyById = new Map(discrepancies.map((item) => [item.id, item]));

  const tripOptions = trips.map((trip) => ({ id: trip.id, label: trip.trip_number }));

  const reconciliationOptions = reconciliations.map((item) => ({
    id: item.id,
    label: `${item.reconciliation_number} · ${tripById.get(item.trip_id)?.trip_number ?? "trip"}`,
  }));

  const productOptions = products.map((product) => ({ id: product.id, label: product.product_name }));

  const loadingOptions = loadingRecords.map((record) => ({
    id: record.id,
    label: `${tripById.get(record.trip_id)?.trip_number ?? "trip"} · ${
      productById.get(record.product_id)?.product_name ?? "product"
    } · ${formatQuantity(Number(record.loaded_quantity))}`,
  }));

  const deliveryOptions = deliveries.map((delivery) => ({
    id: delivery.id,
    label: `${tripById.get(delivery.trip_id)?.trip_number ?? "trip"} · ${
      productById.get(delivery.product_id)?.product_name ?? "product"
    } · ${formatQuantity(Number(delivery.delivered_quantity))}`,
  }));

  const itemOptions = items.map((item) => ({
    id: item.id,
    label: `${reconciliationById.get(item.reconciliation_id)?.reconciliation_number ?? "reconciliation"} · ${
      productById.get(item.product_id)?.product_name ?? "product"
    }`,
  }));

  const discrepancyOptions = discrepancies.map((item) => ({
    id: item.id,
    label: `${item.discrepancy_type.replaceAll("_", " ")} · ${
      productById.get(itemById.get(item.reconciliation_item_id)?.product_id ?? "")?.product_name ?? "item"
    }`,
  }));

  return (
    <div>
      <div className="space-y-6">
<section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Reconciliation</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Trip reconciliation, variances, discrepancies and investigations. Variance is not a loss or liability.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Reconciliations</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {reconciliations.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 font-medium">{item.reconciliation_number}</td>
                    <td className="py-2 pr-3">{tripById.get(item.trip_id)?.trip_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{item.status}</td>
                    <td className="py-2 text-xs">{new Date(item.created_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reconciliations.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No reconciliations yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Create reconciliation</h3>
              <div className="mt-3"><ReconciliationForm trips={tripOptions} /></div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Reconciliation items</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Reconciliation</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Loaded</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2 pr-3 text-right">Variance</th>
                  <th className="py-2 pr-3 text-right">Tolerance</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-xs">
                      {reconciliationById.get(item.reconciliation_id)?.reconciliation_number ?? "-"}
                    </td>
                    <td className="py-2 pr-3">{productById.get(item.product_id)?.product_name ?? "-"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.loaded_quantity))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.delivered_quantity))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.variance_quantity))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {item.tolerance_quantity === null ? "—" : formatQuantity(Number(item.tolerance_quantity))}
                    </td>
                    <td className="py-2 text-xs">{item.reconciliation_status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No reconciliation items yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Add reconciliation item</h3>
              <div className="mt-3">
                <ReconciliationItemForm
                  reconciliations={reconciliationOptions}
                  loadingRecords={loadingOptions}
                  deliveries={deliveryOptions}
                  products={productOptions}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Quantity chain</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Both measurement points: supplier to loaded, and loaded to delivered. Supplier quantity is apportioned by the
            loading allocations.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Supplier</th>
                  <th className="py-2 pr-3 text-right">Loaded</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2 pr-3 text-right">Supplier → loaded</th>
                  <th className="py-2 text-right">Loaded → delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {quantityChain.map((row) => (
                  <tr key={`${row.trip_id}-${row.product_id}`}>
                    <td className="py-2 pr-3 font-medium">{row.trip_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{productById.get(row.product_id)?.product_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.supplier_quantity === null ? "—" : formatQuantity(Number(row.supplier_quantity))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.loaded_quantity === null ? "—" : formatQuantity(Number(row.loaded_quantity))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.delivered_quantity === null ? "—" : formatQuantity(Number(row.delivered_quantity))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.supplier_to_loaded_variance === null
                        ? "—"
                        : formatQuantity(Number(row.supplier_to_loaded_variance))}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.loaded_to_delivered_variance === null
                        ? "—"
                        : formatQuantity(Number(row.loaded_to_delivered_variance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quantityChain.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No trips with quantities recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Tolerance rules</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Optional. With no rule, items keep the status chosen by the user and no tolerance is recorded.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3 text-right">Percentage</th>
                  <th className="py-2 pr-3 text-right">Absolute</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {toleranceRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-2 pr-3">
                      {rule.product_id ? productById.get(rule.product_id)?.product_name ?? "—" : "All products"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{rule.basis.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {rule.percentage === null ? "—" : `${Number(rule.percentage)}%`}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {rule.absolute_quantity === null ? "—" : formatQuantity(Number(rule.absolute_quantity))}
                    </td>
                    <td className="py-2 text-xs">
                      {canManage ? <DeleteToleranceRuleForm ruleId={rule.id} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {toleranceRules.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No tolerance rules configured.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Add tolerance rule</h3>
              <div className="mt-3">
                <ToleranceRuleForm products={productOptions} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Discrepancies</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Expected</th>
                  <th className="py-2 pr-3 text-right">Actual</th>
                  <th className="py-2 pr-3 text-right">Variance</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Liability</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {discrepancies.map((item) => {
                  const reconciliationTripId = reconciliationById.get(
                    itemById.get(item.reconciliation_item_id)?.reconciliation_id ?? "",
                  )?.trip_id;
                  const invoiceOptions = invoices
                    .filter((invoice) => invoice.trip_id === reconciliationTripId)
                    .map((invoice) => ({ id: invoice.id, label: invoice.invoice_number }));
                  const recovered = recoveries
                    .filter((recovery) => recovery.discrepancy_id === item.id)
                    .reduce((sum, recovery) => sum + Number(recovery.amount), 0);
                  const outstanding = Number(item.liability_amount ?? 0) - recovered;

                  return (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 text-xs">{item.discrepancy_type.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-xs">
                        {productById.get(itemById.get(item.reconciliation_item_id)?.product_id ?? "")?.product_name ?? "-"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.expected_quantity))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.actual_quantity))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(item.variance))}</td>
                      <td className="py-2 pr-3 text-xs">{item.status.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-xs">
                        {item.liability_status === "confirmed" ? (
                          <>
                            <span className="font-semibold">{formatMoney(Number(item.liability_amount))}</span>
                            <span className="block text-[var(--muted)]">
                              {item.liability_basis === "landed_cost" ? "landed cost" : "manual"} ·{" "}
                              {formatMoney(Number(item.liability_unit_cost))}/unit
                            </span>
                            <span className="block text-[var(--muted)]">
                              recovered {formatMoney(recovered)}
                              {outstanding > 0 ? ` · outstanding ${formatMoney(outstanding)}` : " · settled"}
                            </span>
                          </>
                        ) : item.liability_status === "rejected" ? (
                          <span className="text-[var(--muted)]">rejected</span>
                        ) : (
                          <span className="text-[var(--muted)]">not assessed</span>
                        )}
                      </td>
                      <td className="py-2 text-xs">
                        {canManage && item.liability_status === "not_assessed" ? (
                          <div className="space-y-2">
                            <LiabilityForm discrepancyId={item.id} invoices={invoiceOptions} />
                            <RejectLiabilityForm discrepancyId={item.id} />
                          </div>
                        ) : canManage && item.liability_status === "confirmed" && outstanding > 0 ? (
                          <RecoveryForm
                            discrepancyId={item.id}
                            invoices={invoiceOptions}
                            outstanding={outstanding}
                          />
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {discrepancies.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No discrepancies yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Report discrepancy</h3>
              <div className="mt-3"><DiscrepancyForm items={itemOptions} /></div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Investigations</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Discrepancy</th>
                  <th className="py-2 pr-3">Party</th>
                  <th className="py-2 pr-3">Responsibility</th>
                  <th className="py-2 pr-3">Findings</th>
                  <th className="py-2">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {investigations.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-xs">
                      {discrepancyById.get(item.discrepancy_id)?.discrepancy_type.replaceAll("_", " ") ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{item.responsible_party_type ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{item.responsibility_status}</td>
                    <td className="py-2 pr-3 text-xs">{item.findings ?? "—"}</td>
                    <td className="py-2 text-xs">{new Date(item.created_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {investigations.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No investigations yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record investigation</h3>
              <div className="mt-3"><InvestigationForm discrepancies={discrepancyOptions} /></div>
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Variance and provisional impact are evidence only. A discrepancy never becomes a driver, transporter or
          employee debt without investigation and authorised confirmation. Tolerances remain an open decision.
        </p>
      </div>
    </div>
  );
}

