import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
        P
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
        <p className="text-xs text-[var(--muted)]">Secure workspace</p>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <Brand />
          <div className="flex items-center gap-2">
            <Link
              href="/account/security"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Security
            </Link>
            <form action={signOut}>
              <button
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function WorkspacePage() {
  if (!getSupabaseConfig()) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
            <Brand />
          </header>

          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Setup required</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              The secure connection is not configured.
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Add <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
              your local environment file, then restart the server.
            </p>
            <div className="mt-7 rounded-xl bg-[var(--brand-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--brand)]">No tenant or business data has been assumed</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                PetroCore Supply opens a company workspace only after a secure connection, an active membership and
                the approved access policies are in place.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const { tenant, error: tenantError } = await getCurrentTenant(supabase, data.user.id);

  if (tenantError) {
    return (
      <Shell>
        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Workspace unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">We could not confirm your workspace access.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            No tenant data has been displayed. Try again, or ask your administrator to confirm your membership.
          </p>
        </section>
      </Shell>
    );
  }

  if (!tenant) {
    return (
      <Shell>
        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Access pending</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your account is not linked to a company yet.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            You are signed in as{" "}
            <span className="font-medium text-[var(--ink)]">{data.user.email ?? "an authenticated user"}</span>, but no
            active company membership was found. Ask your company administrator to approve your access.
          </p>
        </section>
      </Shell>
    );
  }

  const { count: locationCount } = await supabase
    .from("business_locations")
    .select("id", { count: "exact", head: true });

  const [
    { data: canManageAccess },
    { data: canViewProcurement },
    { data: canManageProcurement },
    { data: canViewSales },
    { data: canManageSales },
    { data: canViewTransport },
    { data: canManageTransport },
    { data: canViewInventory },
    { data: canManageInventory },
  ] = await Promise.all([
    supabase.rpc("has_permission", { p_permission_key: "users.manage" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.view" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.manage" }),
    supabase.rpc("has_permission", { p_permission_key: "sales.view" }),
    supabase.rpc("has_permission", { p_permission_key: "sales.manage" }),
    supabase.rpc("has_permission", { p_permission_key: "transport.view" }),
    supabase.rpc("has_permission", { p_permission_key: "transport.manage" }),
    supabase.rpc("has_permission", { p_permission_key: "inventory.view" }),
    supabase.rpc("has_permission", { p_permission_key: "inventory.manage" }),
  ]);

  const showProcurement = Boolean(canViewProcurement || canManageProcurement);
  const showSales = Boolean(canViewSales || canManageSales);
  const showTransport = Boolean(canViewTransport || canManageTransport);
  const showInventory = Boolean(canViewInventory || canManageInventory);

  return (
    <Shell>
      <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Tenant verified</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {tenant.organisationCode} · Petrocore Supply workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showProcurement ? (
              <Link
                href="/workspace/procurement"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Procurement
              </Link>
            ) : null}
            {showSales ? (
              <Link
                href="/workspace/sales"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Sales
              </Link>
            ) : null}
            {showInventory ? (
              <Link
                href="/workspace/inventory"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Inventory
              </Link>
            ) : null}
            {showProcurement || showSales ? (
              <Link
                href="/workspace/finance"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Finance
              </Link>
            ) : null}
            {showTransport ? (
              <>
                <Link
                  href="/workspace/fleet"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Fleet
                </Link>
                <Link
                  href="/workspace/dispatch"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Dispatch
                </Link>
                <Link
                  href="/workspace/deliveries"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Deliveries
                </Link>
                <Link
                  href="/workspace/reconciliation"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Reconciliation
                </Link>
                <Link
                  href="/workspace/transport-invoices"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Transporter invoices
                </Link>
              </>
            ) : null}
            {canManageAccess ? (
              <Link
                href="/workspace/access"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Manage access
              </Link>
            ) : null}
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Active</span>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] p-4">
            <dt className="text-xs font-medium text-[var(--muted)]">Signed in as</dt>
            <dd className="mt-1 text-sm font-semibold">{tenant.fullName}</dd>
            <dd className="truncate text-xs text-[var(--muted)]">{tenant.email}</dd>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-4">
            <dt className="text-xs font-medium text-[var(--muted)]">Locations visible</dt>
            <dd className="mt-1 text-2xl font-semibold">{locationCount ?? 0}</dd>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-4">
            <dt className="text-xs font-medium text-[var(--muted)]">Tenant reference</dt>
            <dd className="mt-1 text-sm font-semibold">{tenant.organisationCode}</dd>
          </div>
        </dl>

        <div className="mt-7 rounded-xl bg-[var(--brand-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--brand)]">Access is enforced by the database</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            This workspace was resolved from your authenticated membership, not from a tenant identifier in the
            browser. Row Level Security limits every query to {tenant.organisationName}.
          </p>
        </div>
      </section>
    </Shell>
  );
}
