import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformContext } from "@/modules/platform/authorization";
import { getPlatformSession } from "@/modules/platform/sessions";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { exitTenant, startImpersonation } from "../actions";

export const dynamic = "force-dynamic";

export default async function PlatformTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!getSupabaseConfig()) {
    redirect("/login");
  }

  const context = await getPlatformContext();

  if (!context.ok) {
    redirect("/platform");
  }

  const session = await getPlatformSession(context.service, context.admin);

  if (!session) {
    redirect("/platform");
  }

  const organisationId = session.organisationId;

  const [organisationResult, membersResult, locationsResult, rolesResult, memberCount, locationCount] =
    await Promise.all([
      context.service
        .from("organisations")
        .select("display_name, organisation_code, status")
        .eq("id", organisationId)
        .maybeSingle(),
      context.service
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("organisation_id", organisationId)
        .order("full_name")
        .limit(50),
      context.service
        .from("business_locations")
        .select("id, location_name, location_code, status")
        .eq("organisation_id", organisationId)
        .order("location_name")
        .limit(10),
      context.service
        .from("roles")
        .select("id, name")
        .eq("organisation_id", organisationId)
        .order("name"),
      context.service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId),
      context.service
        .from("business_locations")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId),
    ]);

  const organisation = organisationResult.data as
    | { display_name: string; organisation_code: string; status: string }
    | null;

  const members = (membersResult.data ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    status: string;
  }[];

  const locations = (locationsResult.data ?? []) as {
    id: string;
    location_name: string;
    location_code: string;
    status: string;
  }[];

  const roles = (rolesResult.data ?? []) as { id: string; name: string }[];

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
              P
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-xs text-[var(--muted)]">Platform support view</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/platform"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Platform home
            </Link>
            <form action={exitTenant}>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Exit tenant
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Support session</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Expires {new Date(session.expiresAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}.
            {session.reason ? ` Reason: ${session.reason}` : ""}
          </p>
          <p className="mt-2 text-sm text-amber-900/80">
            Viewing this summary is read-only. Impersonating a member opens their workspace with their permissions, and
            actions are performed as that member. Start and end are recorded in the platform audit trail.
          </p>
          {params.error ? (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {params.error}
            </p>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {organisation?.display_name ?? "Tenant"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {organisation?.organisation_code ?? "unknown"} · {organisation?.status ?? "unknown"}
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] p-4">
              <dt className="text-xs font-medium text-[var(--muted)]">Members</dt>
              <dd className="mt-1 text-2xl font-semibold">{memberCount.count ?? 0}</dd>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-4">
              <dt className="text-xs font-medium text-[var(--muted)]">Locations</dt>
              <dd className="mt-1 text-2xl font-semibold">{locationCount.count ?? 0}</dd>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-4">
              <dt className="text-xs font-medium text-[var(--muted)]">Roles</dt>
              <dd className="mt-1 text-2xl font-semibold">{roles.length}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Members</h2>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{member.full_name ?? member.email}</p>
                  <p className="text-xs text-[var(--muted)]">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--muted)]">{member.status}</span>
                  {member.status === "active" && member.email ? (
                    <form action={startImpersonation}>
                      <input type="hidden" name="profileId" value={member.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Impersonate
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {members.length === 0 ? <p className="py-3 text-sm text-[var(--muted)]">No members.</p> : null}
          </div>
          {(memberCount.count ?? 0) > members.length ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Showing the first {members.length} members.</p>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Locations</h2>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {locations.map((location) => (
              <div key={location.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{location.location_name}</p>
                  <p className="text-xs text-[var(--muted)]">{location.location_code}</p>
                </div>
                <span className="text-xs font-medium text-[var(--muted)]">{location.status}</span>
              </div>
            ))}
            {locations.length === 0 ? <p className="py-3 text-sm text-[var(--muted)]">No locations.</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Roles</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {roles.map((role) => (
              <span key={role.id} className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--brand)]">
                {role.name}
              </span>
            ))}
            {roles.length === 0 ? <p className="text-sm text-[var(--muted)]">No roles.</p> : null}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          This view is read-only. No tenant record can be created, changed or deleted from a platform session. Every
          query is scoped to the session tenant and the entry and exit are recorded in the platform audit trail.
        </p>
      </div>
    </main>
  );
}
