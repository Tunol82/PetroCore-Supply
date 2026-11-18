import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { CompartmentForm, DriverForm, TransporterForm, TruckForm } from "./fleet-forms";

export const dynamic = "force-dynamic";

type Transporter = {
  id: string;
  transporter_code: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  status: string;
};

type Truck = {
  id: string;
  registration_number: string;
  transporter_id: string | null;
  ownership_type: string;
  capacity: number;
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

const TABS = ["transporters", "trucks", "compartments", "drivers"] as const;

const LICENCE_WARNING_DAYS = 30;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
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
        <PageHeader eyebrow="Fleet" title="Not authorised" description="You cannot view fleet data." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "transporters";

  const [transportersResult, trucksResult, compartmentsResult, driversResult] = await Promise.all([
    supabase
      .from("transporters")
      .select("id, transporter_code, business_name, contact_person, phone, status")
      .order("business_name"),
    supabase
      .from("trucks")
      .select("id, registration_number, transporter_id, ownership_type, capacity, status, make, model, year")
      .order("registration_number"),
    supabase
      .from("truck_compartments")
      .select("id, truck_id, compartment_number, capacity, product_compatibility")
      .order("compartment_number"),
    supabase
      .from("drivers")
      .select(
        "id, driver_code, full_name, phone, licence_number, licence_expiry, driver_type, transporter_id, status",
      )
      .order("full_name"),
  ]);

  const queryError =
    transportersResult.error ?? trucksResult.error ?? compartmentsResult.error ?? driversResult.error;

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

  const transporterOptions = transporters.map((transporter) => ({
    id: transporter.id,
    label: `${transporter.business_name} (${transporter.transporter_code})`,
  }));

  const truckOptions = trucks.map((truck) => ({
    id: truck.id,
    label: truck.registration_number,
  }));

  const compartmentsByTruck = new Map<string, Compartment[]>();
  for (const compartment of compartments) {
    const current = compartmentsByTruck.get(compartment.truck_id) ?? [];
    current.push(compartment);
    compartmentsByTruck.set(compartment.truck_id, current);
  }

  const totalTruckCapacity = trucks.reduce((sum, truck) => sum + Number(truck.capacity), 0);
  const totalCompartmentCapacity = compartments.reduce((sum, compartment) => sum + Number(compartment.capacity), 0);
  const licenceAlerts = drivers.filter((driver) => licenceState(driver.licence_expiry).alert).length;

  const tabs = [
    { href: "/workspace/fleet?tab=transporters", label: "Transporters", count: transporters.length },
    { href: "/workspace/fleet?tab=trucks", label: "Trucks", count: trucks.length },
    { href: "/workspace/fleet?tab=compartments", label: "Compartments", count: compartments.length },
    { href: "/workspace/fleet?tab=drivers", label: "Drivers", count: drivers.length },
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
          hint={`${trucks.filter((truck) => truck.transporter_id).length} truck${
            trucks.filter((truck) => truck.transporter_id).length === 1 ? "" : "s"
          } assigned`}
        />
        <StatCard label="Trucks" value={trucks.length} hint={`${formatQuantity(totalTruckCapacity)} capacity`} tone="brand" />
        <StatCard label="Compartments" value={compartments.length} hint={`${formatQuantity(totalCompartmentCapacity)} capacity`} />
        <StatCard
          label="Drivers"
          value={drivers.length}
          hint={
            licenceAlerts === 0
              ? "No licence alerts"
              : `${licenceAlerts} licence${licenceAlerts === 1 ? "" : "s"} expiring or expired`
          }
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "transporters" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Transporters" description="Haulage partners. Dispatch selects a transporter manually." />
            <CardBody>
              {transporters.length === 0 ? (
                <EmptyState title="No transporters yet" description="Add the first transporter below." />
              ) : (
                <TableScroll>
                  <Table minWidth={760}>
                    <THead>
                      <TR>
                        <TH>Code</TH>
                        <TH>Business name</TH>
                        <TH>Contact</TH>
                        <TH>Phone</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {transporters.map((transporter) => (
                        <TR key={transporter.id}>
                          <TD className="font-medium">{transporter.transporter_code}</TD>
                          <TD>{transporter.business_name}</TD>
                          <TD className="text-xs text-[var(--muted)]">{transporter.contact_person ?? "—"}</TD>
                          <TD className="text-xs text-[var(--muted)]">{transporter.phone ?? "—"}</TD>
                          <TD>
                            <StatusBadge status={transporter.status} />
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
              <CardHeader title="Add transporter" description="Code must be unique for this company." />
              <CardBody>
                <TransporterForm />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "trucks" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Trucks"
              description="Company-owned and third-party trucks. Compartment capacity is recorded separately."
            />
            <CardBody>
              {trucks.length === 0 ? (
                <EmptyState title="No trucks yet" description="Add the first truck below." />
              ) : (
                <TableScroll>
                  <Table minWidth={900}>
                    <THead>
                      <TR>
                        <TH>Registration</TH>
                        <TH>Make / model</TH>
                        <TH>Ownership</TH>
                        <TH>Transporter</TH>
                        <TH align="right">Capacity</TH>
                        <TH align="right">Compartments</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {trucks.map((truck) => {
                        const truckCompartments = compartmentsByTruck.get(truck.id) ?? [];

                        return (
                          <TR key={truck.id}>
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
                            <TD align="right">{formatQuantity(Number(truck.capacity))}</TD>
                            <TD align="right">{truckCompartments.length}</TD>
                            <TD>
                              <StatusBadge status={truck.status} />
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
              <CardHeader
                title="Add truck"
                description="Capacity is the whole-truck volume; compartments are added on the compartments tab."
              />
              <CardBody>
                <TruckForm transporters={transporterOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "compartments" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Compartments"
              description="Loading is recorded per compartment, and loaded quantity cannot exceed its capacity."
            />
            <CardBody>
              {compartments.length === 0 ? (
                <EmptyState title="No compartments yet" description="Add the first compartment below." />
              ) : (
                <TableScroll>
                  <Table minWidth={720}>
                    <THead>
                      <TR>
                        <TH>Truck</TH>
                        <TH>Compartment</TH>
                        <TH>Product compatibility</TH>
                        <TH align="right">Capacity</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {compartments.map((compartment) => (
                        <TR key={compartment.id}>
                          <TD className="font-medium">
                            {truckById.get(compartment.truck_id)?.registration_number ?? "Truck"}
                          </TD>
                          <TD>{compartment.compartment_number}</TD>
                          <TD className="text-xs text-[var(--muted)]">{compartment.product_compatibility ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(compartment.capacity))}</TD>
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
              <CardHeader title="Add compartment" description="Number and capacity are per truck." />
              <CardBody>
                {trucks.length === 0 ? (
                  <EmptyState title="No truck to attach to" description="Add a truck before a compartment." />
                ) : (
                  <CompartmentForm trucks={truckOptions} />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "drivers" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Drivers"
              description="Employee and third-party drivers. A driver holds one active assignment at a time."
            />
            <CardBody>
              {drivers.length === 0 ? (
                <EmptyState title="No drivers yet" description="Add the first driver below." />
              ) : (
                <TableScroll>
                  <Table minWidth={940}>
                    <THead>
                      <TR>
                        <TH>Name</TH>
                        <TH>Code</TH>
                        <TH>Type</TH>
                        <TH>Transporter</TH>
                        <TH>Licence</TH>
                        <TH>Expiry</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {drivers.map((driver) => {
                        const licence = licenceState(driver.licence_expiry);

                        return (
                          <TR key={driver.id}>
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
                title="Add driver"
                description="Third-party drivers are operational records only and create no payroll obligation."
              />
              <CardBody>
                <DriverForm transporters={transporterOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        A truck and a driver can each hold only one active assignment, enforced at the database. Licence expiry is
        shown as a reminder only; dispatch does not block an expired licence yet.
      </p>
    </div>
  );
}
