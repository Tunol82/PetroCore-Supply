import { notFound, redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { RolePermissionsForm, type PermissionChoice } from "../../access-forms";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/modules/tenant/standard-roles";

export const dynamic = "force-dynamic";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
};

type Permission = { id: string; permission_key: string };

export default async function RolePermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

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
        <PageHeader eyebrow="Access" title="Not authorised" description="Only access administrators can edit role permissions." />
        <ButtonLink href="/workspace/access">Back to access</ButtonLink>
      </div>
    );
  }

  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id, name, description, is_system_role")
    .eq("id", id)
    .maybeSingle();

  if (roleError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Unavailable" description="This role could not be loaded." />
        <ButtonLink href="/workspace/access?tab=roles">Back to roles</ButtonLink>
      </div>
    );
  }

  if (!roleData) {
    notFound();
  }

  const role = roleData as Role;

  const [permissionsResult, rolePermissionsResult, assignmentsResult] = await Promise.all([
    supabase.from("permissions").select("id, permission_key").order("permission_key"),
    supabase.from("role_permissions").select("permission_id").eq("role_id", role.id),
    supabase.from("user_roles").select("user_id").eq("role_id", role.id),
  ]);

  if (permissionsResult.error || rolePermissionsResult.error || assignmentsResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Unavailable" description="Role permissions could not be loaded." />
        <ButtonLink href="/workspace/access?tab=roles">Back to roles</ButtonLink>
      </div>
    );
  }

  const permissions = (permissionsResult.data ?? []) as Permission[];
  const permissionByKey = new Map(permissions.map((permission) => [permission.permission_key, permission]));
  const selectedIds = ((rolePermissionsResult.data ?? []) as { permission_id: string }[]).map(
    (row) => row.permission_id,
  );
  const memberCount = (assignmentsResult.data ?? []).length;

  const groups = PERMISSION_GROUPS.map((group) => ({
    label: group.label,
    permissions: group.keys
      .map((key): PermissionChoice | null => {
        const permission = permissionByKey.get(key);

        return permission
          ? { id: permission.id, key: permission.permission_key, label: PERMISSION_LABELS[key] ?? key }
          : null;
      })
      .filter((value): value is PermissionChoice => Boolean(value)),
  })).filter((group) => group.permissions.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Access · ${role.name}`}
        title={role.name}
        description={
          role.description ??
          "Choose exactly what this role can view and change. Changes take effect on the member's next request."
        }
        actions={
          <>
            <ButtonLink href="/workspace/access?tab=roles">Back to roles</ButtonLink>
            <ButtonLink href={`/workspace/access/preview?roleId=${role.id}`}>Preview sidebar</ButtonLink>
          </>
        }
      />

      {role.name === "Administrator" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This is the tenant Admin role. Removing access management here can lock the tenant out; the server blocks the
          change when no other active member retains it.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Permissions"
          description="Tick what this role may do. Every permission is enforced server-side; the sidebar is only a reflection."
        />
        <CardBody>
          <RolePermissionsForm
            roleId={role.id}
            groups={groups}
            selectedIds={selectedIds}
            memberCount={memberCount}
          />
        </CardBody>
      </Card>
    </div>
  );
}
