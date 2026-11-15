import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { getPlatformContext } from "@/modules/platform/authorization";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";

export const dynamic = "force-dynamic";

type AuditEvent = {
  id: string;
  platform_admin_id: string | null;
  organisation_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "platform.tenant_entered": "Tenant entered",
  "platform.tenant_exited": "Tenant exited",
  "platform.switch_denied": "Switch denied",
  "platform.session_expired": "Session expired",
  "platform.admin_granted": "Platform admin granted",
  "platform.admin_revoked": "Platform admin revoked",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function detail(event: AuditEvent): string {
  const metadata = event.metadata ?? {};
  const reason = typeof metadata.reason === "string" ? metadata.reason : null;
  const sessionId = typeof metadata.session_id === "string" ? metadata.session_id : null;

  const parts: string[] = [];
  if (reason) parts.push(reason);
  if (sessionId) parts.push(`session ${sessionId.slice(0, 8)}`);

  return parts.join(" · ");
}

export default async function PlatformAuditPage() {
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
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No audit records have been disclosed.</p>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to your workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data } = await context.service
    .from("platform_audit_logs")
    .select("id, platform_admin_id, organisation_id, action, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []) as AuditEvent[];

  const adminIds = [...new Set(events.map((event) => event.platform_admin_id).filter(Boolean))] as string[];
  const organisationIds = [...new Set(events.map((event) => event.organisation_id).filter(Boolean))] as string[];

  const [organisationsResult, adminEmails] = await Promise.all([
    organisationIds.length
      ? context.service
          .from("organisations")
          .select("id, display_name, organisation_code")
          .in("id", organisationIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string; organisation_code: string }[] }),
    Promise.all(
      adminIds.map(async (id) => {
        const { data: user } = await context.service.auth.admin.getUserById(id);
        return [id, user.user?.email ?? null] as const;
      }),
    ),
  ]);

  const organisationById = new Map(
    ((organisationsResult.data ?? []) as { id: string; display_name: string; organisation_code: string }[]).map(
      (organisation) => [organisation.id, organisation],
    ),
  );
  const adminEmailById = new Map(adminEmails);

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-4xl">
        <Header />

        <section className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Platform administration</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Platform audit trail</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Newest 50 events. Append-only; entries cannot be edited or deleted.
            </p>
          </div>
          <Link
            href="/platform"
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Platform home
          </Link>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="divide-y divide-[var(--line)]">
            {events.map((event) => {
              const organisation = event.organisation_id ? organisationById.get(event.organisation_id) : null;
              const adminEmail = event.platform_admin_id ? adminEmailById.get(event.platform_admin_id) : null;
              const extra = detail(event);

              return (
                <div
                  key={event.id}
                  data-testid="platform-audit-row"
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{ACTION_LABELS[event.action] ?? event.action}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {adminEmail ?? (event.platform_admin_id ? `admin ${event.platform_admin_id.slice(0, 8)}` : "system")}
                      {organisation ? ` · ${organisation.display_name} (${organisation.organisation_code})` : ""}
                    </p>
                    {extra ? <p className="text-xs text-[var(--muted)]">{extra}</p> : null}
                  </div>
                  <p className="text-xs text-[var(--muted)]">{formatTime(event.created_at)}</p>
                </div>
              );
            })}
            {events.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No platform audit events yet.</p>
            ) : null}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Visible to platform administrators only. Tenant users are denied access to platform tables at the database
          boundary.
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
          <p className="text-xs text-[var(--muted)]">Platform audit</p>
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
