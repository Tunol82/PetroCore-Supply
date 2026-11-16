import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { ResetDemoDataForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    p_permission_key: "organisation.manage",
  });

  if (!canManage) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot manage organisation settings.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Settings</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{tenant.organisationCode}</p>
        </section>

        <section className="mt-8 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">Danger zone — clear demo data</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Removes every transaction record for this organisation: procurements, sales orders, trips, loading,
            deliveries, evidence files, reconciliation, inventory, issues, recoveries, invoices, payments and tolerance
            rules.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Keeps the organisation, users, roles, locations, products, suppliers, transporters, trucks, drivers,
            customers, depots and the audit trail. This cannot be undone.
          </p>
          <div className="mt-5">
            <ResetDemoDataForm organisationCode={tenant.organisationCode} />
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          The reset runs as one database transaction. If any step fails, nothing is deleted.
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
          <p className="text-xs text-[var(--muted)]">Settings</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/access"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Access
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
