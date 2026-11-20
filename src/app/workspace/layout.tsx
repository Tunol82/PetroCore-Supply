import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { readImpersonation } from "@/modules/platform/impersonation";
import { stopImpersonation } from "@/app/platform/actions";
import { AppShell, type NavGroup } from "@/components/shell/app-shell";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  // The Playwright suite runs without Supabase configured; pages render their
  // own unconfigured state, so the shell must not wrap them.
  if (!getSupabaseConfig()) {
    return <>{children}</>;
  }

  const { user, tenant, can } = await getWorkspaceContext();

  if (!user) {
    return <>{children}</>;
  }

  if (!tenant) {
    return <>{children}</>;
  }

  const supply = can("procurement.view") || can("procurement.manage");
  const sales = can("sales.view") || can("sales.manage");
  const transport = can("transport.view") || can("transport.manage");
  const inventory = can("inventory.view") || can("inventory.manage");
  const finance = supply || sales;

  const groups: NavGroup[] = [{ label: "Overview", items: [{ href: "/workspace", label: "Workspace" }] }];

  if (supply || inventory || sales) {
    const items = [];

    if (supply) {
      items.push({ href: "/workspace/procurement", label: "Procurement" });
    }

    if (inventory) {
      items.push(
        { href: "/workspace/inventory", label: "Inventory" },
        { href: "/workspace/inventory/fulfilment", label: "Stock issues" },
      );
    }

    if (sales) {
      items.push({ href: "/workspace/sales", label: "Sales" });
    }

    groups.push({ label: "Supply", items });
  }

  if (transport) {
    groups.push({
      label: "Transport",
      items: [
        { href: "/workspace/fleet", label: "Fleet" },
        { href: "/workspace/dispatch", label: "Dispatch" },
        { href: "/workspace/deliveries", label: "Deliveries" },
        { href: "/workspace/reconciliation", label: "Trip checks" },
        { href: "/workspace/transport-invoices", label: "Haulage bills" },
      ],
    });
  }

  if (finance) {
    groups.push({ label: "Finance", items: [{ href: "/workspace/finance", label: "Money" }] });
  }

  const administration = [];

  if (can("audit.view")) {
    administration.push({ href: "/workspace/audit", label: "Audit" });
  }

  if (can("users.manage")) {
    administration.push({ href: "/workspace/access", label: "Access" });
  }

  if (can("organisation.manage")) {
    administration.push({ href: "/workspace/settings", label: "Settings" });
  }

  administration.push({ href: "/workspace/styleguide", label: "Styleguide" });

  groups.push({ label: "Administration", items: administration });

  const impersonation = await readImpersonation();

  return (
    <AppShell
      organisationName={tenant.organisationName}
      organisationCode={tenant.organisationCode}
      userEmail={user.email ?? ""}
      groups={groups}
      banner={
        impersonation ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-4 py-2.5">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Support session</span> · viewing as{" "}
              <span className="font-semibold">{impersonation.targetName}</span> ({impersonation.targetEmail}). Actions
              are performed and audited as this member. Expires{" "}
              {new Date(impersonation.expiresAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Lagos",
              })}
              .
            </p>
            <form action={stopImpersonation}>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Exit impersonation
              </button>
            </form>
          </div>
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
