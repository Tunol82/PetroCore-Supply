import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
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

type Transporter = { id: string; business_name: string; transporter_code: string; status: string };
type Trip = { id: string; trip_number: string };

const TABS = ["invoices", "lines"] as const;

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

export default async function TransportInvoicesPage({
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

  const canView = can("transport.view");
  const canManage = can("transport.manage");

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Haulage bills"
          title="Not authorised"
          description="You cannot view transporter invoices."
        />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "invoices";

  const [invoicesResult, linesResult, transportersResult, tripsResult, categoriesResult] = await Promise.all([
    supabase
      .from("transporter_invoices")
      .select(
        "id, transporter_id, trip_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, liability_status, recorded_at",
      )
      .order("invoice_date", { ascending: false })
      .limit(50),
    supabase
      .from("transporter_invoice_lines")
      .select("id, invoice_id, description, quantity, unit_rate, line_total, charge_category")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("transporters")
      .select("id, business_name, transporter_code, status")
      .order("business_name"),
    supabase.from("trips").select("id, trip_number").order("created_at", { ascending: false }).limit(40),
    supabase
      .from("transporter_charge_categories")
      .select("code, label")
      .eq("active", true)
      .order("sort_order")
      .order("label"),
  ]);

  const queryError =
    invoicesResult.error ?? linesResult.error ?? transportersResult.error ?? tripsResult.error ?? categoriesResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Haulage bills" title="Unavailable" description="Invoices could not be loaded." />
      </div>
    );
  }

  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const lines = (linesResult.data ?? []) as InvoiceLine[];
  const transporters = (transportersResult.data ?? []) as Transporter[];
  const trips = (tripsResult.data ?? []) as Trip[];
  const chargeCategories = ((categoriesResult.data ?? []) as { code: string; label: string }[]).map(
    (category) => ({ id: category.code, label: category.label }),
  );

  const transporterById = new Map(transporters.map((item) => [item.id, item]));
  const tripById = new Map(trips.map((item) => [item.id, item]));
  const invoiceById = new Map(invoices.map((item) => [item.id, item]));

  const linesByInvoice = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const current = linesByInvoice.get(line.invoice_id) ?? [];
    current.push(line);
    linesByInvoice.set(line.invoice_id, current);
  }

  const totalRecorded = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const totalTax = invoices.reduce((sum, invoice) => sum + Number(invoice.tax_amount), 0);
  const awaitingAssessment = invoices.filter((invoice) => invoice.liability_status === "not_assessed").length;

  const tabs = [
    { href: "/workspace/transport-invoices?tab=invoices", label: "Invoices", count: invoices.length },
    { href: "/workspace/transport-invoices?tab=lines", label: "Invoice lines", count: lines.length },
  ];
  const activeHref = `/workspace/transport-invoices?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Haulage bills"
        title={tenant.organisationName}
        description="Invoices recorded exactly as submitted. Liability and deductions remain unassessed until DR-13 is approved."
        actions={<ButtonLink href="/workspace/finance">Payments</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoices" value={invoices.length} hint={`${lines.length} line${lines.length === 1 ? "" : "s"}`} tone="brand" />
        <StatCard label="Recorded value" value={formatMoney(totalRecorded)} hint="Including tax as submitted" />
        <StatCard label="Tax recorded" value={formatMoney(totalTax)} hint="As stated on the invoice" />
        <StatCard
          label="Awaiting assessment"
          value={awaitingAssessment}
          hint="DR-13 open: no liability or deductions"
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "invoices" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Invoices"
              description="Subtotal and tax are recorded as submitted; the total is not recomputed here."
            />
            <CardBody>
              {invoices.length === 0 ? (
                <EmptyState title="No transporter invoices" description="Record the first invoice below." />
              ) : (
                <TableScroll>
                  <Table minWidth={980}>
                    <THead>
                      <TR>
                        <TH>Number</TH>
                        <TH>Transporter</TH>
                        <TH>Trip</TH>
                        <TH>Date</TH>
                        <TH align="right">Subtotal</TH>
                        <TH align="right">Tax</TH>
                        <TH align="right">Total</TH>
                        <TH align="right">Lines</TH>
                        <TH>Liability</TH>
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
                          <TD className="text-xs">{invoice.trip_id ? tripById.get(invoice.trip_id)?.trip_number ?? "—" : "—"}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(invoice.invoice_date).toLocaleDateString("en-GB")}
                          </TD>
                          <TD align="right">{formatMoney(Number(invoice.subtotal))}</TD>
                          <TD align="right">{formatMoney(Number(invoice.tax_amount))}</TD>
                          <TD align="right">{formatMoney(Number(invoice.total_amount))}</TD>
                          <TD align="right">{(linesByInvoice.get(invoice.id) ?? []).length}</TD>
                          <TD>
                            <StatusBadge status={invoice.liability_status} />
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
              <CardHeader
                title="Record invoice"
                description="Record the invoice exactly as the transporter submitted it. Nothing here creates a payable."
              />
              <CardBody>
                <TransporterInvoiceForm
                  transporters={transporters
                    .filter((item) => item.status === "active")
                    .map((item) => ({
                      id: item.id,
                      label: `${item.transporter_code} · ${item.business_name}`,
                    }))}
                  trips={trips.map((item) => ({ id: item.id, label: item.trip_number }))}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "lines" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Invoice lines"
              description="Charges as billed, with the category left optional so an unusual charge can still be recorded."
            />
            <CardBody>
              {lines.length === 0 ? (
                <EmptyState title="No invoice lines" description="Add a line to a recorded invoice below." />
              ) : (
                <TableScroll>
                  <Table minWidth={900}>
                    <THead>
                      <TR>
                        <TH>Invoice</TH>
                        <TH>Transporter</TH>
                        <TH>Description</TH>
                        <TH>Category</TH>
                        <TH align="right">Quantity</TH>
                        <TH align="right">Unit rate</TH>
                        <TH align="right">Line total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {lines.map((line) => {
                        const invoice = invoiceById.get(line.invoice_id);

                        return (
                          <TR key={line.id}>
                            <TD className="text-xs font-medium">{invoice?.invoice_number ?? "—"}</TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {invoice ? transporterById.get(invoice.transporter_id)?.business_name ?? "—" : "—"}
                            </TD>
                            <TD>{line.description}</TD>
                            <TD className="text-xs capitalize">
                              {line.charge_category ? line.charge_category.replaceAll("_", " ") : "—"}
                            </TD>
                            <TD align="right">{formatQuantity(Number(line.quantity))}</TD>
                            <TD align="right">{formatMoney(Number(line.unit_rate))}</TD>
                            <TD align="right">{formatMoney(Number(line.line_total))}</TD>
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
                title="Add invoice line"
                description="Quantity times unit rate produces the line total. The charge category is optional."
              />
              <CardBody>
                {invoices.length === 0 ? (
                  <EmptyState title="No invoice to add to" description="Record an invoice before adding lines." />
                ) : (
                  <InvoiceLineForm
                    invoices={invoices.map((invoice) => ({
                      id: invoice.id,
                      label: `${invoice.invoice_number} · ${
                        transporterById.get(invoice.transporter_id)?.business_name ?? "transporter"
                      }`,
                    }))}
                    chargeCategories={chargeCategories}
                  />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Invoices are append-only evidence. Nothing here creates a payable, a payment, a deduction from a driver or
        transporter, or a loss. Those rules await DR-13.
      </p>
    </div>
  );
}
