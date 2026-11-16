import Link from "next/link";
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

const TABS = ["overview", "reconciliations", "discrepancies", "investigations"] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function ReconciliationPage({
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
        <PageHeader eyebrow="Reconciliation" title="Not authorised" description="You cannot view reconciliation." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "overview";

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
      .limit(50),
    supabase
      .from("trip_reconciliation_items")
      .select(
        "id, reconciliation_id, product_id, loaded_quantity, delivered_quantity, variance_quantity, tolerance_quantity, reconciliation_status",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("delivery_discrepancies")
      .select(
        "id, reconciliation_item_id, discrepancy_type, expected_quantity, actual_quantity, variance, status, liability_status, liability_basis, liability_unit_cost, liability_amount",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("discrepancy_investigations")
      .select("id, discrepancy_id, responsible_party_type, responsibility_status, findings, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(50),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("trip_loading_records")
      .select("id, trip_id, product_id, loaded_quantity")
      .order("loading_time", { ascending: false })
      .limit(50),
    supabase
      .from("trip_delivery_records")
      .select("id, trip_id, product_id, delivered_quantity")
      .order("delivery_time", { ascending: false })
      .limit(50),
    supabase
      .from("transporter_invoices")
      .select("id, invoice_number, trip_id")
      .order("invoice_date", { ascending: false })
      .limit(50),
    supabase
      .from("tolerance_rules")
      .select("id, product_id, basis, percentage, absolute_quantity")
      .order("created_at", { ascending: false }),
    supabase
      .from("trip_quantity_chain")
      .select(
        "trip_id, trip_number, product_id, supplier_quantity, loaded_quantity, delivered_quantity, supplier_to_loaded_variance, loaded_to_delivered_variance",
      )
      .limit(60),
    supabase.from("transporter_recoveries").select("id, discrepancy_id, amount").order("recorded_at", { ascending: false }).limit(100),
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
      <div className="space-y-6">
        <PageHeader eyebrow="Reconciliation" title="Unavailable" description="Reconciliation data could not be loaded." />
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

  const confirmedLiability = discrepancies
    .filter((discrepancy) => discrepancy.liability_status === "confirmed")
    .reduce((sum, discrepancy) => sum + Number(discrepancy.liability_amount ?? 0), 0);
  const openDiscrepancies = discrepancies.filter(
    (discrepancy) => discrepancy.status === "open" || discrepancy.status === "under_investigation",
  ).length;

  const tabs = [
    { href: "/workspace/reconciliation?tab=overview", label: "Overview", count: quantityChain.length },
    {
      href: "/workspace/reconciliation?tab=reconciliations",
      label: "Reconciliations",
      count: reconciliations.length,
    },
    {
      href: "/workspace/reconciliation?tab=discrepancies",
      label: "Discrepancies",
      count: discrepancies.length,
    },
    {
      href: "/workspace/reconciliation?tab=investigations",
      label: "Investigations",
      count: investigations.length,
    },
  ];
  const activeHref = `/workspace/reconciliation?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reconciliation"
        title={tenant.organisationName}
        description="Trip variances, discrepancies, liability and investigations. Variance is evidence, not a loss."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reconciliations" value={reconciliations.length} hint="One per trip" />
        <StatCard label="Open discrepancies" value={openDiscrepancies} hint="Awaiting investigation" tone="accent" />
        <StatCard label="Confirmed liability" value={formatMoney(confirmedLiability)} hint="At landed cost" tone="danger" />
        <StatCard label="Tolerance rules" value={toleranceRules.length} hint="Optional classification" />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "overview" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Quantity chain"
              description="Both measurement points: supplier to loaded, and loaded to delivered."
            />
            <CardBody>
              {quantityChain.length === 0 ? (
                <EmptyState title="No quantity chain yet" description="Record loading and delivery quantities first." />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Product</TH>
                        <TH align="right">Supplier</TH>
                        <TH align="right">Loaded</TH>
                        <TH align="right">Delivered</TH>
                        <TH align="right">Supplier → loaded</TH>
                        <TH align="right">Loaded → delivered</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {quantityChain.map((row) => (
                        <TR key={`${row.trip_id}-${row.product_id}`}>
                          <TD className="font-medium">{row.trip_number ?? "—"}</TD>
                          <TD>{productById.get(row.product_id)?.product_name ?? "—"}</TD>
                          <TD align="right">
                            {row.supplier_quantity === null ? "—" : formatQuantity(Number(row.supplier_quantity))}
                          </TD>
                          <TD align="right">
                            {row.loaded_quantity === null ? "—" : formatQuantity(Number(row.loaded_quantity))}
                          </TD>
                          <TD align="right">
                            {row.delivered_quantity === null ? "—" : formatQuantity(Number(row.delivered_quantity))}
                          </TD>
                          <TD align="right">
                            {row.supplier_to_loaded_variance === null
                              ? "—"
                              : formatQuantity(Number(row.supplier_to_loaded_variance))}
                          </TD>
                          <TD align="right">
                            {row.loaded_to_delivered_variance === null
                              ? "—"
                              : formatQuantity(Number(row.loaded_to_delivered_variance))}
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
            <CardHeader
              title="Tolerance rules"
              description="Optional. With no rule, items keep the status chosen by the user."
            />
            <CardBody>
              {toleranceRules.length === 0 ? (
                <EmptyState title="No tolerance rules" description="Classification stays manual until a rule is added." />
              ) : (
                <TableScroll>
                  <Table minWidth={640}>
                    <THead>
                      <TR>
                        <TH>Product</TH>
                        <TH>Basis</TH>
                        <TH align="right">Percentage</TH>
                        <TH align="right">Absolute</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {toleranceRules.map((rule) => (
                        <TR key={rule.id}>
                          <TD>{rule.product_id ? productById.get(rule.product_id)?.product_name ?? "—" : "All products"}</TD>
                          <TD className="text-xs">{rule.basis.replaceAll("_", " ")}</TD>
                          <TD align="right">{rule.percentage === null ? "—" : `${Number(rule.percentage)}%`}</TD>
                          <TD align="right">
                            {rule.absolute_quantity === null ? "—" : formatQuantity(Number(rule.absolute_quantity))}
                          </TD>
                          <TD>{canManage ? <DeleteToleranceRuleForm ruleId={rule.id} /> : "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
              {canManage ? (
                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <h3 className="text-sm font-semibold">Add tolerance rule</h3>
                  <div className="mt-3">
                    <ToleranceRuleForm products={productOptions} />
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "reconciliations" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Reconciliations" description="One reconciliation per trip. Open a row for the detail view." />
            <CardBody>
              {reconciliations.length === 0 ? (
                <EmptyState title="No reconciliations yet" description="Create one to start reconciling a trip." />
              ) : (
                <TableScroll>
                  <Table minWidth={720}>
                    <THead>
                      <TR>
                        <TH>Number</TH>
                        <TH>Trip</TH>
                        <TH>Status</TH>
                        <TH>Created</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {reconciliations.map((item) => (
                        <TR key={item.id}>
                          <TD>
                            <Link
                              href={`/workspace/reconciliation/${item.id}`}
                              className="font-medium text-[var(--brand)] hover:underline"
                            >
                              {item.reconciliation_number}
                            </Link>
                          </TD>
                          <TD>{tripById.get(item.trip_id)?.trip_number ?? "—"}</TD>
                          <TD>
                            <StatusBadge status={item.status} />
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(item.created_at).toLocaleDateString("en-GB")}
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
            <CardHeader title="Reconciliation items" description="Loaded, delivered, generated variance and optional tolerance." />
            <CardBody>
              {items.length === 0 ? (
                <EmptyState title="No items yet" description="Add an item to reconcile a product on a trip." />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Reconciliation</TH>
                        <TH>Product</TH>
                        <TH align="right">Loaded</TH>
                        <TH align="right">Delivered</TH>
                        <TH align="right">Variance</TH>
                        <TH align="right">Tolerance</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {items.map((item) => (
                        <TR key={item.id}>
                          <TD className="text-xs">
                            {reconciliationById.get(item.reconciliation_id)?.reconciliation_number ?? "—"}
                          </TD>
                          <TD>{productById.get(item.product_id)?.product_name ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(item.loaded_quantity))}</TD>
                          <TD align="right">{formatQuantity(Number(item.delivered_quantity))}</TD>
                          <TD align="right">{formatQuantity(Number(item.variance_quantity))}</TD>
                          <TD align="right">
                            {item.tolerance_quantity === null ? "—" : formatQuantity(Number(item.tolerance_quantity))}
                          </TD>
                          <TD>
                            <StatusBadge status={item.reconciliation_status} />
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
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Create reconciliation" description="Trip numbers come from Dispatch." />
                <CardBody>
                  <ReconciliationForm trips={tripOptions} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Add item" description="Product quantities are recorded as supplied." />
                <CardBody>
                  <ReconciliationItemForm
                    reconciliations={reconciliationOptions}
                    loadingRecords={loadingOptions}
                    deliveries={deliveryOptions}
                    products={productOptions}
                  />
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "discrepancies" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Discrepancies"
              description="Confirm, reject or recover against a shortage. A discrepancy is never a debt by itself."
            />
            <CardBody>
              {discrepancies.length === 0 ? (
                <EmptyState title="No discrepancies" description="Report a variance to start an investigation." />
              ) : (
                <TableScroll>
                  <Table minWidth={1040}>
                    <THead>
                      <TR>
                        <TH>Type</TH>
                        <TH>Item</TH>
                        <TH align="right">Expected</TH>
                        <TH align="right">Actual</TH>
                        <TH align="right">Variance</TH>
                        <TH>Status</TH>
                        <TH>Liability</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
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
                          <TR key={item.id}>
                            <TD className="text-xs">{item.discrepancy_type.replaceAll("_", " ")}</TD>
                            <TD className="text-xs">
                              {productById.get(itemById.get(item.reconciliation_item_id)?.product_id ?? "")?.product_name ??
                                "—"}
                            </TD>
                            <TD align="right">{formatQuantity(Number(item.expected_quantity))}</TD>
                            <TD align="right">{formatQuantity(Number(item.actual_quantity))}</TD>
                            <TD align="right">{formatQuantity(Number(item.variance))}</TD>
                            <TD>
                              <StatusBadge status={item.status} />
                            </TD>
                            <TD className="text-xs">
                              {item.liability_status === "confirmed" ? (
                                <>
                                  <span className="font-semibold">{formatMoney(Number(item.liability_amount))}</span>
                                  <span className="block text-[var(--muted)]">
                                    {item.liability_basis === "landed_cost" ? "landed cost" : "manual"} · recovered{" "}
                                    {formatMoney(recovered)}
                                    {outstanding > 0 ? ` · outstanding ${formatMoney(outstanding)}` : " · settled"}
                                  </span>
                                </>
                              ) : item.liability_status === "rejected" ? (
                                <span className="text-[var(--muted)]">rejected</span>
                              ) : (
                                <span className="text-[var(--muted)]">not assessed</span>
                              )}
                            </TD>
                            <TD>
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
              <CardHeader title="Report discrepancy" description="Expected and actual quantities are recorded as supplied." />
              <CardBody>
                <DiscrepancyForm items={itemOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "investigations" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Investigations" description="Append-only findings, responsibility and resolution." />
            <CardBody>
              {investigations.length === 0 ? (
                <EmptyState title="No investigations" description="Record findings against a discrepancy." />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Discrepancy</TH>
                        <TH>Party</TH>
                        <TH>Responsibility</TH>
                        <TH>Findings</TH>
                        <TH>Recorded</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {investigations.map((item) => (
                        <TR key={item.id}>
                          <TD className="text-xs">
                            {discrepancyById.get(item.discrepancy_id)?.discrepancy_type.replaceAll("_", " ") ?? "—"}
                          </TD>
                          <TD className="text-xs">{item.responsible_party_type ?? "—"}</TD>
                          <TD>
                            <StatusBadge status={item.responsibility_status} />
                          </TD>
                          <TD className="text-xs">{item.findings ?? "—"}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(item.created_at).toLocaleDateString("en-GB")}
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
              <CardHeader title="Record investigation" description="Findings are append-only; corrections are new records." />
              <CardBody>
                <InvestigationForm discrepancies={discrepancyOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Variance and provisional impact are evidence only. A discrepancy never becomes a driver, transporter or employee
        debt without investigation and authorised confirmation. Tolerances remain optional and open to configuration.
      </p>
    </div>
  );
}
