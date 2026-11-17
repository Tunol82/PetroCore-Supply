import { notFound, redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { BrandMark } from "@/components/shell/brand-mark";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const dynamic = "force-dynamic";

type Invoice = {
  id: string;
  transporter_id: string;
  trip_id: string | null;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  liability_status: string;
  notes: string | null;
};

type InvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  line_total: number;
  charge_category: string | null;
};

type Transporter = {
  id: string;
  transporter_code: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
};

type Trip = { id: string; trip_number: string };

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

export default async function TransporterInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
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
    redirect("/workspace/transport-invoices");
  }

  const { data: invoiceData, error: invoiceError } = await supabase
    .from("transporter_invoices")
    .select(
      "id, transporter_id, trip_id, invoice_number, invoice_date, currency, subtotal, tax_amount, total_amount, liability_status, notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (invoiceError || !invoiceData) {
    notFound();
  }

  const invoice = invoiceData as Invoice;

  const [linesResult, transporterResult, tripResult] = await Promise.all([
    supabase
      .from("transporter_invoice_lines")
      .select("id, description, quantity, unit_rate, line_total, charge_category")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transporters")
      .select(
        "id, transporter_code, business_name, contact_person, phone, email, address, payment_terms",
      )
      .eq("id", invoice.transporter_id)
      .maybeSingle(),
    invoice.trip_id
      ? supabase.from("trips").select("id, trip_number").eq("id", invoice.trip_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const lines = (linesResult.data ?? []) as InvoiceLine[];
  const transporter = (transporterResult.data ?? null) as Transporter | null;
  const trip = (tripResult.data ?? null) as Trip | null;

  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  return (
    <div>
      <PrintToolbar
        title={`Invoice ${invoice.invoice_number}`}
        backHref="/workspace/transport-invoices"
        backLabel="Transporter invoices"
      />

      <article className="print-sheet mx-auto my-6 max-w-[860px] bg-white p-10 shadow-[var(--shadow)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <h1 className="sr-only">
          Transporter invoice {invoice.invoice_number} from {transporter?.business_name ?? "transporter"}
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
              Transporter invoice
            </p>
            <p className="mono mt-1 text-xl font-semibold">{invoice.invoice_number}</p>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Dated {new Date(invoice.invoice_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-[var(--line)] py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Invoice from
            </p>
            <p className="mt-1 text-[15px] font-semibold">{transporter?.business_name ?? "—"}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">{transporter?.address ?? "No address recorded"}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
              {[transporter?.contact_person, transporter?.phone, transporter?.email].filter(Boolean).join(" · ") ||
                "No contact recorded"}
            </p>
            {transporter ? (
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                {transporter.transporter_code}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Invoice details
            </p>
            <dl className="mt-1 space-y-0.5 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Trip</dt>
                <dd className="font-medium">{trip?.trip_number ?? "Not linked"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Currency</dt>
                <dd className="font-medium">{invoice.currency}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Payment terms</dt>
                <dd className="font-medium">{transporter?.payment_terms ?? "Not recorded"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Liability</dt>
                <dd className="font-medium capitalize">{invoice.liability_status.replaceAll("_", " ")}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="py-5">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                <th className="pb-2 pr-4 font-semibold">Description</th>
                <th className="pb-2 pr-4 font-semibold">Category</th>
                <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
                <th className="pb-2 pr-4 text-right font-semibold">Unit rate</th>
                <th className="pb-2 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-[12px] text-[var(--muted)]">
                    No charge lines recorded on this invoice.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="border-b border-[var(--line)]">
                    <td className="py-2.5 pr-4 font-medium">{line.description}</td>
                    <td className="py-2.5 pr-4 text-[12px] capitalize text-[var(--muted)]">
                      {line.charge_category ? line.charge_category.replaceAll("_", " ") : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular">{formatQuantity(Number(line.quantity))}</td>
                    <td className="py-2.5 pr-4 text-right tabular">{formatMoney(Number(line.unit_rate))}</td>
                    <td className="py-2.5 text-right tabular">{formatMoney(Number(line.line_total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="flex justify-end border-t border-[var(--line)] py-5">
          <dl className="w-full max-w-[280px] space-y-1 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Subtotal</dt>
              <dd className="tabular">{formatMoney(Number(invoice.subtotal))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Tax</dt>
              <dd className="tabular">{formatMoney(Number(invoice.tax_amount))}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-[var(--line)] pt-2 text-[15px] font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(Number(invoice.total_amount))}</dd>
            </div>
          </dl>
        </section>

        {invoice.notes ? (
          <section className="border-t border-[var(--line)] py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Notes</p>
            <p className="mt-1 text-[12px]">{invoice.notes}</p>
          </section>
        ) : null}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--muted)]">
          <p>
            Generated {generatedAt} · Invoice {invoice.id.slice(0, 8).toUpperCase()}
          </p>
          <p>
            Recorded as submitted. Liability and deductions are unassessed; this copy is not a payable approval.
          </p>
        </footer>
      </article>
    </div>
  );
}
