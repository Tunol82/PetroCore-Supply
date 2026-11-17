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
  AssignmentForm,
  LoadingAllocationForm,
  LoadingRecordForm,
  ReleaseAssignmentForm,
  TripForm,
} from "./dispatch-forms";

export const dynamic = "force-dynamic";

type Trip = {
  id: string;
  trip_number: string;
  origin_supplier_depot_id: string | null;
  origin_location_id: string | null;
  destination_location_id: string | null;
  departure_time: string | null;
  status: string;
};

type Assignment = {
  id: string;
  trip_id: string;
  truck_id: string;
  driver_id: string;
  transporter_id: string | null;
  assignment_role: string;
  assigned_at: string;
  released_at: string | null;
};

type Depot = { id: string; name: string; depot_code: string };
type Location = { id: string; location_name: string; location_code: string };
type Truck = { id: string; registration_number: string };
type Driver = { id: string; full_name: string; driver_code: string };
type Transporter = { id: string; business_name: string };
type Product = { id: string; product_code: string; product_name: string };
type Compartment = { id: string; truck_id: string; compartment_number: string; capacity: number };
type ProcurementBatch = { id: string; batch_number: string; product_id: string };
type SalesOrderItemRef = { id: string; sales_order_id: string; product_id: string };
type SalesOrderRef = { id: string; order_number: string };

type LoadingRecord = {
  id: string;
  trip_id: string;
  compartment_id: string;
  product_id: string;
  loaded_quantity: number;
  loading_time: string;
};

type LoadingAllocation = {
  id: string;
  trip_loading_record_id: string;
  procurement_batch_id: string;
  product_id: string;
  allocated_quantity: number;
  created_at: string;
};

