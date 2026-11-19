import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TFoot, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { PaymentForm } from "./forms";

export const dynamic = "force-dynamic";

type Payment = {
  id: string;
  direction: string;
  customer_id: string | null;
  supplier_id: string | null;
  transporter_id: string | null;
  sales_order_id: string | null;
  purchase_order_id: string | null;
  transporter_invoice_id: string | null;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  status: string;
};

type Profitability = {
  sales_order_id: string;
  order_number: string;
  order_status: string;
  revenue: number;
  cost_of_sales: number;
  gross_margin: number;
  receipts: number;
};

type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };
type Transporter = { id: string; business_name: string; status: string };
type SalesOrder = { id: string; order_number: string };
type PurchaseOrder = { id: string; po_number: string };
type TransporterInvoice = { id: string; invoice_number: string };

const TABS = ["payments", "profitability"] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const canViewSales = can("sales.view");
  const canManageSales = can("sales.manage");
  const canViewProcurement = can("procurement.view");
  const canManageProcurement = can("procurement.manage");

  const canView = Boolean(canViewSales || canManageSales || canViewProcurement || canManageProcurement);

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Money" title="Not authorised" description="You cannot view finance records." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "payments";

  const [
    paymentsResult,
    profitabilityResult,
    customersResult,
    suppliersResult,
    transportersResult,
    salesOrdersResult,
    purchaseOrdersResult,
    transporterInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, direction, customer_id, supplier_id, transporter_id, sales_order_id, purchase_order_id, transporter_invoice_id, amount, method, reference, paid_at, status",
      )
      .order("paid_at", { ascending: false })
      .limit(50),
    supabase
      .from("sales_order_profitability")
      .select("sales_order_id, order_number, order_status, revenue, cost_of_sales, gross_margin, receipts")
      .order("order_number", { ascending: false })
      .limit(50),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("transporters").select("id, business_name, status").order("business_name"),
    supabase.from("sales_orders").select("id, order_number").order("order_date", { ascending: false }).limit(40),
    supabase.from("purchase_orders").select("id, po_number").order("order_date", { ascending: false }).limit(40),
    supabase
      .from("transporter_invoices")
      .select("id, invoice_number")
      .order("invoice_date", { ascending: false })
      .limit(40),
  ]);

  const queryError =
    paymentsResult.error ??
    profitabilityResult.error ??
    customersResult.error ??
    suppliersResult.error ??
    transportersResult.error ??
    salesOrdersResult.error ??
    purchaseOrdersResult.error ??
    transporterInvoicesResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Money" title="Unavailable" description="Finance records could not be loaded." />
      </div>
    );
  }

  const payments = (paymentsResult.data ?? []) as Payment[];
  const profitability = (profitabilityResult.data ?? []) as Profitability[];
  const customers = (customersResult.data ?? []) as Customer[];
  const suppliers = (suppliersResult.data ?? []) as Supplier[];
  const transporters = (transportersResult.data ?? []) as Transporter[];
  const salesOrders = (salesOrdersResult.data ?? []) as SalesOrder[];
  const purchaseOrders = (purchaseOrdersResult.data ?? []) as PurchaseOrder[];
  const transporterInvoices = (transporterInvoicesResult.data ?? []) as TransporterInvoice[];

  const customerById = new Map(customers.map((item) => [item.id, item]));
  const supplierById = new Map(suppliers.map((item) => [item.id, item]));
  const transporterById = new Map(transporters.map((item) => [item.id, item]));
  const salesOrderById = new Map(salesOrders.map((item) => [item.id, item]));
  const purchaseOrderById = new Map(purchaseOrders.map((item) => [item.id, item]));
  const transporterInvoiceById = new Map(transporterInvoices.map((item) => [item.id, item]));

  const receipts = payments.filter((payment) => payment.direction === "receipt");
  const outgoings = payments.filter((payment) => payment.direction === "payment");
  const recordedReceipts = receipts.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const recordedPayments = outgoings.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const netRecorded = recordedReceipts - recordedPayments;

  const totalRevenue = profitability.reduce((sum, row) => sum + Number(row.revenue), 0);
  const totalCost = profitability.reduce((sum, row) => sum + Number(row.cost_of_sales), 0);
  const totalMargin = profitability.reduce((sum, row) => sum + Number(row.gross_margin), 0);
  const totalReceipted = profitability.reduce((sum, row) => sum + Number(row.receipts), 0);
  const blendedMargin = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : null;

  const directions: Array<"receipt" | "payment"> = [];
  if (canManageSales) directions.push("receipt");
  if (canManageProcurement) directions.push("payment");

  const tabs = [
    { href: "/workspace/finance?tab=payments", label: "Payments", count: payments.length },
    { href: "/workspace/finance?tab=profitability", label: "Profitability", count: profitability.length },
  ];
  const activeHref = `/workspace/finance?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title={tenant.organisationName}
        description="Recorded money in and out, and operational margin from order revenue against FIFO cost of sales."
        actions={
          <>
            <ButtonLink href="/workspace/transport-invoices">Transporter invoices</ButtonLink>
            <ButtonLink href="/workspace/sales">Sales</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receipts"
          value={formatMoney(recordedReceipts)}
          hint={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}
          tone="brand"
        />
        <StatCard
          label="Payments"
          value={formatMoney(recordedPayments)}
          hint={`${outgoings.length} payment${outgoings.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Net recorded"
          value={formatMoney(netRecorded)}
          hint="Receipts less payments"
          tone={netRecorded < 0 ? "danger" : "accent"}
        />
        <StatCard
          label="Operating margin"
          value={formatMoney(totalMargin)}
          hint={blendedMargin === null ? "No revenue recorded" : `${formatPercent(blendedMargin)} of revenue`}
          tone={totalMargin < 0 ? "danger" : "accent"}
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "payments" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Payments and receipts"
              description="Recorded as supplied, with explicit links to an order or transporter invoice. No automatic matching."
            />
            <CardBody>
              {payments.length === 0 ? (
                <EmptyState title="No payments recorded" description="Record the first receipt or payment below." />
              ) : (
                <TableScroll>
                  <Table minWidth={1000}>
                    <THead>
                      <TR>
                        <TH>Date</TH>
                        <TH>Direction</TH>
                        <TH>Party</TH>
                        <TH>Linked to</TH>
                        <TH>Method</TH>
                        <TH>Reference</TH>
                        <TH>Status</TH>
                        <TH align="right">Amount</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {payments.map((payment) => {
                        const customer = payment.customer_id ? customerById.get(payment.customer_id) : undefined;
                        const supplier = payment.supplier_id ? supplierById.get(payment.supplier_id) : undefined;
                        const transporter = payment.transporter_id
                          ? transporterById.get(payment.transporter_id)
                          : undefined;

                        const party = customer?.name ?? supplier?.name ?? transporter?.business_name ?? "—";
                        const partyType = customer
                          ? "Customer"
                          : supplier
                            ? "Supplier"
                            : transporter
                              ? "Transporter"
                              : null;

                        const link =
                          (payment.sales_order_id
                            ? salesOrderById.get(payment.sales_order_id)?.order_number
                            : null) ??
                          (payment.purchase_order_id
                            ? purchaseOrderById.get(payment.purchase_order_id)?.po_number
                            : null) ??
                          (payment.transporter_invoice_id
                            ? transporterInvoiceById.get(payment.transporter_invoice_id)?.invoice_number
                            : null) ??
                          null;

                        return (
                          <TR key={payment.id}>
                            <TD className="text-xs text-[var(--muted)]">
                              {new Date(payment.paid_at).toLocaleDateString("en-GB")}
                            </TD>
                            <TD>
                              <Badge tone={payment.direction === "receipt" ? "success" : "warning"}>
                                {payment.direction}
                              </Badge>
                            </TD>
                            <TD>
                              {party}
                              {partyType ? (
                                <span className="block text-xs text-[var(--muted)]">{partyType}</span>
                              ) : null}
                            </TD>
                            <TD className="text-xs">{link ?? <span className="text-[var(--muted)]">—</span>}</TD>
                            <TD className="text-xs capitalize">{payment.method.replaceAll("_", " ")}</TD>
                            <TD className="text-xs text-[var(--muted)]">{payment.reference ?? "—"}</TD>
                            <TD>
                              <StatusBadge status={payment.status} />
                            </TD>
                            <TD align="right">
                              <span
                                className={
                                  payment.direction === "receipt" ? "text-[var(--success)]" : "text-[var(--ink)]"
                                }
                              >
                                {formatMoney(Number(payment.amount))}
                              </span>
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

          {directions.length > 0 ? (
            <Card>
              <CardHeader
                title="Record payment"
                description="A receipt needs sales management permission; a supplier or transporter payment needs procurement management permission."
              />
              <CardBody>
                <PaymentForm
                  directions={directions}
                  customers={customers.map((item) => ({ id: item.id, label: item.name }))}
                  suppliers={suppliers.map((item) => ({ id: item.id, label: item.name }))}
                  transporters={transporters
                    .filter((item) => item.status === "active")
                    .map((item) => ({ id: item.id, label: item.business_name }))}
                  salesOrders={salesOrders.map((item) => ({ id: item.id, label: item.order_number }))}
                  purchaseOrders={purchaseOrders.map((item) => ({ id: item.id, label: item.po_number }))}
                  transporterInvoices={transporterInvoices.map((item) => ({
                    id: item.id,
                    label: item.invoice_number,
                  }))}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "profitability" ? (
        <Card>
          <CardHeader
            title="Operational profitability"
            description="Order revenue minus net FIFO cost of sales. Excludes overheads and is not statutory profit."
          />
          <CardBody>
            {profitability.length === 0 ? (
              <EmptyState title="No sales orders yet" description="Profitability appears once an order is confirmed." />
            ) : (
              <TableScroll>
                <Table minWidth={940}>
                  <THead>
                    <TR>
                      <TH>Order</TH>
                      <TH>Status</TH>
                      <TH align="right">Revenue</TH>
                      <TH align="right">Cost of sales</TH>
                      <TH align="right">Gross margin</TH>
                      <TH align="right">Margin %</TH>
                      <TH align="right">Receipts</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {profitability.map((row) => {
                      const revenue = Number(row.revenue);
                      const margin = Number(row.gross_margin);
                      const marginPercent = revenue > 0 ? (margin / revenue) * 100 : null;

                      return (
                        <TR key={row.sales_order_id}>
                          <TD className="font-medium">{row.order_number}</TD>
                          <TD>
                            <StatusBadge status={row.order_status} />
                          </TD>
                          <TD align="right">{formatMoney(revenue)}</TD>
                          <TD align="right">{formatMoney(Number(row.cost_of_sales))}</TD>
                          <TD align="right">
                            <span className={margin < 0 ? "text-[var(--danger)]" : ""}>{formatMoney(margin)}</span>
                          </TD>
                          <TD align="right" className="text-xs text-[var(--muted)]">
                            {marginPercent === null ? "—" : formatPercent(marginPercent)}
                          </TD>
                          <TD align="right">{formatMoney(Number(row.receipts))}</TD>
                        </TR>
                      );
                    })}
                  </TBody>
                  <TFoot>
                    <TR>
                      <TD>Total</TD>
                      <TD className="text-xs text-[var(--muted)]">
                        {profitability.length} order{profitability.length === 1 ? "" : "s"}
                      </TD>
                      <TD align="right">{formatMoney(totalRevenue)}</TD>
                      <TD align="right">{formatMoney(totalCost)}</TD>
                      <TD align="right">
                        <span className={totalMargin < 0 ? "text-[var(--danger)]" : ""}>
                          {formatMoney(totalMargin)}
                        </span>
                      </TD>
                      <TD align="right" className="text-xs text-[var(--muted)]">
                        {blendedMargin === null ? "—" : formatPercent(blendedMargin)}
                      </TD>
                      <TD align="right">{formatMoney(totalReceipted)}</TD>
                    </TR>
                  </TFoot>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Records are append-only. There is no automatic allocation, ageing, write-off, tax or journal posting; those
        rules remain open. Gross margin is operational evidence, not an audited result.
      </p>
    </div>
  );
}
