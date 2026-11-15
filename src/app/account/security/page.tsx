import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { createClient } from "@/shared/lib/supabase/server";
import { MfaPanel, type Assurance, type TotpFactor } from "./mfa-panel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  if (!getSupabaseConfig()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const [factorsResult, assuranceResult] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const factors = (factorsResult.data?.totp ?? []) as TotpFactor[];
  const assurance = (assuranceResult.data as Assurance | null) ?? null;

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
              P
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-xs text-[var(--muted)]">Account security</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/workspace"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Workspace
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

        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Signed in as {data.user.email ?? "an authenticated user"}.
          </p>
        </section>

        <div className="mt-6">
          <MfaPanel initialFactors={factors} initialAssurance={assurance} />
        </div>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Adding a second factor raises this session to AAL2. A verified factor is required before a platform
          administrator can enter a tenant. The secret is shown only during setup; store it in your authenticator, not
          in this application.
        </p>
      </div>
    </main>
  );
}
