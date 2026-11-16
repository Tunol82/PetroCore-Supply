import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { AppShell, type NavGroup } from "@/components/shell/app-shell";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

async function permissions(supabase: Awaited<ReturnType<typeof createClient>>, keys: string[]) {
  const results = await Promise.all(
    keys.map((key) => supabase.rpc("has_permission", { p_permission_key: key })),
  );

  return Object.fromEntries(keys.map((key, index) => [key, Boolean(results[index].data)])) as Record<
    string,
    boolean
  >;
}

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  // The Playwright suite runs without Supabase configured; pages render their
  // own unconfigured state, so the shell must not wrap them.
  if (!getSupabaseConfig()) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return <>{children}</>;
  }

  const { tenant } = await getCurrentTenant(supabase, userData.user.id);

  if (!tenant) {
    return <>{children}</>;
  }

  const allowed = await permissions(supabase, [
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
  ]);

  const supply = allowed["procurement.view"] || allowed["procurement.manage"];
  const sales = allowed["sales.view"] || allowed["sales.manage"];
  const transport = allowed["transport.view"] || allowed["transport.manage"];
  const inventory = allowed["inventory.view"] || allowed["inventory.manage"];
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
        { href: "/workspace/inventory/fulfilment", label: "Fulfilment" },
      );
    }

    if (sales) {
      items.push({ href: "/workspace/sales", label: "Sales orders" });
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
        { href: "/workspace/reconciliation", label: "Reconciliation" },
        { href: "/workspace/transport-invoices", label: "Transporter invoices" },
      ],
    });
  }

  if (finance) {
    groups.push({ label: "Finance", items: [{ href: "/workspace/finance", label: "Payments & margin" }] });
  }

  const administration = [];

  if (allowed["users.manage"]) {
    administration.push({ href: "/workspace/access", label: "Access" });
  }

  if (allowed["organisation.manage"]) {
    administration.push({ href: "/workspace/settings", label: "Settings" });
  }

  administration.push({ href: "/workspace/styleguide", label: "Styleguide" });

  groups.push({ label: "Administration", items: administration });

  return (
    <AppShell
      organisationName={tenant.organisationName}
      organisationCode={tenant.organisationCode}
      userEmail={userData.user.email ?? ""}
      groups={groups}
    >
      {children}
    </AppShell>
  );
}
