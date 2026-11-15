import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { getPlatformContext } from "@/modules/platform/authorization";
import { getPlatformSession } from "@/modules/platform/sessions";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { exitTenant } from "./actions";
import { EnterTenantForm } from "./enter-tenant-form";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  if (!getSupabaseConfig()) {
    redirect("/login");
  }

  const context = await getPlatformContext();

  if (!context.ok) {
    if (context.reason === "unauthenticated") {
      redirect("/login");
    }

    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Platform administration is restricted.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              This account is not a platform administrator. No tenant data has been disclosed.
            </p>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to your workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data: organisations } = await context.service
    .from("organisations")
    .select("id, display_name, organisation_code, status")
    .order("display_name");

  const tenants = (organisations ?? []) as {
    id: string;
    display_name: string;
    organisation_code: string;
    status: string;
  }[];

  const session = await getPlatformSession(context.service, context.admin);
  const sessionTenant = session ? tenants.find((tenant) => tenant.id === session.organisationId) : null;

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Platform administration</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tenant support access</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Signed in as {context.email || "a platform administrator"}. Access is read-only and fully audited.
          </p>
          <Link
            href="/platform/audit"
            className="mt-3 inline-block text-sm font-semibold text-[var(--brand)]"
          >
            View platform audit trail
          </Link>
        </section>

        {session ? (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Support session active</p>
            <h2 className="mt-2 text-lg font-semibold text-amber-900">
              {sessionTenant?.display_name ?? "Tenant"} ({sessionTenant?.organisation_code ?? "unknown"})
            </h2>
            <p className="mt-1 text-sm text-amber-900/80">
              Expires {new Date(session.expiresAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}.
              {session.reason ? ` Reason: ${session.reason}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/platform/tenant"
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Open tenant view
              </Link>
              <form action={exitTenant}>
                <button
                  type="submit"
                  className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Exit tenant
                </button>
              </form>
            </div>
          </section>
        ) : !context.canEnterTenant ? (
          <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">MFA required</p>
            <h2 className="mt-2 text-lg font-semibold">Multi-factor authentication is required.</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              This platform account must complete an authenticator challenge before entering a tenant. Enrol MFA and
              sign in at AAL2, then return to this page. No tenant data is available until then.
            </p>
            <Link href="/account/security" className="mt-4 inline-block text-sm font-semibold text-[var(--brand)]">
              Open security settings
            </Link>
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Enter a tenant</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The session lasts 30 minutes. Every entry and exit is recorded in the platform audit trail.
            </p>
            <div className="mt-5">
              {tenants.length > 0 ? (
                <EnterTenantForm
                  tenants={tenants.map((tenant) => ({
                    id: tenant.id,
                    label: `${tenant.display_name} (${tenant.organisation_code})`,
                  }))}
                />
              ) : (
                <p className="text-sm text-[var(--muted)]">No tenants exist yet.</p>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Tenants</h2>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{tenant.display_name}</p>
                  <p className="text-xs text-[var(--muted)]">{tenant.organisation_code}</p>
                </div>
                <span className="text-xs font-medium text-[var(--muted)]">{tenant.status}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Platform access is server-side, read-only and scoped to the active session. Tenant Row Level Security is
          unchanged for tenant users.
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
          <p className="text-xs text-[var(--muted)]">Platform administration</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/account/security"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Security
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
