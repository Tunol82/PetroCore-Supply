import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const swatches = [
  { name: "Page", token: "--page", className: "bg-[var(--page)]" },
  { name: "Surface", token: "--surface", className: "bg-[var(--surface)]" },
  { name: "Surface 2", token: "--surface-2", className: "bg-[var(--surface-2)]" },
  { name: "Line", token: "--line", className: "bg-[var(--line)]" },
  { name: "Ink", token: "--ink", className: "bg-[var(--ink)]" },
  { name: "Muted", token: "--muted", className: "bg-[var(--muted)]" },
  { name: "Brand", token: "--brand", className: "bg-[var(--brand)]" },
  { name: "Accent", token: "--accent", className: "bg-[var(--accent)]" },
  { name: "Success", token: "--success", className: "bg-[var(--success)]" },
  { name: "Warning", token: "--warning", className: "bg-[var(--warning)]" },
  { name: "Danger", token: "--danger", className: "bg-[var(--danger)]" },
];

const statuses = [
  "available",
  "posted",
  "reversed",
  "confirmed",
  "not_assessed",
  "within_tolerance",
  "flagged",
  "partially_fulfilled",
];

export default function StyleguidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Design reference"
        title="Styleguide"
        description="Tokens and primitives used across PetroCore Supply. This page is for review, not for operations."
        actions={<Badge tone="brand">v1</Badge>}
      />

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Colour</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map((swatch) => (
            <div key={swatch.token} className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
              <div className={`h-14 border-b border-[var(--line)] ${swatch.className}`} />
              <div className="bg-[var(--surface)] px-2.5 py-2">
                <p className="text-xs font-semibold">{swatch.name}</p>
                <p className="text-[10px] text-[var(--muted)]">{swatch.token}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Buttons" description="One primary action per view." />
          <CardBody className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status badges" description="Mapped from record status values." />
          <CardBody className="flex flex-wrap items-center gap-2">
            {statuses.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader title="Form controls" description="Labels above controls, hints below." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Text input" htmlFor="sg-text" hint="Helper text sits here.">
            <Input id="sg-text" placeholder="PETROCORE" />
          </Field>
          <Field label="Select" htmlFor="sg-select">
            <Select id="sg-select" defaultValue="">
              <option value="" disabled>
                Choose an option
              </option>
              <option value="a">Option A</option>
              <option value="b">Option B</option>
            </Select>
          </Field>
          <Field label="Number" htmlFor="sg-number">
            <Input id="sg-number" type="number" step="0.001" defaultValue="0" />
          </Field>
          <Field label="Notes" htmlFor="sg-notes" className="sm:col-span-3">
            <Textarea id="sg-notes" placeholder="Optional detail" />
          </Field>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Statistics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Stock on hand" value="33,000" hint="Litres at Alpha Depot" />
          <StatCard label="Open trips" value="4" hint="Two loading today" tone="brand" />
          <StatCard label="Unsettled liability" value="₦816,000" hint="DR-13 confirmations" tone="danger" />
        </div>
      </section>

      <Card>
        <CardHeader
          title="Data table"
          description="Sticky headers, tabular numerals, right-aligned quantities."
          action={<Button size="sm" variant="secondary">Export</Button>}
        />
        <CardBody className="space-y-4">
          <TableScroll>
            <Table minWidth={640}>
              <THead>
                <TR>
                  <TH>Batch</TH>
                  <TH>Product</TH>
                  <TH>Location</TH>
                  <TH align="right">Received</TH>
                  <TH align="right">Remaining</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                <TR>
                  <TD className="font-medium">BAT-472467</TD>
                  <TD>AGO 472467</TD>
                  <TD>Alpha Depot</TD>
                  <TD align="right">33,000</TD>
                  <TD align="right">30,000</TD>
                  <TD>
                    <StatusBadge status="available" />
                  </TD>
                </TR>
                <TR>
                  <TD className="font-medium">BAT-915996</TD>
                  <TD>PMS 915996</TD>
                  <TD>Alpha Depot</TD>
                  <TD align="right">1,000</TD>
                  <TD align="right">0</TD>
                  <TD>
                    <StatusBadge status="exhausted" />
                  </TD>
                </TR>
              </TBody>
            </Table>
          </TableScroll>

          <EmptyState
            title="No records yet"
            description="Empty states name the next action instead of only reporting absence."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Feedback" description="Inline alerts for form results." />
        <CardBody className="space-y-3">
          <Alert tone="success">Stock received. A receipt movement was posted.</Alert>
          <Alert tone="info">Only a posted issue reduces physical stock.</Alert>
          <Alert tone="warning">No tolerance rule is configured; items keep the chosen status.</Alert>
          <Alert tone="error">That truck is already assigned to an active trip.</Alert>
        </CardBody>
      </Card>
    </div>
  );
}
