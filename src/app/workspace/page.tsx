import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

type ModuleLink = {
  href: string;
  title: string;
  description: string;
  group: string;
};

export default async function WorkspacePage() {
  if (!getSupabaseConfig()) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[var(--radius)] bg-[var(--brand)] text-sm font-bold text-white">
              P
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-xs text-[var(--muted)]">Secure workspace</p>
            </div>
          </div>
          <Card>
            <CardBody className="p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--warning)]">
                Setup required
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                The secure connection is not configured.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Add <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                and{" "}
                <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-xs">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>{" "}
                to your local environment file, then restart the server.
              </p>
              <div className="mt-6">
                <Alert tone="info">
                  No tenant or business data has been assumed. The workspace opens only after a secure connection, an
                  active membership and the approved access policies are in place.
                </Alert>
              </div>
            </CardBody>
          </Card>
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

  if (tenantError || !tenant) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-12">
        <div className="w-full max-w-2xl">
          <Card>
            <CardBody className="p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--warning)]">
                {tenantError ? "Workspace unavailable" : "Access pending"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                {tenantError
                  ? "We could not confirm your workspace access."
                  : "Your account is not linked to a company yet."}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {tenantError ? (
                  "No tenant data has been displayed. Try again, or ask your administrator to confirm your membership."
                ) : (
                  <>
                    You are signed in as{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {data.user.email ?? "an authenticated user"}
                    </span>
                    , but no active company membership was found. Ask your company administrator to approve your
                    access.
                  </>
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      </main>
    );
  }

  const { count: locationCount } = await supabase
    .from("business_locations")
    .select("id", { count: "exact", head: true });

  const permissionKeys = [
    "procurement.view",
    "procurement.manage",
    "sales.view",
    "sales.manage",
    "transport.view",
    "transport.manage",
    "inventory.view",
    "inventory.manage",
    "users.manage",
    "organisation.manage",
  ];

  const results = await Promise.all(
    permissionKeys.map((key) => supabase.rpc("has_permission", { p_permission_key: key })),
  );
  const allowed = Object.fromEntries(
    permissionKeys.map((key, index) => [key, Boolean(results[index].data)]),
  ) as Record<string, boolean>;

  const showProcurement = allowed["procurement.view"] || allowed["procurement.manage"];
  const showSales = allowed["sales.view"] || allowed["sales.manage"];
  const showTransport = allowed["transport.view"] || allowed["transport.manage"];
  const showInventory = allowed["inventory.view"] || allowed["inventory.manage"];
  const showFinance = showProcurement || showSales;

  const modules: ModuleLink[] = [];

  if (showProcurement) {
    modules.push({
      href: "/workspace/procurement",
      title: "Procurement",
      description: "Suppliers, depots, purchase orders, batches and landed costs.",
      group: "Supply",
    });
  }

  if (showInventory) {
    modules.push(
      {
        href: "/workspace/inventory",
        title: "Inventory",
        description: "Received stock, remaining quantities and the movement ledger.",
        group: "Supply",
      },
      {
        href: "/workspace/inventory/fulfilment",
        title: "Fulfilment",
        description: "Reservations, FIFO issues, reversals and allocations.",
        group: "Supply",
      },
    );
  }

  if (showSales) {
    modules.push({
      href: "/workspace/sales",
      title: "Sales orders",
      description: "Customers, delivery locations and order lines.",
      group: "Supply",
    });
  }

  if (showTransport) {
    modules.push(
      {
        href: "/workspace/fleet",
        title: "Fleet",
        description: "Transporters, trucks, compartments and drivers.",
        group: "Transport",
      },
      {
        href: "/workspace/dispatch",
        title: "Dispatch",
        description: "Trips and truck/driver assignments without double-booking.",
        group: "Transport",
      },
      {
        href: "/workspace/deliveries",
        title: "Deliveries",
        description: "Customer deliveries, evidence uploads and confirmation.",
        group: "Transport",
      },
      {
        href: "/workspace/reconciliation",
        title: "Reconciliation",
        description: "Variance, tolerances, liability and investigations.",
        group: "Transport",
      },
      {
        href: "/workspace/transport-invoices",
        title: "Transporter invoices",
        description: "Invoices as submitted, with optional charge categories.",
        group: "Transport",
      },
    );
  }

  if (showFinance) {
    modules.push({
      href: "/workspace/finance",
      title: "Payments & margin",
      description: "Receipts, payments and operational profitability.",
      group: "Finance",
    });
  }

  const groups = ["Supply", "Transport", "Finance"].filter((group) =>
    modules.some((module) => module.group === group),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title={tenant.organisationName}
        description={`${tenant.organisationCode} · signed in as ${tenant.fullName}`}
        actions={<Badge tone="success">Active</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Signed in as" value={tenant.fullName} hint={tenant.email} />
        <StatCard label="Locations visible" value={locationCount ?? 0} hint="Explicit grants apply" />
        <StatCard
          label="Modules available"
          value={modules.length}
          hint={`${allowed["users.manage"] ? "Administrator" : "Operational"} access`}
          tone="brand"
        />
      </div>

      {groups.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {modules
              .filter((module) => module.group === group)
              .map((module) => (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--brand)]/40 hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--ink)]">{module.title}</p>
                    <span className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]">
                      →
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{module.description}</p>
                </Link>
              ))}
          </div>
        </section>
      ))}

      {allowed["users.manage"] || allowed["organisation.manage"] ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Administration</p>
              <p className="text-xs text-[var(--muted)]">Members, roles, locations and tenant settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowed["users.manage"] ? (
                <Link
                  href="/workspace/access"
                  className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Access
                </Link>
              ) : null}
              {allowed["organisation.manage"] ? (
                <Link
                  href="/workspace/settings"
                  className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Settings
                </Link>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
