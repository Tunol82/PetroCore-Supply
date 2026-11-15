import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
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

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <Brand />
          <form action={signOut}>
            <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Authentication verified</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your secure session is active.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            You are signed in as <span className="font-medium text-[var(--ink)]">{data.user.email ?? "an authenticated user"}</span>.
            Company membership and tenant access will be resolved here after the approved tenant schema and row-level security policies are implemented.
          </p>
          <div className="mt-7 rounded-xl bg-[var(--brand-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--brand)]">Tenant access setup is the next step</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              No tenant has been assumed or selected. PetroCore Supply will only open a company workspace after confirming your active membership and permissions on the server.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
