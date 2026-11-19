import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Role = { id: string; name: string; description: string | null; is_system_role: boolean };
type Permission = { id: string; permission_key: string; description: string | null };

const MODULES: { group: string; items: { label: string; keys: string[] }[] }[] = [
  {
    group: "Supply",
    items: [
      { label: "Procurement", keys: ["procurement.view", "procurement.manage"] },
      { label: "Inventory", keys: ["inventory.view", "inventory.manage"] },
      { label: "Stock issues", keys: ["inventory.view", "inventory.manage"] },
      { label: "Sales", keys: ["sales.view", "sales.manage"] },
    ],
  },
  {
    group: "Transport",
    items: [
      { label: "Fleet", keys: ["transport.view", "transport.manage"] },
      { label: "Dispatch", keys: ["transport.view", "transport.manage"] },
      { label: "Deliveries", keys: ["transport.view", "transport.manage"] },
      { label: "Trip checks", keys: ["transport.view", "transport.manage"] },
      { label: "Haulage bills", keys: ["transport.view", "transport.manage"] },
    ],
  },
  {
    group: "Finance",
    items: [
      {
        label: "Money",
        keys: ["sales.view", "sales.manage", "procurement.view", "procurement.manage"],
      },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Access", keys: ["users.manage"] },
      { label: "Settings", keys: ["organisation.manage"] },
      { label: "Styleguide", keys: [] },
    ],
  },
];

export default async function RolePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ roleId?: string }>;
}) {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const { supabase, user, tenant, can } = await getWorkspaceContext();

  if (!user) {
    redirect("/login");
  }

  if (!tenant) {
    redirect("/workspace");
  }

  if (!can("users.manage")) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Not authorised" description="Only access administrators can preview a role." />
        <ButtonLink href="/workspace/access">Back to access</ButtonLink>
      </div>
    );
  }

  const [rolesResult, permissionsResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, description, is_system_role")
      .order("name"),
    supabase.from("permissions").select("id, permission_key, description").order("permission_key"),
  ]);

  if (rolesResult.error || permissionsResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Unavailable" description="Roles could not be loaded." />
      </div>
    );
  }

  const roles = (rolesResult.data ?? []) as Role[];
  const permissions = (permissionsResult.data ?? []) as Permission[];

  const params = await searchParams;
  const selectedRole = roles.find((role) => role.id === params.roleId) ?? roles[0] ?? null;

  if (!selectedRole) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="View as role" description="No roles exist in this company yet." />
        <EmptyState title="No roles" description="Create a role before previewing it." />
        <ButtonLink href="/workspace/access">Back to access</ButtonLink>
      </div>
    );
  }

  const { data: grants, error: grantsError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", selectedRole.id);

  if (grantsError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Unavailable" description="Role permissions could not be loaded." />
      </div>
    );
  }

  const permissionById = new Map(permissions.map((permission) => [permission.id, permission.permission_key]));
  const granted = new Set(
    ((grants ?? []) as { permission_id: string }[])
      .map((grant) => permissionById.get(grant.permission_id))
      .filter((key): key is string => Boolean(key)),
  );
  const has = (key: string) => granted.has(key);

  const visibleGroups = MODULES.map((group) => ({
    group: group.group,
    items: group.items.filter((item) => item.keys.length === 0 || item.keys.some(has)),
  })).filter((group) => group.items.length > 0);

  const deniedItems = MODULES.flatMap((group) =>
    group.items
      .filter((item) => item.keys.length > 0 && !item.keys.some(has))
      .map((item) => ({ ...item, group: group.group })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title={`View as ${selectedRole.name}`}
        description="Read-only preview of what this role would see. Nothing is impersonated and no action is performed as another user."
        actions={<ButtonLink href="/workspace/access">Back to access</ButtonLink>}
      />

      <Card>
        <CardBody>
          <form method="get" action="/workspace/access/preview" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="role-preview" className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Role
              </label>
              <select
                id="role-preview"
                name="roleId"
                defaultValue={selectedRole.id}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                    {role.is_system_role ? " · system" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              Preview role
            </button>
          </form>
          {selectedRole.description ? (
            <p className="mt-3 text-xs text-[var(--muted)]">{selectedRole.description}</p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Permissions granted" value={granted.size} hint={`of ${permissions.length} available`} tone="brand" />
        <StatCard label="Modules visible" value={visibleGroups.reduce((sum, group) => sum + group.items.length, 0)} hint="Plus Workspace" />
        <StatCard label="Modules hidden" value={deniedItems.length} hint="Not shown in the sidebar" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader
            title="Sidebar preview"
            description="Exactly the navigation items this role would see, including the always-visible styleguide."
          />
          <CardBody>
            <div className="rounded-[var(--radius)] bg-[var(--sidebar)] p-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Overview</p>
              <p className="mt-1 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-semibold text-white">
                Workspace
              </p>
              {visibleGroups.map((group) => (
                <div key={group.group} className="mt-4">
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    {group.group}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {group.items.map((item) => (
                      <li
                        key={item.label}
                        className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] text-white/85"
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {deniedItems.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Hidden</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {deniedItems.map((item) => (
                    <span
                      key={`${item.group}-${item.label}`}
                      className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[var(--muted)]">Every module is visible to this role.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Permission matrix" description="What the role grants, by permission key." />
          <CardBody>
            <TableScroll>
              <Table minWidth={560}>
                <THead>
                  <TR>
                    <TH>Permission</TH>
                    <TH>Description</TH>
                    <TH>Granted</TH>
                  </TR>
                </THead>
                <TBody>
                  {permissions.map((permission) => (
                    <TR key={permission.id}>
                      <TD className="mono text-xs">{permission.permission_key}</TD>
                      <TD className="text-xs text-[var(--muted)]">{permission.description ?? "—"}</TD>
                      <TD>
                        <Badge tone={has(permission.permission_key) ? "success" : "neutral"}>
                          {has(permission.permission_key) ? "Granted" : "No"}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
