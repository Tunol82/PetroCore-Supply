import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
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
type Transporter = { id: string; business_name: string };
type SalesOrder = { id: string; order_number: string };
type PurchaseOrder = { id: string; po_number: string };
type TransporterInvoice = { id: string; invoice_number: string };

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function FinancePage() {
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

  const [
    { data: canViewSales },
    { data: canManageSales },
    { data: canViewProcurement },
    { data: canManageProcurement },
  ] = await Promise.all([
    supabase.rpc("has_permission", { p_permission_key: "sales.view" }),
    supabase.rpc("has_permission", { p_permission_key: "sales.manage" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.view" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.manage" }),
  ]);

  const canView = Boolean(canViewSales || canManageSales || canViewProcurement || canManageProcurement);

  if (!canView) {
    return (
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view finance records.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </div>
    );
  }

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
      .limit(40),
    supabase
      .from("sales_order_profitability")
      .select("sales_order_id, order_number, order_status, revenue, cost_of_sales, gross_margin, receipts")
      .order("order_number", { ascending: false })
      .limit(30),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("transporters").select("id, business_name").order("business_name"),
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
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Finance records could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed. Try again.</p>
          </section>
        </div>
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

  const recordedReceipts = payments
    .filter((payment) => payment.direction === "receipt")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const recordedPayments = payments
    .filter((payment) => payment.direction === "payment")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const canRecordReceipt = Boolean(canManageSales);
  const canRecordPayment = Boolean(canManageProcurement);

  return (
    <div>
      <div className="space-y-6">
<section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Finance</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Recorded money in and out, and operational margin from order revenue against FIFO cost of sales.
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Receipts</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(recordedReceipts)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Payments</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(recordedPayments)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Net recorded</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(recordedReceipts - recordedPayments)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Payments and receipts</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Direction</th>
                  <th className="py-2 pr-3">Party</th>
                  <th className="py-2 pr-3">Link</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {payments.map((payment) => {
                  const party =
                    customerById.get(payment.customer_id ?? "")?.name ??
                    supplierById.get(payment.supplier_id ?? "")?.name ??
                    transporterById.get(payment.transporter_id ?? "")?.business_name ??
                    "—";
                  const link =
                    salesOrderById.get(payment.sales_order_id ?? "")?.order_number ??
                    purchaseOrderById.get(payment.purchase_order_id ?? "")?.po_number ??
                    payment.transporter_invoice_id ??
                    null;

                  return (
                    <tr key={payment.id}>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(payment.paid_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {payment.direction === "receipt" ? "Receipt" : "Payment"}
                      </td>
                      <td className="py-2 pr-3">{party}</td>
                      <td className="py-2 pr-3 text-xs">{link ? "linked" : "—"}</td>
                      <td className="py-2 pr-3 text-xs">{payment.method.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-xs">{payment.reference ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(Number(payment.amount))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payments.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No payments recorded yet.</p>
            ) : null}
          </div>

          {canRecordReceipt || canRecordPayment ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record payment</h3>
              <div className="mt-3">
                <PaymentForm
                  customers={customers.map((item) => ({ id: item.id, label: item.name }))}
                  suppliers={suppliers.map((item) => ({ id: item.id, label: item.name }))}
                  transporters={transporters.map((item) => ({ id: item.id, label: item.business_name }))}
                  salesOrders={salesOrders.map((item) => ({ id: item.id, label: item.order_number }))}
                  purchaseOrders={purchaseOrders.map((item) => ({ id: item.id, label: item.po_number }))}
                  transporterInvoices={transporterInvoices.map((item) => ({
                    id: item.id,
                    label: item.invoice_number,
                  }))}
                />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Recording a receipt needs sales management permission; a payment needs procurement management
                permission.
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Operational profitability</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Order revenue minus net FIFO cost of sales. Excludes overheads, and is not statutory profit.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Revenue</th>
                  <th className="py-2 pr-3 text-right">Cost of sales</th>
                  <th className="py-2 pr-3 text-right">Gross margin</th>
                  <th className="py-2 text-right">Receipts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {profitability.map((row) => (
                  <tr key={row.sales_order_id}>
                    <td className="py-2 pr-3 font-medium">{row.order_number}</td>
                    <td className="py-2 pr-3 text-xs">{row.order_status}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(row.revenue))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(row.cost_of_sales))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(row.gross_margin))}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(Number(row.receipts))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {profitability.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No sales orders yet.</p>
            ) : null}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Records are append-only. There is no automatic allocation, ageing, write-off, tax or journal posting; those
          rules remain open. Gross margin is operational evidence, not an audited result.
        </p>
      </div>
    </div>
  );
}

