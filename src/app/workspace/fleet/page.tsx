import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusToggle } from "@/components/ui/status-toggle";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { CompartmentForm, DriverForm, TransporterForm, TruckForm } from "./fleet-forms";
import { setCompartmentStatus, setDriverStatus, setTransporterStatus, setTruckStatus } from "./actions";

export const dynamic = "force-dynamic";

type Transporter = {
  id: string;
  transporter_code: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  status: string;
};

type Truck = {
  id: string;
  registration_number: string;
  transporter_id: string | null;
  ownership_type: string;
  status: string;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Compartment = {
  id: string;
  truck_id: string;
  compartment_number: string;
  capacity: number;
  product_compatibility: string | null;
  status: string;
};

type Driver = {
  id: string;
  driver_code: string;
  full_name: string;
  phone: string | null;
  licence_number: string;
  licence_expiry: string | null;
  driver_type: string;
  transporter_id: string | null;
  status: string;
};

type SpendTrip = {
  id: string;
  trip_number: string;
  departure_time: string | null;
  created_at: string;
};

type SpendAssignment = {
  trip_id: string;
  truck_id: string;
  assignment_role: string;
  assigned_at: string;
};

type SpendExpense = {
  trip_id: string;
  amount: number;
  expense_type: string;
  incurred_on: string | null;
};

type SpendInvoice = {
  trip_id: string | null;
  total_amount: number;
  invoice_date: string;
};

const TABS = ["transporters", "trucks", "compartments", "drivers", "spend"] as const;

const LICENCE_WARNING_DAYS = 30;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDay(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB");
}

function licenceState(value: string | null) {
  if (!value) {
    return { label: "No expiry recorded", tone: "neutral" as const, alert: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(value) - Date.parse(today)) / 86_400_000);

  if (days < 0) {
    return { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "danger" as const, alert: true };
  }

  if (days <= LICENCE_WARNING_DAYS) {
    return { label: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "warning" as const, alert: true };
  }

  return { label: formatDate(value), tone: "neutral" as const, alert: false };
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string }>;
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
        <PageHeader eyebrow="Fleet" title="Not authorised" description="You cannot view fleet data." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "transporters";

  const [
    transportersResult,
    trucksResult,
    compartmentsResult,
    driversResult,
    spendTripsResult,
    spendAssignmentsResult,
    spendExpensesResult,
    spendInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("transporters")
      .select(
        "id, transporter_code, business_name, contact_person, phone, email, address, payment_terms, status",
      )
      .order("business_name"),
    supabase
      .from("trucks")
      .select("id, registration_number, transporter_id, ownership_type, status, make, model, year")
      .order("registration_number"),
    supabase
      .from("truck_compartments")
      .select("id, truck_id, compartment_number, capacity, product_compatibility, status")
      .order("compartment_number"),
    supabase
      .from("drivers")
      .select(
        "id, driver_code, full_name, phone, licence_number, licence_expiry, driver_type, transporter_id, status",
      )
      .order("full_name"),
    supabase
      .from("trips")
      .select("id, trip_number, departure_time, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("trip_assignments")
      .select("trip_id, truck_id, assignment_role, assigned_at")
      .order("assigned_at", { ascending: false })
      .limit(300),
    supabase
      .from("trip_expenses")
      .select("trip_id, amount, expense_type, incurred_on")
      .order("incurred_on", { ascending: false })
      .limit(500),
    supabase
      .from("transporter_invoices")
      .select("trip_id, total_amount, invoice_date")
      .order("invoice_date", { ascending: false })
      .limit(500),
  ]);

  const queryError =
    transportersResult.error ??
    trucksResult.error ??
    compartmentsResult.error ??
    driversResult.error ??
    spendTripsResult.error ??
    spendAssignmentsResult.error ??
    spendExpensesResult.error ??
    spendInvoicesResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Fleet" title="Unavailable" description="Fleet data could not be loaded." />
      </div>
    );
  }

  const transporters = (transportersResult.data ?? []) as Transporter[];
  const trucks = (trucksResult.data ?? []) as Truck[];
  const compartments = (compartmentsResult.data ?? []) as Compartment[];
  const drivers = (driversResult.data ?? []) as Driver[];

  const transporterById = new Map(transporters.map((transporter) => [transporter.id, transporter]));
  const truckById = new Map(trucks.map((truck) => [truck.id, truck]));

  const spendTrips = (spendTripsResult.data ?? []) as SpendTrip[];
  const spendAssignments = (spendAssignmentsResult.data ?? []) as SpendAssignment[];
  const spendExpenses = (spendExpensesResult.data ?? []) as SpendExpense[];
  const spendInvoices = (spendInvoicesResult.data ?? []) as SpendInvoice[];
  const spendTripById = new Map(spendTrips.map((trip) => [trip.id, trip]));

  const truckByTrip = new Map<string, string>();

  for (const assignment of spendAssignments) {
    if (assignment.assignment_role === "primary" && !truckByTrip.has(assignment.trip_id)) {
      truckByTrip.set(assignment.trip_id, assignment.truck_id);
    }
  }

  for (const assignment of spendAssignments) {
    if (!truckByTrip.has(assignment.trip_id)) {
      truckByTrip.set(assignment.trip_id, assignment.truck_id);
    }
  }

  const expenseByTrip = new Map<string, { total: number; byDate: Map<string, number> }>();

  for (const expense of spendExpenses) {
    const trip = spendTripById.get(expense.trip_id);
    const date =
      expense.incurred_on ??
      trip?.departure_time?.slice(0, 10) ??
      trip?.created_at.slice(0, 10) ??
      "unknown";
    const amount = Number(expense.amount);
    const current = expenseByTrip.get(expense.trip_id) ?? { total: 0, byDate: new Map<string, number>() };
    current.total += amount;
    current.byDate.set(date, (current.byDate.get(date) ?? 0) + amount);
    expenseByTrip.set(expense.trip_id, current);
  }

  const invoiceByTrip = new Map<string, { total: number; byDate: Map<string, number> }>();

  for (const invoice of spendInvoices) {
    if (!invoice.trip_id) {
      continue;
    }

    const amount = Number(invoice.total_amount);
    const current = invoiceByTrip.get(invoice.trip_id) ?? { total: 0, byDate: new Map<string, number>() };
    current.total += amount;
    current.byDate.set(invoice.invoice_date, (current.byDate.get(invoice.invoice_date) ?? 0) + amount);
    invoiceByTrip.set(invoice.trip_id, current);
  }

  type TripSpendRow = {
    trip: SpendTrip;
    truckId: string;
    expenses: number;
    haulage: number;
    total: number;
  };

  const tripSpendRows: TripSpendRow[] = [];

  for (const trip of spendTrips) {
    const truckId = truckByTrip.get(trip.id);

    if (!truckId) {
      continue;
    }

    const expenses = expenseByTrip.get(trip.id)?.total ?? 0;
    const haulage = invoiceByTrip.get(trip.id)?.total ?? 0;

    if (expenses === 0 && haulage === 0) {
      continue;
    }

    tripSpendRows.push({ trip, truckId, expenses, haulage, total: expenses + haulage });
  }

  type DailySpendRow = { truckId: string; date: string; expenses: number; haulage: number; total: number };

  const dailySpend = new Map<string, DailySpendRow>();

  function addDaily(truckId: string, date: string, expenses: number, haulage: number) {
    const key = `${truckId}|${date}`;
    const current = dailySpend.get(key) ?? { truckId, date, expenses: 0, haulage: 0, total: 0 };
    current.expenses += expenses;
    current.haulage += haulage;
    current.total += expenses + haulage;
    dailySpend.set(key, current);
  }

  for (const row of tripSpendRows) {
    const expenses = expenseByTrip.get(row.trip.id);
    const invoices = invoiceByTrip.get(row.trip.id);

    if (expenses) {
      for (const [date, amount] of expenses.byDate) {
        addDaily(row.truckId, date, amount, 0);
      }
    }

    if (invoices) {
      for (const [date, amount] of invoices.byDate) {
        addDaily(row.truckId, date, 0, amount);
      }
    }
  }

  const dailySpendRows = Array.from(dailySpend.values()).sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);

    if (byDate !== 0) {
      return byDate;
    }

    return (truckById.get(a.truckId)?.registration_number ?? "").localeCompare(
      truckById.get(b.truckId)?.registration_number ?? "",
    );
  });

  const totalTruckSpend = tripSpendRows.reduce((sum, row) => sum + row.total, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTruckSpend = dailySpendRows
    .filter((row) => row.date === today)
    .reduce((sum, row) => sum + row.total, 0);
  const trucksWithSpend = new Set(tripSpendRows.map((row) => row.truckId)).size;

  const activeTransporters = transporters.filter((transporter) => transporter.status === "active");
  const activeTrucks = trucks.filter((truck) => truck.status === "active");

  const transporterOptions = transporters.map((transporter) => ({
    id: transporter.id,
    label: `${transporter.business_name} (${transporter.transporter_code})`,
  }));

  const activeTransporterOptions = activeTransporters.map((transporter) => ({
    id: transporter.id,
    label: `${transporter.business_name} (${transporter.transporter_code})`,
  }));

  const truckOptions = activeTrucks.map((truck) => ({
    id: truck.id,
    label: truck.registration_number,
  }));

  const editId = params.edit;
  const editingTransporter = editId ? transporters.find((item) => item.id === editId) ?? null : null;
  const editingTruck = editId ? trucks.find((item) => item.id === editId) ?? null : null;
  const editingCompartment = editId ? compartments.find((item) => item.id === editId) ?? null : null;
  const editingDriver = editId ? drivers.find((item) => item.id === editId) ?? null : null;
  const editMissing =
    Boolean(editId) && !editingTransporter && !editingTruck && !editingCompartment && !editingDriver;

  const compartmentsByTruck = new Map<string, Compartment[]>();
  for (const compartment of compartments) {
    const current = compartmentsByTruck.get(compartment.truck_id) ?? [];
    current.push(compartment);
    compartmentsByTruck.set(compartment.truck_id, current);
  }

  const capacityByTruck = new Map<string, number>();
  for (const compartment of compartments) {
    capacityByTruck.set(
      compartment.truck_id,
      (capacityByTruck.get(compartment.truck_id) ?? 0) + Number(compartment.capacity),
    );
  }

  const totalTruckCapacity = trucks.reduce(
    (sum, truck) => sum + (capacityByTruck.get(truck.id) ?? 0),
    0,
  );
  const totalCompartmentCapacity = compartments.reduce((sum, compartment) => sum + Number(compartment.capacity), 0);
  const licenceAlerts = drivers.filter((driver) => licenceState(driver.licence_expiry).alert).length;

  const tabs = [
    { href: "/workspace/fleet?tab=transporters", label: "Transporters", count: transporters.length },
    { href: "/workspace/fleet?tab=trucks", label: "Trucks", count: trucks.length },
    { href: "/workspace/fleet?tab=compartments", label: "Compartments", count: compartments.length },
    { href: "/workspace/fleet?tab=drivers", label: "Drivers", count: drivers.length },
    { href: "/workspace/fleet?tab=spend", label: "Spend", count: tripSpendRows.length },
  ];
  const activeHref = `/workspace/fleet?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet"
        title={tenant.organisationName}
        description="Transporters, trucks, compartments and drivers. Assignment is exclusive: one active trip per truck or driver."
        actions={<ButtonLink href="/workspace/dispatch">Dispatch</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Transporters"
          value={transporters.length}
          hint={`${activeTransporters.length} active, ${trucks.filter((truck) => truck.transporter_id).length} truck${
            trucks.filter((truck) => truck.transporter_id).length === 1 ? "" : "s"
          } assigned`}
        />
        <StatCard
          label="Trucks"
          value={trucks.length}
          hint={`${activeTrucks.length} active, ${formatQuantity(totalTruckCapacity)} capacity`}
          tone="brand"
        />
        <StatCard label="Compartments" value={compartments.length} hint={`${formatQuantity(totalCompartmentCapacity)} capacity`} />
        <StatCard
          label="Drivers"
          value={drivers.length}
          hint={
            licenceAlerts === 0
              ? `${drivers.filter((driver) => driver.status === "active").length} active, no licence alerts`
              : `${drivers.filter((driver) => driver.status === "active").length} active, ${licenceAlerts} licence${
                  licenceAlerts === 1 ? "" : "s"
                } expiring or expired`
          }
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "transporters" ? (
        <div className="space-y-6">
          {editMissing ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That record could not be found. It may have been removed.
            </p>
          ) : null}

          <Card>
            <CardHeader
              title="Transporters"
              description="Haulage partners. Deactivating keeps history but hides the transporter from new trucks, drivers and invoices."
            />
            <CardBody>
              {transporters.length === 0 ? (
                <EmptyState title="No transporters yet" description="Add the first transporter below." />
              ) : (
                <TableScroll>
                  <Table minWidth={820}>
                    <THead>
                      <TR>
                        <TH>Code</TH>
                        <TH>Business name</TH>
                        <TH>Contact</TH>
                        <TH>Phone</TH>
                        <TH>Status</TH>
                        {canManage ? <TH>Actions</TH> : null}
                      </TR>
                    </THead>
                    <TBody>
                      {transporters.map((transporter) => (
                        <TR
                          key={transporter.id}
                          className={editingTransporter?.id === transporter.id ? "bg-[var(--brand-soft)]/40" : ""}
                        >
                          <TD className="font-medium">{transporter.transporter_code}</TD>
                          <TD>{transporter.business_name}</TD>
                          <TD className="text-xs text-[var(--muted)]">{transporter.contact_person ?? "—"}</TD>
                          <TD className="text-xs text-[var(--muted)]">{transporter.phone ?? "—"}</TD>
                          <TD>
                            <StatusBadge status={transporter.status} />
                          </TD>
                          {canManage ? (
                            <TD>
                              <div className="flex flex-wrap items-center gap-2">
                                <ButtonLink
                                  href={`/workspace/fleet?tab=transporters&edit=${transporter.id}`}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Edit
                                </ButtonLink>
                                <StatusToggle
                                  action={setTransporterStatus}
                                  id={transporter.id}
                                  name={transporter.business_name}
                                  active={transporter.status === "active"}
                                />
                              </div>
                            </TD>
                          ) : null}
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
                title={editingTransporter ? "Edit transporter" : "Add transporter"}
                description={
                  editingTransporter
                    ? "Changes apply to future documents. Existing trucks, drivers and invoices keep their link."
                    : "Code must be unique for this company."
                }
              />
              <CardBody>
                <TransporterForm
                  key={editingTransporter?.id ?? "new"}
                  transporter={editingTransporter ?? undefined}
                />
                {editingTransporter ? (
                  <div className="mt-3">
                    <ButtonLink href="/workspace/fleet?tab=transporters" size="sm">
                      Cancel edit
                    </ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "trucks" ? (
        <div className="space-y-6">
          {editMissing ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That record could not be found. It may have been removed.
            </p>
          ) : null}

          <Card>
            <CardHeader
              title="Trucks"
              description="Company-owned and third-party trucks. Deactivating keeps history but hides the truck from new dispatch assignments."
            />
            <CardBody>
              {trucks.length === 0 ? (
                <EmptyState title="No trucks yet" description="Add the first truck below." />
              ) : (
                <TableScroll>
                  <Table minWidth={1000}>
                    <THead>
                      <TR>
                        <TH>Registration</TH>
                        <TH>Make / model</TH>
                        <TH>Ownership</TH>
                        <TH>Transporter</TH>
                        <TH align="right">Capacity</TH>
                        <TH align="right">Compartments</TH>
                        <TH>Status</TH>
                        {canManage ? <TH>Actions</TH> : null}
                      </TR>
                    </THead>
                    <TBody>
                      {trucks.map((truck) => {
                        const truckCompartments = compartmentsByTruck.get(truck.id) ?? [];

                        return (
                          <TR
                            key={truck.id}
                            className={editingTruck?.id === truck.id ? "bg-[var(--brand-soft)]/40" : ""}
                          >
                            <TD className="font-medium">{truck.registration_number}</TD>
                            <TD className="text-xs">
                              {[truck.make, truck.model].filter(Boolean).join(" ") || "—"}
                              {truck.year ? <span className="block text-[var(--muted)]">{truck.year}</span> : null}
                            </TD>
                            <TD>
                              <Badge tone={truck.ownership_type === "company" ? "brand" : "neutral"}>
                                {truck.ownership_type.replaceAll("_", " ")}
                              </Badge>
                            </TD>
                            <TD className="text-xs">
                              {truck.transporter_id
                                ? transporterById.get(truck.transporter_id)?.business_name ?? "transporter"
                                : "Company"}
                            </TD>
                            <TD align="right">
                              {formatQuantity(capacityByTruck.get(truck.id) ?? 0)}
                              {truckCompartments.length === 0 ? (
                                <span className="block text-[11px] font-medium text-[var(--warning)]">
                                  No compartments
                                </span>
                              ) : null}
                            </TD>
                            <TD align="right">{truckCompartments.length}</TD>
                            <TD>
                              <StatusBadge status={truck.status} />
                            </TD>
                            {canManage ? (
                              <TD>
                                <div className="flex flex-wrap items-center gap-2">
                                  <ButtonLink
                                    href={`/workspace/fleet?tab=trucks&edit=${truck.id}`}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Edit
                                  </ButtonLink>
                                  {truck.status === "active" || truck.status === "inactive" ? (
                                    <StatusToggle
                                      action={setTruckStatus}
                                      id={truck.id}
                                      name={truck.registration_number}
                                      active={truck.status === "active"}
                                    />
                                  ) : null}
                                </div>
                              </TD>
                            ) : null}
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
                title={editingTruck ? "Edit truck" : "Add truck"}
                description={
                  editingTruck
                    ? "Capacity comes from the compartments. Maintenance and retired status are set here, not by the quick toggle."
                    : "Add the truck, then add its compartments; capacity is their sum."
                }
              />
              <CardBody>
                <TruckForm
                  key={editingTruck?.id ?? "new"}
                  transporters={editingTruck ? transporterOptions : activeTransporterOptions}
                  truck={editingTruck ?? undefined}
                />
                {editingTruck ? (
                  <div className="mt-3">
                    <ButtonLink href="/workspace/fleet?tab=trucks" size="sm">
                      Cancel edit
                    </ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "compartments" ? (
        <div className="space-y-6">
          {editMissing ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That record could not be found. It may have been removed.
            </p>
          ) : null}

          <Card>
            <CardHeader
              title="Compartments"
              description="Loading is recorded per compartment, and loaded quantity cannot exceed its capacity. Deactivating keeps history but hides the compartment from new loading."
            />
            <CardBody>
              {compartments.length === 0 ? (
                <EmptyState title="No compartments yet" description="Add the first compartment below." />
              ) : (
                <TableScroll>
                  <Table minWidth={920}>
                    <THead>
                      <TR>
                        <TH>Truck</TH>
                        <TH>Compartment</TH>
                        <TH>Product compatibility</TH>
                        <TH align="right">Capacity</TH>
                        <TH>Status</TH>
                        {canManage ? <TH>Actions</TH> : null}
                      </TR>
                    </THead>
                    <TBody>
                      {compartments.map((compartment) => (
                        <TR
                          key={compartment.id}
                          className={editingCompartment?.id === compartment.id ? "bg-[var(--brand-soft)]/40" : ""}
                        >
                          <TD className="font-medium">
                            {truckById.get(compartment.truck_id)?.registration_number ?? "Truck"}
                          </TD>
                          <TD>{compartment.compartment_number}</TD>
                          <TD className="text-xs text-[var(--muted)]">{compartment.product_compatibility ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(compartment.capacity))}</TD>
                          <TD>
                            <StatusBadge status={compartment.status} />
                          </TD>
                          {canManage ? (
                            <TD>
                              <div className="flex flex-wrap items-center gap-2">
                                <ButtonLink
                                  href={`/workspace/fleet?tab=compartments&edit=${compartment.id}`}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Edit
                                </ButtonLink>
                                <StatusToggle
                                  action={setCompartmentStatus}
                                  id={compartment.id}
                                  name={`compartment ${compartment.compartment_number}`}
                                  active={compartment.status === "active"}
                                />
                              </div>
                            </TD>
                          ) : null}
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
                title={editingCompartment ? "Edit compartment" : "Add compartment"}
                description={
                  editingCompartment
                    ? "Number, capacity and compatibility can change. The truck is fixed so historical loading stays attached to the same vehicle."
                    : "Number and capacity are per truck."
                }
              />
              <CardBody>
                {!editingCompartment && truckOptions.length === 0 ? (
                  <EmptyState
                    title="No active truck to attach to"
                    description="Add or reactivate a truck before a compartment."
                  />
                ) : (
                  <CompartmentForm
                    key={editingCompartment?.id ?? "new"}
                    trucks={truckOptions}
                    compartment={editingCompartment ?? undefined}
                    truckLabel={
                      editingCompartment
                        ? truckById.get(editingCompartment.truck_id)?.registration_number ?? "Truck"
                        : undefined
                    }
                  />
                )}
                {editingCompartment ? (
                  <div className="mt-3">
                    <ButtonLink href="/workspace/fleet?tab=compartments" size="sm">
                      Cancel edit
                    </ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "drivers" ? (
        <div className="space-y-6">
          {editMissing ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              That record could not be found. It may have been removed.
            </p>
          ) : null}

          <Card>
            <CardHeader
              title="Drivers"
              description="Employee and third-party drivers. Deactivating keeps history but hides the driver from new dispatch assignments."
            />
            <CardBody>
              {drivers.length === 0 ? (
                <EmptyState title="No drivers yet" description="Add the first driver below." />
              ) : (
                <TableScroll>
                  <Table minWidth={1000}>
                    <THead>
                      <TR>
                        <TH>Name</TH>
                        <TH>Code</TH>
                        <TH>Type</TH>
                        <TH>Transporter</TH>
                        <TH>Licence</TH>
                        <TH>Expiry</TH>
                        <TH>Status</TH>
                        {canManage ? <TH>Actions</TH> : null}
                      </TR>
                    </THead>
                    <TBody>
                      {drivers.map((driver) => {
                        const licence = licenceState(driver.licence_expiry);

                        return (
                          <TR
                            key={driver.id}
                            className={editingDriver?.id === driver.id ? "bg-[var(--brand-soft)]/40" : ""}
                          >
                            <TD className="font-medium">{driver.full_name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{driver.driver_code}</TD>
                            <TD>
                              <Badge tone={driver.driver_type === "employee" ? "brand" : "neutral"}>
                                {driver.driver_type.replaceAll("_", " ")}
                              </Badge>
                            </TD>
                            <TD className="text-xs">
                              {driver.transporter_id
                                ? transporterById.get(driver.transporter_id)?.business_name ?? "transporter"
                                : "—"}
                            </TD>
                            <TD className="text-xs text-[var(--muted)]">{driver.licence_number}</TD>
                            <TD className="text-xs">
                              {licence.alert ? (
                                <Badge tone={licence.tone} capitalize={false}>
                                  {licence.label}
                                </Badge>
                              ) : (
                                <span className={driver.licence_expiry ? "" : "text-[var(--muted)]"}>
                                  {licence.label}
                                </span>
                              )}
                            </TD>
                            <TD>
                              <StatusBadge status={driver.status} />
                            </TD>
                            {canManage ? (
                              <TD>
                                <div className="flex flex-wrap items-center gap-2">
                                  <ButtonLink
                                    href={`/workspace/fleet?tab=drivers&edit=${driver.id}`}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Edit
                                  </ButtonLink>
                                  <StatusToggle
                                    action={setDriverStatus}
                                    id={driver.id}
                                    name={driver.full_name}
                                    active={driver.status === "active"}
                                  />
                                </div>
                              </TD>
                            ) : null}
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
                title={editingDriver ? "Edit driver" : "Add driver"}
                description={
                  editingDriver
                    ? "Changes apply to future trips. Existing assignments and licences are kept as recorded."
                    : "Third-party drivers are operational records only and create no payroll obligation."
                }
              />
              <CardBody>
                <DriverForm
                  key={editingDriver?.id ?? "new"}
                  transporters={editingDriver ? transporterOptions : activeTransporterOptions}
                  driver={editingDriver ?? undefined}
                />
                {editingDriver ? (
                  <div className="mt-3">
                    <ButtonLink href="/workspace/fleet?tab=drivers" size="sm">
                      Cancel edit
                    </ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "spend" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tracked spend"
              value={formatMoney(totalTruckSpend)}
              hint={`${tripSpendRows.length} loading cycle${tripSpendRows.length === 1 ? "" : "s"}`}
              tone="brand"
            />
            <StatCard label="Spend today" value={formatMoney(todayTruckSpend)} hint={formatDay(today)} />
            <StatCard
              label="Trucks with spend"
              value={trucksWithSpend}
              hint={`${trucks.length} truck${trucks.length === 1 ? "" : "s"} in the fleet`}
            />
            <StatCard
              label="Average per cycle"
              value={
                tripSpendRows.length > 0
                  ? formatMoney(totalTruckSpend / tripSpendRows.length)
                  : formatMoney(0)
              }
              hint="Trip expenses plus haulier invoices"
            />
          </div>

          <Card>
            <CardHeader
              title="Spend by loading cycle"
              description="Trip expenses and haulier invoices for the truck assigned to each trip. Purchase cost is excluded."
            />
            <CardBody>
              {tripSpendRows.length === 0 ? (
                <EmptyState
                  title="No truck spend recorded"
                  description="Assign a truck to a trip and record an expense or haulier invoice."
                />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Truck</TH>
                        <TH>Trip</TH>
                        <TH>Departure</TH>
                        <TH align="right">Expenses</TH>
                        <TH align="right">Haulage</TH>
                        <TH align="right">Total</TH>
                        <TH>Statement</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {tripSpendRows.map((row) => (
                        <TR key={row.trip.id}>
                          <TD className="font-medium">
                            {truckById.get(row.truckId)?.registration_number ?? "Truck"}
                          </TD>
                          <TD>{row.trip.trip_number}</TD>
                          <TD className="text-xs text-[var(--muted)]">{formatDay(row.trip.departure_time)}</TD>
                          <TD align="right">{formatMoney(row.expenses)}</TD>
                          <TD align="right">{formatMoney(row.haulage)}</TD>
                          <TD align="right" className="font-semibold">{formatMoney(row.total)}</TD>
                          <TD>
                            <Link
                              href={`/workspace/dispatch/trips/${row.trip.id}`}
                              className="text-xs font-semibold text-[var(--brand)] hover:underline"
                            >
                              Open
                            </Link>
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
              title="Spend by day"
              description="Expenses use the date they were incurred; haulage uses the invoice date. Undated expenses use the trip departure date."
            />
            <CardBody>
              {dailySpendRows.length === 0 ? (
                <EmptyState title="No daily spend yet" description="Record a dated expense or invoice." />
              ) : (
                <TableScroll>
                  <Table minWidth={720}>
                    <THead>
                      <TR>
                        <TH>Truck</TH>
                        <TH>Date</TH>
                        <TH align="right">Expenses</TH>
                        <TH align="right">Haulage</TH>
                        <TH align="right">Total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {dailySpendRows.map((row) => (
                        <TR key={`${row.truckId}-${row.date}`}>
                          <TD className="font-medium">
                            {truckById.get(row.truckId)?.registration_number ?? "Truck"}
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">{row.date === "unknown" ? "—" : formatDay(row.date)}</TD>
                          <TD align="right">{formatMoney(row.expenses)}</TD>
                          <TD align="right">{formatMoney(row.haulage)}</TD>
                          <TD align="right" className="font-semibold">{formatMoney(row.total)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <p className="text-xs leading-6 text-[var(--muted)]">
            Spend is trip expenses plus transporter invoices linked to the trip. Purchase cost is excluded because it
            belongs to procurement, and quoted compartment haulage is not counted until it becomes an invoice.
          </p>
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        A truck and a driver can each hold only one active assignment, enforced at the database. Licence expiry is
        shown as a reminder only; dispatch does not block an expired licence yet.
      </p>
    </div>
  );
}
