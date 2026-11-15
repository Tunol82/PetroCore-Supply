import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { AssignRoleForm, GrantAccessForm, RevokeForm } from "./access-forms";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

type Member = { id: string; full_name: string | null; email: string; status: string };
type Role = { id: string; name: string; is_system_role: boolean };
type UserRole = { id: string; user_id: string; role_id: string };
type Location = { id: string; location_code: string; location_name: string; status: string };
type Grant = { id: string; user_id: string; location_id: string; access_level: string; status: string };
type AuditEvent = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "access.role_assigned": "Role assigned",
  "access.role_revoked": "Role revoked",
  "access.location_granted": "Location access granted",
  "access.location_revoked": "Location access revoked",
};

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export default async function AccessPage() {
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

  const { data: canManage } = await supabase.rpc("has_permission", {
    p_permission_key: "users.manage",
  });

  const { data: canViewAudit } = await supabase.rpc("has_permission", {
    p_permission_key: "audit.view",
  });

  if (!canManage) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot manage access for this workspace.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Access administration requires the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">users.manage</code>{" "}
              permission. Ask a workspace administrator if you need it.
            </p>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [membersResult, rolesResult, userRolesResult, locationsResult, grantsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, status").order("full_name"),
    supabase.from("roles").select("id, name, is_system_role").order("name"),
    supabase.from("user_roles").select("id, user_id, role_id"),
    supabase
      .from("business_locations")
      .select("id, location_code, location_name, status")
      .order("location_name"),
    supabase
      .from("user_location_access")
      .select("id, user_id, location_id, access_level, status"),
  ]);

  const queryError =
    membersResult.error ??
    rolesResult.error ??
    userRolesResult.error ??
    locationsResult.error ??
    grantsResult.error;

  let auditEvents: AuditEvent[] = [];

  if (canViewAudit) {
    const { data: auditData } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, user_id, created_at")
      .like("action", "access.%")
      .order("created_at", { ascending: false })
      .limit(20);

    auditEvents = (auditData ?? []) as AuditEvent[];
  }

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Access data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              No access records were changed. Try again, or ask your administrator to check the workspace.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const members = (membersResult.data ?? []) as Member[];
  const roles = (rolesResult.data ?? []) as Role[];
  const userRoles = (userRolesResult.data ?? []) as UserRole[];
  const locations = (locationsResult.data ?? []) as Location[];
  const grants = (grantsResult.data ?? []) as Grant[];

  const memberById = new Map(members.map((member) => [member.id, member]));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const rolesByMember = new Map<string, UserRole[]>();

  for (const assignment of userRoles) {
    const current = rolesByMember.get(assignment.user_id) ?? [];
    current.push(assignment);
    rolesByMember.set(assignment.user_id, current);
  }

  const memberOptions = members.map((member) => ({
    id: member.id,
    label: member.full_name ? `${member.full_name} (${member.email})` : member.email,
  }));

  const roleOptions = roles.map((role) => ({ id: role.id, label: role.name }));
  const locationOptions = locations
    .filter((location) => location.status === "active")
    .map((location) => ({
      id: location.id,
      label: `${location.location_name} (${location.location_code})`,
    }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <Header />

        <section className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Tenant administration</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Access for {tenant.organisationName}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {tenant.organisationCode} · {members.length} member{members.length === 1 ? "" : "s"} · {locations.length} location
              {locations.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href="/workspace"
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to workspace
          </Link>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Members and roles</h2>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {members.map((member) => {
              const assignments = rolesByMember.get(member.id) ?? [];

              return (
                <div key={member.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{member.full_name ?? member.email}</p>
                    <p className="text-xs text-[var(--muted)]">{member.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {assignments.length === 0 ? (
                      <span className="text-xs text-[var(--muted)]">No roles</span>
                    ) : (
                      assignments.map((assignment) => (
                        <span
                          key={assignment.id}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--brand)]"
                        >
                          {roleById.get(assignment.role_id)?.name ?? "Unknown role"}
                          <RevokeForm kind="role" id={assignment.id} />
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            {members.length === 0 ? <p className="py-3 text-sm text-[var(--muted)]">No members yet.</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Assign a role</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Roles define which permissions a member holds.</p>
          <div className="mt-4">
            {roleOptions.length > 0 ? (
              <AssignRoleForm members={memberOptions} roles={roleOptions} />
            ) : (
              <p className="text-sm text-[var(--muted)]">No roles exist in this tenant yet.</p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Location access</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Members see a location only when granted, unless their role includes tenant-wide location visibility.
          </p>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {grants.map((grant) => {
              const member = memberById.get(grant.user_id);
              const location = locationById.get(grant.location_id);

              return (
                <div
                  key={grant.id}
                  data-testid="grant-row"
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{member?.full_name ?? member?.email ?? "Unknown member"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {location ? `${location.location_name} (${location.location_code})` : "Unknown location"} ·{" "}
                      {grant.access_level} · {grant.status}
                    </p>
                  </div>
                  <RevokeForm kind="access" id={grant.id} />
                </div>
              );
            })}
            {grants.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No explicit location grants.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Grant location access</h2>
          <div className="mt-4">
            {locationOptions.length > 0 ? (
              <GrantAccessForm members={memberOptions} locations={locationOptions} />
            ) : (
              <p className="text-sm text-[var(--muted)]">No active locations to grant.</p>
            )}
          </div>
        </section>

        {canViewAudit ? (
          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Recent access activity</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Newest first. Audit records are append-only and cannot be edited.
            </p>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {auditEvents.map((event) => {
                const actor = event.user_id ? memberById.get(event.user_id) : undefined;

                return (
                  <div
                    key={event.id}
                    data-testid="audit-row"
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {actor?.full_name ?? actor?.email ?? "System"} · {event.entity_type}
                        {event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{formatAuditTime(event.created_at)}</p>
                  </div>
                );
              })}
              {auditEvents.length === 0 ? (
                <p className="py-3 text-sm text-[var(--muted)]">No access activity yet.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Every change is enforced by database Row Level Security and recorded against your account. Permission checks
          run on the server; the browser cannot grant itself a role or location.
        </p>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
          P
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
          <p className="text-xs text-[var(--muted)]">Access administration</p>
        </div>
      </div>
      <form action={signOut}>
        <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
          Sign out
        </button>
      </form>
    </header>
  );
}
