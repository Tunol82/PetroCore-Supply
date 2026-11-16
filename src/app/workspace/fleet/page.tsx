import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { CompartmentForm, DriverForm, TransporterForm, TruckForm } from "./fleet-forms";

export const dynamic = "force-dynamic";

type Transporter = { id: string; transporter_code: string; business_name: string; status: string };
type Truck = {
  id: string;
  registration_number: string;
  transporter_id: string | null;
  ownership_type: string;
  capacity: number;
  status: string;
};
type Compartment = { id: string; truck_id: string; compartment_number: string; capacity: number };
type Driver = {
  id: string;
  driver_code: string;
  full_name: string;
  transporter_id: string | null;
  driver_type: string;
  licence_expiry: string | null;
  status: string;
};

export default async function FleetPage() {
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
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view fleet data.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [transportersResult, trucksResult, compartmentsResult, driversResult] = await Promise.all([
    supabase.from("transporters").select("id, transporter_code, business_name, status").order("business_name"),
    supabase
      .from("trucks")
      .select("id, registration_number, transporter_id, ownership_type, capacity, status")
      .order("registration_number"),
    supabase.from("truck_compartments").select("id, truck_id, compartment_number, capacity").order("compartment_number"),
    supabase
      .from("drivers")
      .select("id, driver_code, full_name, transporter_id, driver_type, licence_expiry, status")
      .order("full_name"),
  ]);

  const queryError =
    transportersResult.error ?? trucksResult.error ?? compartmentsResult.error ?? driversResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Fleet data could not be loaded.</h1>
          </section>
        </div>
      </main>
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

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Fleet</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Transporters, trucks, compartments and drivers. Dispatch selects transporters manually.
          </p>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Transporters</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {transporters.map((transporter) => (
                <div key={transporter.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{transporter.business_name}</p>
                    <p className="text-xs text-[var(--muted)]">{transporter.transporter_code}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{transporter.status}</span>
                </div>
              ))}
              {transporters.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No transporters.</p> : null}
            </div>
            {canManage ? <div className="mt-4 border-t border-[var(--line)] pt-4"><TransporterForm /></div> : null}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Trucks</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {trucks.map((truck) => (
                <div key={truck.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{truck.registration_number}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {truck.ownership_type.replaceAll("_", " ")} ·{" "}
                      {truck.transporter_id
                        ? transporterById.get(truck.transporter_id)?.business_name ?? "transporter"
                        : "company"}{" "}
                      · {Number(truck.capacity).toLocaleString("en-NG")} capacity
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{truck.status}</span>
                </div>
              ))}
              {trucks.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No trucks.</p> : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <TruckForm transporters={transporterOptions} />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Compartments</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {compartments.map((compartment) => (
                <div key={compartment.id} className="py-2">
                  <p className="text-sm font-medium">
                    {truckById.get(compartment.truck_id)?.registration_number ?? "Truck"} · compartment{" "}
                    {compartment.compartment_number}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {Number(compartment.capacity).toLocaleString("en-NG")} capacity
                  </p>
                </div>
              ))}
              {compartments.length === 0 ? (
                <p className="py-2 text-sm text-[var(--muted)]">No compartments.</p>
              ) : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <CompartmentForm trucks={truckOptions} />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Drivers</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {drivers.map((driver) => (
                <div key={driver.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{driver.full_name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {driver.driver_code} · {driver.driver_type.replaceAll("_", " ")}
                      {driver.transporter_id
                        ? ` · ${transporterById.get(driver.transporter_id)?.business_name ?? "transporter"}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {driver.licence_expiry ? `Licence to ${driver.licence_expiry}` : driver.status}
                  </span>
                </div>
              ))}
              {drivers.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No drivers.</p> : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <DriverForm transporters={transporterOptions} />
              </div>
            ) : null}
          </section>
        </div>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Truck and driver double-booking prevention across time ranges, loading, deliveries and reconciliations are
          not implemented yet. Third-party drivers are operational records only.
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
          <p className="text-xs text-[var(--muted)]">Fleet</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/transport-invoices"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Invoices
        </Link>
        <Link
          href="/workspace/dispatch"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Dispatch
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
