import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { InvoiceLineForm, TransporterInvoiceForm } from "./forms";

export const dynamic = "force-dynamic";

type Invoice = {
  id: string;
  transporter_id: string;
  trip_id: string | null;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  liability_status: string;
  recorded_at: string;
};

type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  line_total: number;
  charge_category: string | null;
};

type Transporter = { id: string; business_name: string; transporter_code: string };
type Trip = { id: string; trip_number: string };

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);
}

export default async function TransportInvoicesPage() {
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
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view transporter invoices.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const [invoicesResult, linesResult, transportersResult, tripsResult] = await Promise.all([
    supabase
      .from("transporter_invoices")
      .select(
        "id, transporter_id, trip_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, liability_status, recorded_at",
      )
      .order("invoice_date", { ascending: false })
      .limit(30),
    supabase
      .from("transporter_invoice_lines")
      .select("id, invoice_id, description, quantity, unit_rate, line_total, charge_category")
      .order("created_at", { ascending: true })
      .limit(80),
    supabase.from("transporters").select("id, business_name, transporter_code").order("business_name"),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(40),
  ]);

  const queryError =
    invoicesResult.error ?? linesResult.error ?? transportersResult.error ?? tripsResult.error;

  if (queryError) {
    return (
      <div>
        <div className="space-y-6">
<section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Invoices could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed. Try again.</p>
          </section>
        </div>
      </div>
    );
  }

  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const lines = (linesResult.data ?? []) as InvoiceLine[];
  const transporters = (transportersResult.data ?? []) as Transporter[];
  const trips = (tripsResult.data ?? []) as Trip[];

  const transporterById = new Map(transporters.map((item) => [item.id, item]));
  const tripById = new Map(trips.map((item) => [item.id, item]));
  const invoiceById = new Map(invoices.map((item) => [item.id, item]));

  const totalRecorded = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const linesByInvoice = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const current = linesByInvoice.get(line.invoice_id) ?? [];
    current.push(line);
    linesByInvoice.set(line.invoice_id, current);
  }

  return (
    <div>
      <div className="space-y-6">
<section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Transporter invoices</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Invoices recorded exactly as submitted. Liability and deductions remain unassessed (DR-13).
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Invoices</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{invoices.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Recorded value</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(totalRecorded)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Liability assessed</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">0</p>
            <p className="mt-1 text-xs text-[var(--muted)]">DR-13 open</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Transporter</th>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Subtotal</th>
                  <th className="py-2 pr-3 text-right">Tax</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2">Liability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-2 pr-3 font-medium">{invoice.invoice_number}</td>
                    <td className="py-2 pr-3">
                      {transporterById.get(invoice.transporter_id)?.business_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {invoice.trip_id ? tripById.get(invoice.trip_id)?.trip_number ?? "—" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {new Date(invoice.invoice_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(invoice.subtotal))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(invoice.tax_amount))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(invoice.total_amount))}</td>
                    <td className="py-2 text-xs">{invoice.liability_status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoices.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No transporter invoices recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record invoice</h3>
              <div className="mt-3">
                <TransporterInvoiceForm
                  transporters={transporters.map((item) => ({
                    id: item.id,
                    label: `${item.transporter_code} · ${item.business_name}`,
                  }))}
                  trips={trips.map((item) => ({ id: item.id, label: item.trip_number }))}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Invoice lines</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3 text-right">Quantity</th>
                  <th className="py-2 pr-3 text-right">Unit rate</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-3 text-xs">{invoiceById.get(line.invoice_id)?.invoice_number ?? "—"}</td>
                    <td className="py-2 pr-3">{line.description}</td>
                    <td className="py-2 pr-3 text-xs">
                      {line.charge_category ? line.charge_category.replaceAll("_", " ") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(Number(line.quantity))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(line.unit_rate))}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(Number(line.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No invoice lines recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Add invoice line</h3>
              {invoices.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">Record an invoice before adding lines.</p>
              ) : (
                <div className="mt-3">
                  <InvoiceLineForm
                    invoices={invoices.map((invoice) => ({
                      id: invoice.id,
                      label: `${invoice.invoice_number} · ${
                        transporterById.get(invoice.transporter_id)?.business_name ?? "transporter"
                      }`,
                    }))}
                  />
                </div>
              )}
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Invoices are append-only evidence. Nothing here creates a payable, a payment, a deduction from a driver or
          transporter, or a loss. Those rules await DR-13.
        </p>
      </div>
    </div>
  );
}

