import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

function currentTime() {
  return new Date().getTime();
}

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

  const { supabase, user, tenant, can } = await getWorkspaceContext();

  if (!user) {
    redirect("/login");
  }

  if (!tenant) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-12">
        <div className="w-full max-w-2xl">
          <Card>
            <CardBody className="p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--warning)]">
                Access pending
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                Your account is not linked to a company yet.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                You are signed in as{" "}
                <span className="font-medium text-[var(--ink)]">{user.email ?? "an authenticated user"}</span>, but no
                active company membership was found. Ask your company administrator to approve your access.
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

  const showProcurement = can("procurement.view") || can("procurement.manage");
  const showSales = can("sales.view") || can("sales.manage");
  const showTransport = can("transport.view") || can("transport.manage");
  const showInventory = can("inventory.view") || can("inventory.manage");
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

  type AttentionItem = {
    label: string;
    count: number;
    detail: string;
    href: string;
    tone: "brand" | "warning" | "danger";
  };

  const attention: AttentionItem[] = [];

  if (showTransport) {
    const [pendingDeliveriesResult, unassessedInvoicesResult, recsResult, itemsResult, tripsResult, policyResult] =
      await Promise.all([
        supabase
          .from("trip_delivery_records")
          .select("id", { count: "exact", head: true })
          .is("customer_confirmed_quantity", null),
        supabase
          .from("transporter_invoices")
          .select("id", { count: "exact", head: true })
          .eq("liability_status", "not_assessed"),
        supabase.from("trip_reconciliations").select("id, trip_id").limit(500),
        supabase
          .from("trip_reconciliation_items")
          .select("id, reconciliation_id")
          .in("reconciliation_status", ["open", "flagged", "under_investigation"])
          .limit(1000),
        supabase.from("trips").select("id, status, created_at").limit(500),
        supabase
          .from("operating_policies")
          .select("unresolved_aging_days")
          .eq("organisation_id", tenant.organisationId)
          .maybeSingle(),
      ]);

    const pendingDeliveries = pendingDeliveriesResult.count ?? 0;
    const unassessedInvoices = unassessedInvoicesResult.count ?? 0;

    const reconciliationById = new Map(
      ((recsResult.data ?? []) as { id: string; trip_id: string }[]).map((row) => [row.id, row]),
    );
    const unresolvedByTrip = new Map<string, number>();
    for (const item of (itemsResult.data ?? []) as { reconciliation_id: string }[]) {
      const tripId = reconciliationById.get(item.reconciliation_id)?.trip_id;
      if (tripId) {
        unresolvedByTrip.set(tripId, (unresolvedByTrip.get(tripId) ?? 0) + 1);
      }
    }

    const agingDays = ((policyResult.data ?? null) as { unresolved_aging_days: number } | null)?.unresolved_aging_days ?? 7;
    const now = currentTime();
    const openTrips = ((tripsResult.data ?? []) as { id: string; status: string; created_at: string }[]).filter(
      (trip) => trip.status !== "closed" && trip.status !== "cancelled",
    );
    const unresolvedTrips = openTrips.filter((trip) => (unresolvedByTrip.get(trip.id) ?? 0) > 0);
    const agingTrips = unresolvedTrips.filter(
      (trip) => now - new Date(trip.created_at).getTime() > agingDays * 86_400_000,
    );

    if (pendingDeliveries > 0) {
      attention.push({
        label: "Deliveries awaiting confirmation",
        count: pendingDeliveries,
        detail: "Customer-confirmed quantity not recorded",
        href: "/workspace/deliveries?tab=deliveries",
        tone: "warning",
      });
    }

    if (unresolvedTrips.length > 0) {
      attention.push({
        label: "Trips with unresolved items",
        count: unresolvedTrips.length,
        detail:
          agingTrips.length > 0
            ? `${agingTrips.length} past the ${agingDays}-day aging window`
            : `Within the ${agingDays}-day aging window`,
        href: "/workspace/dispatch?tab=trips",
        tone: agingTrips.length > 0 ? "danger" : "warning",
      });
    }

    if (unassessedInvoices > 0) {
      attention.push({
        label: "Transporter invoices awaiting assessment",
        count: unassessedInvoices,
        detail: "Liability not assessed yet",
        href: "/workspace/transport-invoices?tab=invoices",
        tone: "warning",
      });
    }
  }

  if (showInventory) {
    const [storageResult, receivedResult] = await Promise.all([
      supabase
        .from("procurement_batches")
        .select("id, received_quantity, supplier_quantity")
        .eq("fulfilment_type", "storage_receipt")
        .limit(500),
      supabase.from("inventory_batches").select("procurement_batch_id, original_quantity").limit(1000),
    ]);

    const receivedByBatch = new Map<string, number>();
    for (const row of (receivedResult.data ?? []) as { procurement_batch_id: string; original_quantity: number }[]) {
      receivedByBatch.set(
        row.procurement_batch_id,
        (receivedByBatch.get(row.procurement_batch_id) ?? 0) + Number(row.original_quantity),
      );
    }

    const awaitingReceipt = ((storageResult.data ?? []) as {
      id: string;
      received_quantity: number | null;
      supplier_quantity: number;
    }[]).filter((batch) => {
      const verified = Number(batch.received_quantity ?? batch.supplier_quantity);
      return verified - (receivedByBatch.get(batch.id) ?? 0) > 0;
    }).length;

    if (awaitingReceipt > 0) {
      attention.push({
        label: "Storage batches awaiting receipt",
        count: awaitingReceipt,
        detail: "Verified quantity not yet received into stock",
        href: "/workspace/inventory?tab=receive",
        tone: "warning",
      });
    }
  }

  if (can("users.manage")) {
    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("id").limit(500),
      supabase.from("user_roles").select("user_id").limit(1000),
    ]);

    const assigned = new Set(((rolesResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id));
    const withoutRole = ((profilesResult.data ?? []) as { id: string }[]).filter((profile) => !assigned.has(profile.id))
      .length;

    if (withoutRole > 0) {
      attention.push({
        label: "Members without a role",
        count: withoutRole,
        detail: "They cannot act until a role is assigned",
        href: "/workspace/access?tab=members",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title={tenant.organisationName}
        description={`${tenant.organisationCode} Â· signed in as ${tenant.fullName}`}
        actions={<Badge tone="success">Active</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Signed in as" value={tenant.fullName} hint={tenant.email} />
        <StatCard label="Locations visible" value={locationCount ?? 0} hint="Explicit grants apply" />
        <StatCard
          label="Modules available"
          value={modules.length}
          hint={`${can("users.manage") ? "Administrator" : "Operational"} access`}
          tone="brand"
        />
      </div>

      <Card>
        <CardHeader
          title="Needs attention"
          description="Work waiting on someone today. Only queues you have permission to act on are shown."
        />
        <CardBody>
          {attention.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing needs attention right now.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                        {item.label}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{item.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={item.tone}>{item.count}</Badge>
                      <span className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]">
                        â†’
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

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
                      â†’
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{module.description}</p>
                </Link>
              ))}
          </div>
        </section>
      ))}

      {can("users.manage") || can("organisation.manage") ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Administration</p>
              <p className="text-xs text-[var(--muted)]">Members, roles, locations and tenant settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("users.manage") ? (
                <Link
                  href="/workspace/access"
                  className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Access
                </Link>
              ) : null}
              {can("organisation.manage") ? (
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