const TABS = ["trips", "assignments", "loading", "allocations"] as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export default async function DispatchPage({
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
        <PageHeader eyebrow="Dispatch" title="Not authorised" description="You cannot view dispatch." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "trips";

  const [tripsResult, assignmentsResult, depotsResult, locationsResult, trucksResult, driversResult, transportersResult] =
    await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, trip_number, origin_supplier_depot_id, origin_location_id, destination_location_id, departure_time, status",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("trip_assignments")
        .select("id, trip_id, truck_id, driver_id, transporter_id, assignment_role, assigned_at, released_at")
        .order("assigned_at", { ascending: false })
        .limit(100),
      supabase.from("supplier_depots").select("id, name, depot_code").order("name"),
      supabase
        .from("business_locations")
        .select("id, location_name, location_code")
        .eq("status", "active")
        .order("location_name"),
      supabase.from("trucks").select("id, registration_number").order("registration_number"),
      supabase.from("drivers").select("id, full_name, driver_code").order("full_name"),
      supabase.from("transporters").select("id, business_name").order("business_name"),
    ]);

  const [
    loadingRecordsResult,
    allocationsResult,
    compartmentsResult,
    productsResult,
    batchesResult,
    salesItemsResult,
    salesOrdersResult,
  ] = await Promise.all([
    supabase
      .from("trip_loading_records")
      .select("id, trip_id, compartment_id, product_id, loaded_quantity, loading_time")
      .order("loading_time", { ascending: false })
      .limit(50),
    supabase
      .from("trip_loading_procurement_allocations")
      .select("id, trip_loading_record_id, procurement_batch_id, product_id, allocated_quantity, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("truck_compartments").select("id, truck_id, compartment_number, capacity").order("compartment_number"),
    supabase.from("products").select("id, product_code, product_name").order("product_name"),
    supabase.from("procurement_batches").select("id, batch_number, product_id").order("created_at", { ascending: false }).limit(50),
    supabase.from("sales_order_items").select("id, sales_order_id, product_id"),
    supabase.from("sales_orders").select("id, order_number"),
  ]);

  const queryError =
    tripsResult.error ??
    assignmentsResult.error ??
    depotsResult.error ??
    locationsResult.error ??
    trucksResult.error ??
    driversResult.error ??
    transportersResult.error ??
    loadingRecordsResult.error ??
    allocationsResult.error ??
    compartmentsResult.error ??
    productsResult.error ??
    batchesResult.error ??
    salesItemsResult.error ??
    salesOrdersResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Dispatch" title="Unavailable" description="Dispatch data could not be loaded." />
      </div>
    );
  }

  const trips = (tripsResult.data ?? []) as Trip[];
  const assignments = (assignmentsResult.data ?? []) as Assignment[];
  const depots = (depotsResult.data ?? []) as Depot[];
  const locations = (locationsResult.data ?? []) as Location[];
  const trucks = (trucksResult.data ?? []) as Truck[];
  const drivers = (driversResult.data ?? []) as Driver[];
  const transporters = (transportersResult.data ?? []) as Transporter[];
  const loadingRecords = (loadingRecordsResult.data ?? []) as LoadingRecord[];
  const allocations = (allocationsResult.data ?? []) as LoadingAllocation[];
  const compartments = (compartmentsResult.data ?? []) as Compartment[];
  const products = (productsResult.data ?? []) as Product[];
  const batches = (batchesResult.data ?? []) as ProcurementBatch[];
  const salesItems = (salesItemsResult.data ?? []) as SalesOrderItemRef[];
  const salesOrders = (salesOrdersResult.data ?? []) as SalesOrderRef[];

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const depotById = new Map(depots.map((depot) => [depot.id, depot]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const truckById = new Map(trucks.map((truck) => [truck.id, truck]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const compartmentById = new Map(compartments.map((compartment) => [compartment.id, compartment]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const salesOrderById = new Map(salesOrders.map((order) => [order.id, order]));
  const loadingRecordById = new Map(loadingRecords.map((record) => [record.id, record]));

  const assignmentsByTrip = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const current = assignmentsByTrip.get(assignment.trip_id) ?? [];
    current.push(assignment);
    assignmentsByTrip.set(assignment.trip_id, current);
  }

  const depotOptions = depots.map((depot) => ({ id: depot.id, label: `${depot.name} (${depot.depot_code})` }));
  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.location_name} (${location.location_code})`,
  }));
  const tripOptions = trips.map((trip) => ({ id: trip.id, label: trip.trip_number }));
  const truckOptions = trucks.map((truck) => ({ id: truck.id, label: truck.registration_number }));
  const driverOptions = drivers.map((driver) => ({ id: driver.id, label: `${driver.full_name} (${driver.driver_code})` }));
  const transporterOptions = transporters.map((transporter) => ({
    id: transporter.id,
    label: transporter.business_name,
  }));
  const compartmentOptions = compartments.map((compartment) => ({
    id: compartment.id,
    label: `${truckById.get(compartment.truck_id)?.registration_number ?? "Truck"} · compartment ${compartment.compartment_number}`,
  }));
  const productOptions = products.map((product) => ({
    id: product.id,
    label: `${product.product_name} (${product.product_code})`,
  }));
  const batchOptions = batches.map((batch) => ({
    id: batch.id,
    label: `${batch.batch_number} · ${productById.get(batch.product_id)?.product_name ?? "product"}`,
  }));
  const salesLineOptions = salesItems.map((item) => ({
    id: item.id,
    label: `${salesOrderById.get(item.sales_order_id)?.order_number ?? "order"} · ${
      productById.get(item.product_id)?.product_name ?? "product"
    }`,
  }));
  const loadingRecordOptions = loadingRecords.map((record) => ({
    id: record.id,
    label: `${tripById.get(record.trip_id)?.trip_number ?? "trip"} · ${
      productById.get(record.product_id)?.product_name ?? "product"
    } · ${formatQuantity(Number(record.loaded_quantity))}`,
  }));

  const activeAssignments = assignments.filter((assignment) => !assignment.released_at).length;
  const allocatedVolume = allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_quantity), 0);

  const tabs = [
    { href: "/workspace/dispatch?tab=trips", label: "Trips", count: trips.length },
    { href: "/workspace/dispatch?tab=assignments", label: "Assignments", count: assignments.length },
    { href: "/workspace/dispatch?tab=loading", label: "Loading", count: loadingRecords.length },
    { href: "/workspace/dispatch?tab=allocations", label: "Allocations", count: allocations.length },
  ];
  const activeHref = `/workspace/dispatch?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dispatch"
        title={tenant.organisationName}
        description="Trips, truck and driver assignments, loading and procurement allocation. Double-booking is blocked at the database."
        actions={<ButtonLink href="/workspace/fleet">Fleet</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trips" value={trips.length} hint="Latest 50" />
        <StatCard label="Active assignments" value={activeAssignments} hint="Truck and driver committed" tone="brand" />
        <StatCard label="Loading records" value={loadingRecords.length} hint="Per compartment" />
        <StatCard label="Allocated volume" value={formatQuantity(allocatedVolume)} hint="Procurement to loading" />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "trips" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Trips" description="Origin, destination, departure and assignment count." />
            <CardBody>
              {trips.length === 0 ? (
                <EmptyState title="No trips yet" description="Create the first trip below." />
              ) : (
                <TableScroll>
                  <Table minWidth={820}>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Origin</TH>
                        <TH>Destination</TH>
                        <TH>Departure</TH>
                        <TH>Status</TH>
                        <TH align="right">Assignments</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {trips.map((trip) => (
                        <TR key={trip.id}>
                          <TD className="font-medium">{trip.trip_number}</TD>
                          <TD>
                            {trip.origin_supplier_depot_id
                              ? depotById.get(trip.origin_supplier_depot_id)?.name ?? "—"
                              : trip.origin_location_id
                                ? locationById.get(trip.origin_location_id)?.location_name ?? "—"
                                : "—"}
                          </TD>
                          <TD>
                            {trip.destination_location_id
                              ? locationById.get(trip.destination_location_id)?.location_name ?? "—"
                              : "—"}
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {trip.departure_time ? new Date(trip.departure_time).toLocaleDateString("en-GB") : "—"}
                          </TD>
                          <TD>
                            <StatusBadge status={trip.status} />
                          </TD>
                          <TD align="right">{(assignmentsByTrip.get(trip.id) ?? []).length}</TD>
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
              <CardHeader title="Create trip" description="Origin can be a supplier depot or a storage location." />
              <CardBody>
                <TripForm depots={depotOptions} locations={locationOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "assignments" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Assignments"
              description="A truck or driver holds one active assignment. Release before reuse."
            />
            <CardBody>
              {assignments.length === 0 ? (
                <EmptyState title="No assignments yet" description="Assign a trip below." />
              ) : (
                <TableScroll>
                  <Table minWidth={920}>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Truck</TH>
                        <TH>Driver</TH>
                        <TH>Role</TH>
                        <TH>Assigned</TH>
                        <TH>Released</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {assignments.map((assignment) => (
                        <TR key={assignment.id}>
                          <TD className="font-medium">{tripById.get(assignment.trip_id)?.trip_number ?? "—"}</TD>
                          <TD>{truckById.get(assignment.truck_id)?.registration_number ?? "—"}</TD>
                          <TD>{driverById.get(assignment.driver_id)?.full_name ?? "—"}</TD>
                          <TD className="text-xs">{assignment.assignment_role}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(assignment.assigned_at).toLocaleDateString("en-GB")}
                          </TD>
                          <TD className="text-xs">
                            {assignment.released_at ? (
                              <span className="text-[var(--muted)]">
                                {new Date(assignment.released_at).toLocaleDateString("en-GB")}
                              </span>
                            ) : (
                              <StatusBadge status="active" />
                            )}
                          </TD>
                          <TD>
                            {canManage && !assignment.released_at ? (
                              <ReleaseAssignmentForm assignmentId={assignment.id} />
                            ) : (
                              <span className="text-[var(--muted)]">—</span>
                            )}
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
              <CardHeader title="Assign a trip" description="One active primary assignment per trip." />
              <CardBody>
                <AssignmentForm
                  trips={tripOptions}
                  trucks={truckOptions}
                  drivers={driverOptions}
                  transporters={transporterOptions}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "loading" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Loading records"
              description="Loaded quantity cannot exceed compartment capacity."
            />
            <CardBody>
              {loadingRecords.length === 0 ? (
                <EmptyState title="No loading records" description="Record loading below." />
              ) : (
                <TableScroll>
                  <Table minWidth={780}>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Compartment</TH>
                        <TH>Product</TH>
                        <TH align="right">Loaded</TH>
                        <TH>Time</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {loadingRecords.map((record) => (
                        <TR key={record.id}>
                          <TD className="font-medium">{tripById.get(record.trip_id)?.trip_number ?? "—"}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {truckById.get(compartmentById.get(record.compartment_id)?.truck_id ?? "")?.registration_number ??
                              "Truck"}{" "}
                            · {compartmentById.get(record.compartment_id)?.compartment_number ?? "—"}
                          </TD>
                          <TD>{productById.get(record.product_id)?.product_name ?? "—"}</TD>
                          <TD align="right">{formatQuantity(Number(record.loaded_quantity))}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(record.loading_time).toLocaleDateString("en-GB")}
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
              <CardHeader title="Record loading" description="Measurement fields are optional." />
              <CardBody>
                <LoadingRecordForm trips={tripOptions} compartments={compartmentOptions} products={productOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "allocations" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Loading allocations"
              description="Procurement allocated to a loading record. Products must match and totals are validated."
            />
            <CardBody>
              {allocations.length === 0 ? (
                <EmptyState title="No allocations" description="Allocate procurement to a loading record below." />
              ) : (
                <TableScroll>
                  <Table minWidth={760}>
                    <THead>
                      <TR>
                        <TH>Loading record</TH>
                        <TH>Batch</TH>
                        <TH>Product</TH>
                        <TH align="right">Allocated</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {allocations.map((allocation) => {
                        const record = loadingRecordById.get(allocation.trip_loading_record_id);

                        return (
                          <TR key={allocation.id}>
                            <TD className="text-xs">{record ? tripById.get(record.trip_id)?.trip_number ?? "trip" : "—"}</TD>
                            <TD className="text-xs">{batchById.get(allocation.procurement_batch_id)?.batch_number ?? "—"}</TD>
                            <TD>{productById.get(allocation.product_id)?.product_name ?? "—"}</TD>
                            <TD align="right">{formatQuantity(Number(allocation.allocated_quantity))}</TD>
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
              <CardHeader title="Allocate procurement to loading" description="Only direct procurement can be allocated." />
              <CardBody>
                <LoadingAllocationForm
                  loadingRecords={loadingRecordOptions}
                  batches={batchOptions}
                  salesOrderLines={salesLineOptions}
                  products={productOptions}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        A truck or driver can hold only one active assignment; cancelling a trip releases it automatically. Loading and
        delivery quantities are recorded as supplied.
      </p>
    </div>
  );
}
