import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { AssignmentForm, TripForm } from "./dispatch-forms";

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

export default async function DispatchPage() {
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
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view dispatch.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [tripsResult, assignmentsResult, depotsResult, locationsResult, trucksResult, driversResult, transportersResult] =
    await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, trip_number, origin_supplier_depot_id, origin_location_id, destination_location_id, departure_time, status",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("trip_assignments")
        .select("id, trip_id, truck_id, driver_id, transporter_id, assignment_role, assigned_at, released_at")
        .order("assigned_at", { ascending: false })
        .limit(30),
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

  const queryError =
    tripsResult.error ??
    assignmentsResult.error ??
    depotsResult.error ??
    locationsResult.error ??
    trucksResult.error ??
    driversResult.error ??
    transportersResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Dispatch data could not be loaded.</h1>
          </section>
        </div>
      </main>
    );
  }

  const trips = (tripsResult.data ?? []) as Trip[];
  const assignments = (assignmentsResult.data ?? []) as Assignment[];
  const depots = (depotsResult.data ?? []) as Depot[];
  const locations = (locationsResult.data ?? []) as Location[];
  const trucks = (trucksResult.data ?? []) as Truck[];
  const drivers = (driversResult.data ?? []) as Driver[];
  const transporters = (transportersResult.data ?? []) as Transporter[];

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const depotById = new Map(depots.map((depot) => [depot.id, depot]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const truckById = new Map(trucks.map((truck) => [truck.id, truck]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

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
  const driverOptions = drivers.map((driver) => ({
    id: driver.id,
    label: `${driver.full_name} (${driver.driver_code})`,
  }));
  const transporterOptions = transporters.map((transporter) => ({
    id: transporter.id,
    label: transporter.business_name,
  }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Dispatch</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Trips and manual truck/driver assignments. Loading, deliveries and reconciliation come next.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Trips</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Origin</th>
                  <th className="py-2 pr-3">Destination</th>
                  <th className="py-2 pr-3">Departure</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="py-2 pr-3 font-medium">{trip.trip_number}</td>
                    <td className="py-2 pr-3">
                      {trip.origin_supplier_depot_id
                        ? depotById.get(trip.origin_supplier_depot_id)?.name ?? "—"
                        : trip.origin_location_id
                          ? locationById.get(trip.origin_location_id)?.location_name ?? "—"
                          : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {trip.destination_location_id
                        ? locationById.get(trip.destination_location_id)?.location_name ?? "—"
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {trip.departure_time ? new Date(trip.departure_time).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{trip.status}</td>
                    <td className="py-2 text-right tabular-nums">
                      {(assignmentsByTrip.get(trip.id) ?? []).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trips.length === 0 ? <p className="py-3 text-sm text-[var(--muted)]">No trips yet.</p> : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Create trip</h3>
              <div className="mt-3">
                <TripForm depots={depotOptions} locations={locationOptions} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Assignments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Trip</th>
                  <th className="py-2 pr-3">Truck</th>
                  <th className="py-2 pr-3">Driver</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Assigned</th>
                  <th className="py-2">Released</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="py-2 pr-3 font-medium">
                      {tripById.get(assignment.trip_id)?.trip_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {truckById.get(assignment.truck_id)?.registration_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {driverById.get(assignment.driver_id)?.full_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{assignment.assignment_role}</td>
                    <td className="py-2 pr-3 text-xs">
                      {new Date(assignment.assigned_at).toLocaleString("en-GB")}
                    </td>
                    <td className="py-2 text-xs">
                      {assignment.released_at
                        ? new Date(assignment.released_at).toLocaleString("en-GB")
                        : "active"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assignments.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No assignments yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Assign a trip</h3>
              <div className="mt-3">
                <AssignmentForm
                  trips={tripOptions}
                  trucks={truckOptions}
                  drivers={driverOptions}
                  transporters={transporterOptions}
                />
              </div>
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Dispatch selects transporters manually. Overlapping truck/driver bookings are not blocked yet; release
          handling and loading arrive with the next dispatch slice.
        </p>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
          P
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
          <p className="text-xs text-[var(--muted)]">Dispatch</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/fleet"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Fleet
        </Link>
        <Link
          href="/workspace"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Workspace
        </Link>
        <form action={signOut}>
          <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
