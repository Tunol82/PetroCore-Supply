import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import {
  AssignRoleForm,
  GrantAccessForm,
  InviteMemberForm,
  MemberStatusForm,
  RevokeForm,
  StandardRolesForm,
} from "./access-forms";
import { PERMISSION_LABELS, STANDARD_ROLES } from "@/modules/tenant/standard-roles";

export const dynamic = "force-dynamic";

type Member = { id: string; full_name: string | null; email: string; status: string };
type Role = { id: string; name: string; description: string | null; is_system_role: boolean };
type Permission = { id: string; permission_key: string };
type RolePermission = { role_id: string; permission_id: string };
type UserRole = { id: string; user_id: string; role_id: string };
type Location = { id: string; location_code: string; location_name: string; status: string };
type Grant = { id: string; user_id: string; location_id: string; access_level: string; status: string };
type AuditEvent = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
};

const TABS = ["members", "roles", "access", "activity"] as const;

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "access.role_assigned": "Role assigned",
  "access.role_revoked": "Role revoked",
  "access.location_granted": "Location access granted",
  "access.location_revoked": "Location access revoked",
};

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function humanise(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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
    p_permission_key: "users.manage",
  });

  const { data: canViewAudit } = await supabase.rpc("has_permission", {
    p_permission_key: "audit.view",
  });

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Not authorised" description="You cannot manage access for this workspace." />
        <p className="text-sm text-[var(--muted)]">
          Access administration requires the{" "}
          <code className="rounded bg-[var(--surface-3)] px-1 py-0.5 text-xs">users.manage</code> permission. Ask a
          workspace administrator if you need it.
        </p>
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const [membersResult, rolesResult, userRolesResult, locationsResult, grantsResult, permissionsResult, rolePermissionsResult] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email, status").order("full_name"),
      supabase.from("roles").select("id, name, description, is_system_role").order("name"),
      supabase.from("user_roles").select("id, user_id, role_id"),
      supabase.from("business_locations").select("id, location_code, location_name, status").order("location_name"),
      supabase.from("user_location_access").select("id, user_id, location_id, access_level, status"),
      supabase.from("permissions").select("id, permission_key").order("permission_key"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);

  const queryError =
    membersResult.error ??
    rolesResult.error ??
    userRolesResult.error ??
    locationsResult.error ??
    grantsResult.error ??
    permissionsResult.error ??
    rolePermissionsResult.error;

  let auditEvents: AuditEvent[] = [];

  if (canViewAudit) {
    const { data: auditData } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, user_id, created_at")
      .like("action", "access.%")
      .order("created_at", { ascending: false })
      .limit(30);

    auditEvents = (auditData ?? []) as AuditEvent[];
  }

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Access" title="Unavailable" description="Access data could not be loaded." />
        <p className="text-sm text-[var(--muted)]">
          No access records were changed. Try again, or ask your administrator to check the workspace.
        </p>
      </div>
    );
  }

  const members = (membersResult.data ?? []) as Member[];
  const roles = (rolesResult.data ?? []) as Role[];
  const userRoles = (userRolesResult.data ?? []) as UserRole[];
  const locations = (locationsResult.data ?? []) as Location[];
  const grants = (grantsResult.data ?? []) as Grant[];
  const permissions = (permissionsResult.data ?? []) as Permission[];
  const rolePermissions = (rolePermissionsResult.data ?? []) as RolePermission[];

  const memberById = new Map(members.map((member) => [member.id, member]));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const permissionKeyById = new Map(permissions.map((permission) => [permission.id, permission.permission_key]));

  const permissionKeysByRole = new Map<string, Set<string>>();
  for (const mapping of rolePermissions) {
    const key = permissionKeyById.get(mapping.permission_id);

    if (!key) {
      continue;
    }

    const current = permissionKeysByRole.get(mapping.role_id) ?? new Set<string>();
    current.add(key);
    permissionKeysByRole.set(mapping.role_id, current);
  }

  const memberCountByRole = new Map<string, number>();
  for (const assignment of userRoles) {
    memberCountByRole.set(assignment.role_id, (memberCountByRole.get(assignment.role_id) ?? 0) + 1);
  }

  const roleNames = new Set(roles.map((role) => role.name));
  const missingStandardRoles = STANDARD_ROLES.filter((template) => !roleNames.has(template.name)).length;

  const rolesByMember = new Map<string, UserRole[]>();
  for (const assignment of userRoles) {
    const current = rolesByMember.get(assignment.user_id) ?? [];
    current.push(assignment);
    rolesByMember.set(assignment.user_id, current);
  }

  const memberOptions = members.map((member) => ({
    id: member.id,
    label: member.full_name ? `${member.full_name} (${member.email})` : member.email,
  }));

  const roleOptions = roles.map((role) => ({ id: role.id, label: role.name }));
  const locationOptions = locations
    .filter((location) => location.status === "active")
    .map((location) => ({
      id: location.id,
      label: `${location.location_name} (${location.location_code})`,
    }));

  const params = await searchParams;
  const requestedTab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "members";
  const tab = requestedTab === "activity" && !canViewAudit ? "members" : requestedTab;

  const membersWithoutRoles = members.filter((member) => (rolesByMember.get(member.id) ?? []).length === 0).length;
  const activeGrants = grants.filter((grant) => grant.status === "active").length;
  const activeLocations = locations.filter((location) => location.status === "active").length;

  const tabs = [
    { href: "/workspace/access?tab=members", label: "Members", count: members.length },
    { href: "/workspace/access?tab=roles", label: "Roles", count: roles.length },
    { href: "/workspace/access?tab=access", label: "Location access", count: grants.length },
    ...(canViewAudit
      ? [{ href: "/workspace/access?tab=activity", label: "Activity", count: auditEvents.length }]
      : []),
  ];
  const activeHref = `/workspace/access?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant administration"
        title={tenant.organisationName}
        description={`${tenant.organisationCode} · members, role assignments and location grants. Every change is enforced by row level security and audited.`}
        actions={<ButtonLink href="/workspace/settings">Settings</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={members.length} hint={`${roles.length} role${roles.length === 1 ? "" : "s"} available`} tone="brand" />
        <StatCard label="Roles assigned" value={userRoles.length} hint="Across all members" />
        <StatCard
          label="Without a role"
          value={membersWithoutRoles}
          hint={membersWithoutRoles === 0 ? "Everyone has access" : "Cannot act until assigned"}
          tone={membersWithoutRoles > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Location grants"
          value={grants.length}
          hint={`${activeGrants} active · ${activeLocations} location${activeLocations === 1 ? "" : "s"} available`}
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "members" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Members and roles"
              description="Roles define which permissions a member holds. Revoking a role takes effect immediately."
            />
            <CardBody>
              {members.length === 0 ? (
                <EmptyState title="No members yet" description="Invite a member to the workspace first." />
              ) : (
                <TableScroll>
                  <Table minWidth={980}>
                    <THead>
                      <TR>
                        <TH>Member</TH>
                        <TH>Status</TH>
                        <TH>Roles</TH>
                        <TH>Membership</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {members.map((member) => {
                        const assignments = rolesByMember.get(member.id) ?? [];

                        return (
                          <TR key={member.id}>
                            <TD>
                              <span className="font-medium">{member.full_name ?? member.email}</span>
                              {member.full_name ? (
                                <span className="block text-xs text-[var(--muted)]">{member.email}</span>
                              ) : null}
                            </TD>
                            <TD>
                              <StatusBadge status={member.status} />
                            </TD>
                            <TD>
                              {assignments.length === 0 ? (
                                <span className="text-xs text-[var(--muted)]">No roles</span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  {assignments.map((assignment) => (
                                    <span key={assignment.id} className="inline-flex items-center gap-2">
                                      <Badge tone={roleById.get(assignment.role_id)?.is_system_role ? "brand" : "neutral"}>
                                        {roleById.get(assignment.role_id)?.name ?? "Unknown role"}
                                      </Badge>
                                      <RevokeForm kind="role" id={assignment.id} />
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TD>
                            <TD>
                              {member.id === tenant.profileId ? (
                                <span className="text-xs text-[var(--muted)]">You</span>
                              ) : (
                                <MemberStatusForm userId={member.id} active={member.status === "active"} />
                              )}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Invite member"
              description="Creates the sign-in account and member profile. Supply does not send email; copy the invitation link and share it."
            />
            <CardBody>
              <InviteMemberForm roles={roleOptions} locations={locationOptions} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="View as role"
              description="Read-only preview of the sidebar and permissions a role would see. Nobody is impersonated."
            />
            <CardBody>
              {roles.length === 0 ? (
                <EmptyState title="No roles in this tenant" description="Roles are provisioned with the tenant." />
              ) : (
                <form method="get" action="/workspace/access/preview" className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label htmlFor="preview-role" className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Role
                    </label>
                    <select
                      id="preview-role"
                      name="roleId"
                      defaultValue={roles[0].id}
                      className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
                  >
                    Open preview
                  </button>
                </form>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Assign a role" description="A member can hold more than one role." />
            <CardBody>
              {roleOptions.length === 0 ? (
                <EmptyState title="No roles in this tenant" description="Roles are provisioned with the tenant." />
              ) : (
                <AssignRoleForm members={memberOptions} roles={roleOptions} />
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "roles" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Roles and permissions"
              description="Roles define what a member can see and do. Preview shows the sidebar and permissions without impersonating anyone."
            />
            <CardBody>
              {roles.length === 0 ? (
                <EmptyState title="No roles in this tenant" description="Create the standard roles below." />
              ) : (
                <TableScroll>
                  <Table minWidth={760}>
                    <THead>
                      <TR>
                        <TH>Role</TH>
                        <TH align="right">Permissions</TH>
                        <TH align="right">Members</TH>
                        <TH>Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {roles.map((role) => {
                        const keys = permissionKeysByRole.get(role.id) ?? new Set<string>();

                        return (
                          <TR key={role.id}>
                            <TD className="font-medium">
                              {role.name}
                              <span className="block text-xs text-[var(--muted)]">
                                {role.description ?? "No description"}
                              </span>
                            </TD>
                            <TD align="right">{keys.size}</TD>
                            <TD align="right">{memberCountByRole.get(role.id) ?? 0}</TD>
                            <TD>
                              <div className="flex flex-wrap items-center gap-2">
                                <ButtonLink
                                  href={`/workspace/access/roles/${role.id}`}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Edit permissions
                                </ButtonLink>
                                <ButtonLink
                                  href={`/workspace/access/preview?roleId=${role.id}`}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Preview
                                </ButtonLink>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Standard roles"
              description="Director, Operations staff and Fleet manager. Provisioning is optional, creates only missing roles and never overwrites an existing one."
            />
            <CardBody>
              <div className="space-y-5">
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Role</TH>
                        <TH>Scope</TH>
                        <TH>Permissions</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {STANDARD_ROLES.map((template) => {
                        const exists = roleNames.has(template.name);

                        return (
                          <TR key={template.name}>
                            <TD className="font-medium">{template.name}</TD>
                            <TD className="text-xs text-[var(--muted)]">{template.description}</TD>
                            <TD className="text-xs">
                              {template.permissions
                                .map((key) => PERMISSION_LABELS[key] ?? key)
                                .join(", ")}
                            </TD>
                            <TD>
                              <Badge tone={exists ? "success" : "neutral"}>
                                {exists ? "Created" : "Not created"}
                              </Badge>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableScroll>
                <StandardRolesForm missing={missingStandardRoles > 0} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Permission matrix"
              description="Effective permissions per role. Ticks come from the role's assigned permissions, not from the template."
            />
            <CardBody>
              <TableScroll>
                <Table minWidth={Math.max(680, 260 + roles.length * 150)}>
                  <THead>
                    <TR>
                      <TH>Permission</TH>
                      {roles.map((role) => (
                        <TH key={role.id}>{role.name}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {permissions.map((permission) => (
                      <TR key={permission.id}>
                        <TD className="text-xs">
                          {PERMISSION_LABELS[permission.permission_key] ?? permission.permission_key}
                          <span className="block text-[var(--muted)]">{permission.permission_key}</span>
                        </TD>
                        {roles.map((role) => {
                          const hasPermission = permissionKeysByRole
                            .get(role.id)
                            ?.has(permission.permission_key);

                          return (
                            <TD key={role.id} className="text-center font-semibold">
                              {hasPermission ? "✓" : "—"}
                            </TD>
                          );
                        })}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "access" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Location access"
              description="Members see a location only when granted, unless their role includes tenant-wide visibility."
            />
            <CardBody>
              {grants.length === 0 ? (
                <EmptyState title="No explicit location grants" description="Grant a location below." />
              ) : (
                <TableScroll>
                  <Table minWidth={860}>
                    <THead>
                      <TR>
                        <TH>Member</TH>
                        <TH>Location</TH>
                        <TH>Level</TH>
                        <TH>Status</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {grants.map((grant) => {
                        const member = memberById.get(grant.user_id);
                        const location = locationById.get(grant.location_id);

                        return (
                          <TR key={grant.id} testId="grant-row">
                            <TD>
                              <span className="font-medium">{member?.full_name ?? member?.email ?? "Unknown member"}</span>
                              {member?.full_name ? (
                                <span className="block text-xs text-[var(--muted)]">{member.email}</span>
                              ) : null}
                            </TD>
                            <TD className="text-xs">
                              {location ? (
                                <>
                                  {location.location_name}
                                  <span className="block text-[var(--muted)]">{location.location_code}</span>
                                </>
                              ) : (
                                "Unknown location"
                              )}
                            </TD>
                            <TD className="text-xs capitalize">{humanise(grant.access_level)}</TD>
                            <TD>
                              <StatusBadge status={grant.status} />
                            </TD>
                            <TD>
                              <RevokeForm kind="access" id={grant.id} />
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Grant location access" description="Access levels follow the location permission model." />
            <CardBody>
              {locationOptions.length === 0 ? (
                <EmptyState title="No active locations" description="Create an active location before granting access." />
              ) : (
                <GrantAccessForm members={memberOptions} locations={locationOptions} />
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "activity" && canViewAudit ? (
        <Card>
          <CardHeader
            title="Recent access activity"
            description="Newest first. Audit records are append-only and cannot be edited."
          />
          <CardBody>
            {auditEvents.length === 0 ? (
              <EmptyState title="No access activity yet" description="Role and location changes appear here." />
            ) : (
              <TableScroll>
                <Table minWidth={860}>
                  <THead>
                    <TR>
                      <TH>Action</TH>
                      <TH>Actor</TH>
                      <TH>Entity</TH>
                      <TH>When</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {auditEvents.map((event) => {
                      const actor = event.user_id ? memberById.get(event.user_id) : undefined;

                      return (
                        <TR key={event.id} testId="audit-row">
                          <TD className="font-medium">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</TD>
                          <TD className="text-xs">{actor?.full_name ?? actor?.email ?? "System"}</TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {humanise(event.entity_type)}
                            {event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ""}
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">{formatAuditTime(event.created_at)}</TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </CardBody>
        </Card>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Every change is enforced by database row level security and recorded against your account. Permission checks run
        on the server; the browser cannot grant itself a role or location.
      </p>
    </div>
  );
}
