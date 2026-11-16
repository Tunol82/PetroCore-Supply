import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { LiabilityForm, RecoveryForm, RejectLiabilityForm } from "../forms";

export const dynamic = "force-dynamic";

type Reconciliation = {
  id: string;
  trip_id: string;
  reconciliation_number: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type Item = {
  id: string;
  reconciliation_id: string;
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

type Recovery = { id: string; discrepancy_id: string; amount: number };
type Product = { id: string; product_name: string };
type Invoice = { id: string; invoice_number: string; trip_id: string | null };

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function ReconciliationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;

  const { data: reconciliationData } = await supabase
    .from("trip_reconciliations")
    .select("id, trip_id, reconciliation_number, status, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!reconciliationData) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Reconciliation · Detail" title="Reconciliation not found" />
        <EmptyState
          title="That reconciliation is not available"
          description="It may belong to another company, or the identifier is wrong."
          action={<ButtonLink href="/workspace/reconciliation?tab=reconciliations">Back to reconciliations</ButtonLink>}
        />
      </div>
    );
  }

  const reconciliation = reconciliationData as Reconciliation;

  const [tripResult, itemsResult, productsResult, invoicesResult] = await Promise.all([
    supabase.from("trips").select("trip_number").eq("id", reconciliation.trip_id).maybeSingle(),
    supabase
      .from("trip_reconciliation_items")
      .select(
        "id, reconciliation_id, product_id, loaded_quantity, delivered_quantity, variance_quantity, tolerance_quantity, reconciliation_status",
      )
      .eq("reconciliation_id", reconciliation.id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("transporter_invoices")
      .select("id, invoice_number, trip_id")
      .eq("trip_id", reconciliation.trip_id)
      .order("invoice_date", { ascending: false }),
  ]);

  const tripNumber = tripResult.data?.trip_number ?? "Trip";
  const items = (itemsResult.data ?? []) as Item[];
  const products = (productsResult.data ?? []) as Product[];
  const invoiceOptions = ((invoicesResult.data ?? []) as Invoice[]).map((invoice) => ({
    id: invoice.id,
    label: invoice.invoice_number,
  }));
  const productById = new Map(products.map((product) => [product.id, product]));

  const itemIds = items.map((item) => item.id);
  const discrepanciesResult =
    itemIds.length > 0
      ? await supabase
          .from("delivery_discrepancies")
          .select(
            "id, reconciliation_item_id, discrepancy_type, expected_quantity, actual_quantity, variance, status, liability_status, liability_basis, liability_unit_cost, liability_amount",
          )
          .in("reconciliation_item_id", itemIds)
          .order("created_at", { ascending: true })
      : { data: [] as Discrepancy[] };

  const discrepancies = (discrepanciesResult.data ?? []) as Discrepancy[];
  const discrepancyIds = discrepancies.map((discrepancy) => discrepancy.id);

  const [investigationsResult, recoveriesResult] = await Promise.all([
    discrepancyIds.length > 0
      ? supabase
          .from("discrepancy_investigations")
          .select("id, discrepancy_id, responsible_party_type, responsibility_status, findings, created_at")
          .in("discrepancy_id", discrepancyIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Investigation[] }),
    discrepancyIds.length > 0
      ? supabase
          .from("transporter_recoveries")
          .select("id, discrepancy_id, amount")
          .in("discrepancy_id", discrepancyIds)
      : Promise.resolve({ data: [] as Recovery[] }),
  ]);

  const investigations = (investigationsResult.data ?? []) as Investigation[];
  const recoveries = (recoveriesResult.data ?? []) as Recovery[];

  const totalVariance = items.reduce((sum, item) => sum + Math.abs(Number(item.variance_quantity)), 0);
  const confirmedLiability = discrepancies
    .filter((discrepancy) => discrepancy.liability_status === "confirmed")
    .reduce((sum, discrepancy) => sum + Number(discrepancy.liability_amount ?? 0), 0);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reconciliation · Detail"
        title={`${reconciliation.reconciliation_number} · ${tripNumber}`}
        description={`Created ${new Date(reconciliation.created_at).toLocaleDateString("en-GB")}${
          reconciliation.notes ? ` · ${reconciliation.notes}` : ""
        }`}
        actions={
          <>
            <StatusBadge status={reconciliation.status} />
            <ButtonLink href="/workspace/reconciliation?tab=reconciliations">All reconciliations</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items" value={items.length} hint="Products reconciled" />
        <StatCard label="Total variance" value={formatQuantity(totalVariance)} hint="Absolute, all products" />
        <StatCard label="Discrepancies" value={discrepancies.length} hint={`${investigations.length} investigations`} />
        <StatCard label="Confirmed liability" value={formatMoney(confirmedLiability)} hint="At landed cost" tone="danger" />
      </div>

      <Card>
        <CardHeader title="Items" description="Loaded, delivered and the generated variance." />
        <CardBody>
          {items.length === 0 ? (
            <EmptyState
              title="No items"
              description="Add an item from the Reconciliations tab to record quantities."
            />
          ) : (
            <TableScroll>
              <Table minWidth={760}>
                <THead>
                  <TR>
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

      <Card>
        <CardHeader title="Discrepancies" description="Confirm at landed cost, reject with a reason, or record a recovery." />
        <CardBody>
          {discrepancies.length === 0 ? (
            <EmptyState title="No discrepancies" description="Report one from the Discrepancies tab." />
          ) : (
            <TableScroll>
              <Table minWidth={980}>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Product</TH>
                    <TH align="right">Expected</TH>
                    <TH align="right">Actual</TH>
                    <TH align="right">Variance</TH>
                    <TH>Liability</TH>
                    <TH>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {discrepancies.map((discrepancy) => {
                    const recovered = recoveries
                      .filter((recovery) => recovery.discrepancy_id === discrepancy.id)
                      .reduce((sum, recovery) => sum + Number(recovery.amount), 0);
                    const outstanding = Number(discrepancy.liability_amount ?? 0) - recovered;

                    return (
                      <TR key={discrepancy.id}>
                        <TD className="text-xs">{discrepancy.discrepancy_type.replaceAll("_", " ")}</TD>
                        <TD>
                          {productById.get(itemById.get(discrepancy.reconciliation_item_id)?.product_id ?? "")?.product_name ??
                            "—"}
                        </TD>
                        <TD align="right">{formatQuantity(Number(discrepancy.expected_quantity))}</TD>
                        <TD align="right">{formatQuantity(Number(discrepancy.actual_quantity))}</TD>
                        <TD align="right">{formatQuantity(Number(discrepancy.variance))}</TD>
                        <TD className="text-xs">
                          {discrepancy.liability_status === "confirmed" ? (
                            <>
                              <span className="font-semibold">{formatMoney(Number(discrepancy.liability_amount))}</span>
                              <span className="block text-[var(--muted)]">
                                {discrepancy.liability_basis === "landed_cost" ? "landed cost" : "manual"} · recovered{" "}
                                {formatMoney(recovered)}
                                {outstanding > 0 ? ` · outstanding ${formatMoney(outstanding)}` : " · settled"}
                              </span>
                            </>
                          ) : discrepancy.liability_status === "rejected" ? (
                            <span className="text-[var(--muted)]">rejected</span>
                          ) : (
                            <span className="text-[var(--muted)]">not assessed</span>
                          )}
                        </TD>
                        <TD>
                          {canManage && discrepancy.liability_status === "not_assessed" ? (
                            <div className="space-y-2">
                              <LiabilityForm discrepancyId={discrepancy.id} invoices={invoiceOptions} />
                              <RejectLiabilityForm discrepancyId={discrepancy.id} />
                            </div>
                          ) : canManage && discrepancy.liability_status === "confirmed" && outstanding > 0 ? (
                            <RecoveryForm
                              discrepancyId={discrepancy.id}
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

      <Card>
        <CardHeader title="Investigations" description="Findings recorded against this reconciliation's discrepancies." />
        <CardBody>
          {investigations.length === 0 ? (
            <EmptyState title="No investigations" description="Record findings from the Investigations tab." />
          ) : (
            <TableScroll>
              <Table minWidth={720}>
                <THead>
                  <TR>
                    <TH>Party</TH>
                    <TH>Responsibility</TH>
                    <TH>Findings</TH>
                    <TH>Recorded</TH>
                  </TR>
                </THead>
                <TBody>
                  {investigations.map((investigation) => (
                    <TR key={investigation.id}>
                      <TD className="text-xs">{investigation.responsible_party_type ?? "—"}</TD>
                      <TD>
                        <StatusBadge status={investigation.responsibility_status} />
                      </TD>
                      <TD className="text-xs">{investigation.findings ?? "—"}</TD>
                      <TD className="text-xs text-[var(--muted)]">
                        {new Date(investigation.created_at).toLocaleDateString("en-GB")}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </CardBody>
      </Card>

      <p className="text-xs leading-6 text-[var(--muted)]">
        Variance is evidence. Liability is only created by an authorised confirmation, and every recovery is recorded
        separately.
      </p>
    </div>
  );
}
