"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { createMemberServiceClient } from "@/modules/tenant/member-service-client";
import {
  assignRoleSchema,
  grantAccessSchema,
  idSchema,
  inviteMemberSchema,
  memberStatusSchema,
} from "@/modules/tenant/access-validation";
import { STANDARD_ROLES } from "@/modules/tenant/standard-roles";

export type AccessActionState = {
  error: string | null;
  success: string | null;
  inviteLink?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ManageContext = {
  supabase: SupabaseServerClient;
  tenant: CurrentTenant;
};

async function requireManageAccess(): Promise<{ context?: ManageContext; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "Your session has expired. Sign in again." };
  }

  const { tenant, error: tenantError } = await getCurrentTenant(supabase, data.user.id);

  if (tenantError) {
    return { error: "We could not confirm your membership." };
  }

  if (!tenant) {
    return { error: "Your account has no active membership." };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_permission_key: "users.manage",
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return { error: "You do not have permission to manage access." };
  }

  return { context: { supabase, tenant } };
}

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  return result.error.issues[0]?.message ?? "Check the submitted values.";
}

export async function assignRole(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = assignRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) {
    return { error: error ?? "Access denied.", success: null };
  }

  const { error: insertError } = await context.supabase.from("user_roles").insert({
    organisation_id: context.tenant.organisationId,
    user_id: parsed.data.userId,
    role_id: parsed.data.roleId,
    assigned_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That role is already assigned to this member."
          : "The role could not be assigned.",
      success: null,
    };
  }

  revalidatePath("/workspace/access");
  return { error: null, success: "Role assigned." };
}

export async function revokeRole(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = idSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) {
    return { error: error ?? "Access denied.", success: null };
  }

  const { error: deleteError } = await context.supabase
    .from("user_roles")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId);

  if (deleteError) {
    return { error: "The role could not be revoked.", success: null };
  }

  revalidatePath("/workspace/access");
  return { error: null, success: "Role revoked." };
}

export async function grantAccess(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = grantAccessSchema.safeParse({
    userId: formData.get("userId"),
    locationId: formData.get("locationId"),
    accessLevel: formData.get("accessLevel"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) {
    return { error: error ?? "Access denied.", success: null };
  }

  const { error: insertError } = await context.supabase.from("user_location_access").insert({
    organisation_id: context.tenant.organisationId,
    user_id: parsed.data.userId,
    location_id: parsed.data.locationId,
    access_level: parsed.data.accessLevel,
    assigned_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That location grant already exists."
          : "The location grant could not be created.",
      success: null,
    };
  }

  revalidatePath("/workspace/access");
  return { error: null, success: "Location access granted." };
}

export async function revokeAccess(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = idSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) {
    return { error: error ?? "Access denied.", success: null };
  }

  const { error: deleteError } = await context.supabase
    .from("user_location_access")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId);

  if (deleteError) {
    return { error: "The location grant could not be revoked.", success: null };
  }

  revalidatePath("/workspace/access");
  return { error: null, success: "Location access revoked." };
}

async function recordMemberAudit(input: {
  organisationId: string;
  actorProfileId: string;
  action: string;
  entityId: string;
  newValues: Record<string, unknown>;
}) {
  const service = createMemberServiceClient();

  await service.from("audit_logs").insert({
    organisation_id: input.organisationId,
    user_id: input.actorProfileId,
    action: input.action,
    entity_type: "profiles",
    entity_id: input.entityId,
    new_values: input.newValues,
  });
}

export async function inviteMember(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleId: formData.get("roleId"),
    locationId: formData.get("locationId"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const organisationId = context.tenant.organisationId;
  const service = createMemberServiceClient();

  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("organisation_id", organisationId)
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    return { error: "A member with that email already exists in this company.", success: null };
  }

  const { data: generated, error: inviteError } = await service.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (inviteError || !generated.user) {
    const message = inviteError?.message ?? "";

    return {
      error: message.toLowerCase().includes("already")
        ? "That email already has an account. Ask them to sign in, then assign a role."
        : "The invitation could not be created. Check the email and Supabase auth settings.",
      success: null,
    };
  }

  const inviteLink = generated.properties?.action_link ?? null;

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .insert({
      organisation_id: organisationId,
      auth_user_id: generated.user.id,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      status: "active",
    })
    .select("id")
    .maybeSingle();

  if (profileError || !profile) {
    await service.auth.admin.deleteUser(generated.user.id);
    return { error: "The member profile could not be created, so the invitation was cancelled.", success: null };
  }

  if (parsed.data.roleId) {
    const { error: roleError } = await service.from("user_roles").insert({
      organisation_id: organisationId,
      user_id: profile.id,
      role_id: parsed.data.roleId,
    });

    if (roleError) {
      return {
        error: "The member was created, but the role could not be assigned. Assign it below.",
        success: null,
      };
    }
  }

  if (parsed.data.locationId) {
    await service.from("user_location_access").insert({
      organisation_id: organisationId,
      user_id: profile.id,
      location_id: parsed.data.locationId,
      access_level: "view",
    });
  }

  await recordMemberAudit({
    organisationId,
    actorProfileId: context.tenant.profileId,
    action: "access.member_invited",
    entityId: profile.id,
    newValues: {
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      role_id: parsed.data.roleId ?? null,
      location_id: parsed.data.locationId ?? null,
    },
  });

  revalidatePath("/workspace/access");
  revalidatePath("/workspace");

  return {
    error: null,
    success: `Member created. Share the invitation link with ${parsed.data.email}.`,
    inviteLink,
  };
}

export async function setMemberStatus(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = memberStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  if (parsed.data.userId === context.tenant.profileId) {
    return { error: "You cannot deactivate your own membership.", success: null };
  }

  const service = createMemberServiceClient();

  const { data: target } = await service
    .from("profiles")
    .select("id, full_name, email, status")
    .eq("id", parsed.data.userId)
    .eq("organisation_id", context.tenant.organisationId)
    .maybeSingle();

  if (!target) {
    return { error: "That member is not part of this company.", success: null };
  }

  const active = parsed.data.status === "active";

  const { error: updateError } = await service
    .from("profiles")
    .update({
      status: parsed.data.status,
      deactivated_at: active ? null : new Date().toISOString(),
    })
    .eq("id", parsed.data.userId)
    .eq("organisation_id", context.tenant.organisationId);

  if (updateError) {
    return { error: "The member could not be updated.", success: null };
  }

  await recordMemberAudit({
    organisationId: context.tenant.organisationId,
    actorProfileId: context.tenant.profileId,
    action: active ? "access.member_reactivated" : "access.member_deactivated",
    entityId: parsed.data.userId,
    newValues: { status: parsed.data.status, email: target.email },
  });

  revalidatePath("/workspace/access");
  revalidatePath("/workspace");

  return {
    error: null,
    success: active ? "Member reactivated." : "Member deactivated. Their roles are kept for reactivation.",
  };
}

export async function createStandardRoles(
  _previous: AccessActionState,
  _formData: FormData,
): Promise<AccessActionState> {
  // Required by useActionState; this action has no form fields.
  void _previous;
  void _formData;

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const organisationId = context.tenant.organisationId;

  const { data: permissions, error: permissionError } = await context.supabase
    .from("permissions")
    .select("id, permission_key");

  if (permissionError) {
    return { error: "Permissions could not be loaded.", success: null };
  }

  const permissionIdByKey = new Map(
    ((permissions ?? []) as { id: string; permission_key: string }[]).map((permission) => [
      permission.permission_key,
      permission.id,
    ]),
  );

  const created: string[] = [];

  for (const template of STANDARD_ROLES) {
    const { data: existing } = await context.supabase
      .from("roles")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("name", template.name)
      .maybeSingle();

    let roleId = existing?.id as string | undefined;

    if (!roleId) {
      const { data: inserted, error: insertError } = await context.supabase
        .from("roles")
        .insert({
          organisation_id: organisationId,
          name: template.name,
          description: template.description,
          is_system_role: false,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        return { error: `The ${template.name} role could not be created.`, success: null };
      }

      roleId = inserted.id;
      created.push(template.name);
    }

    const desired = template.permissions
      .map((key) => permissionIdByKey.get(key))
      .filter((id): id is string => Boolean(id));

    const { data: assigned, error: assignedError } = await context.supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (assignedError) {
      return { error: `Existing permissions for ${template.name} could not be read.`, success: null };
    }

    const assignedIds = new Set(
      ((assigned ?? []) as { permission_id: string }[]).map((row) => row.permission_id),
    );
    const missing = desired.filter((permissionId) => !assignedIds.has(permissionId));

    if (missing.length > 0) {
      const { error: mapError } = await context.supabase.from("role_permissions").insert(
        missing.map((permissionId) => ({
          organisation_id: organisationId,
          role_id: roleId,
          permission_id: permissionId,
        })),
      );

      if (mapError) {
        return { error: `Permissions for ${template.name} could not be saved.`, success: null };
      }
    }
  }

  revalidatePath("/workspace/access");

  return {
    error: null,
    success:
      created.length > 0
        ? `Standard roles created: ${created.join(", ")}.`
        : "Standard roles already exist. Any missing permissions were added.",
  };
}

export async function updateRolePermissions(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const roleParsed = idSchema.safeParse({ id: formData.get("roleId") });

  if (!roleParsed.success) {
    return { error: firstIssue(roleParsed), success: null };
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const submitted = Array.from(
    new Set(
      formData
        .getAll("permissionIds")
        .map((value) => String(value))
        .filter((value) => uuidPattern.test(value)),
    ),
  );

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const organisationId = context.tenant.organisationId;
  const roleId = roleParsed.data.id;

  const { data: role } = await context.supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (!role) {
    return { error: "That role is not part of this company.", success: null };
  }

  const { data: permissionRows } = await context.supabase.from("permissions").select("id, permission_key");

  if (!permissionRows) {
    return { error: "Permissions could not be loaded.", success: null };
  }

  const permissionById = new Map(
    (permissionRows as { id: string; permission_key: string }[]).map((permission) => [
      permission.id,
      permission.permission_key,
    ]),
  );

  if (submitted.some((permissionId) => !permissionById.has(permissionId))) {
    return { error: "One of the selected permissions is not available.", success: null };
  }

  const { data: targetRows } = await context.supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  const currentIds = new Set(
    ((targetRows ?? []) as { permission_id: string }[]).map((row) => row.permission_id),
  );
  const desiredIds = new Set(submitted);

  const usersManageId = Array.from(permissionById.entries()).find(
    ([, key]) => key === "users.manage",
  )?.[0];

  if (usersManageId && currentIds.has(usersManageId) && !desiredIds.has(usersManageId)) {
    const { data: otherHolders } = await context.supabase
      .from("role_permissions")
      .select("role_id")
      .eq("organisation_id", organisationId)
      .eq("permission_id", usersManageId)
      .neq("role_id", roleId);

    const retainingRoleIds = new Set(
      ((otherHolders ?? []) as { role_id: string }[]).map((row) => row.role_id),
    );

    const [assignmentsResult, activeProfilesResult] = await Promise.all([
      context.supabase
        .from("user_roles")
        .select("user_id, role_id")
        .eq("organisation_id", organisationId),
      context.supabase
        .from("profiles")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("status", "active"),
    ]);

    const activeProfiles = new Set(
      ((activeProfilesResult.data ?? []) as { id: string }[]).map((profile) => profile.id),
    );
    const assignments = (assignmentsResult.data ?? []) as { user_id: string; role_id: string }[];

    const retainingUsers = new Set(
      assignments
        .filter((assignment) => activeProfiles.has(assignment.user_id))
        .filter((assignment) => retainingRoleIds.has(assignment.role_id))
        .map((assignment) => assignment.user_id),
    );

    if (retainingUsers.size === 0) {
      return {
        error: "At least one active member must keep access management. Add it to another role first.",
        success: null,
      };
    }

    const actorRoles = assignments
      .filter((assignment) => assignment.user_id === context.tenant.profileId)
      .map((assignment) => assignment.role_id);
    const actorRetains = actorRoles.some(
      (assignedRole) => assignedRole !== roleId && retainingRoleIds.has(assignedRole),
    );

    if (actorRoles.includes(roleId) && !actorRetains) {
      return {
        error:
          "You would remove your own access management permission. Ask another administrator to make this change.",
        success: null,
      };
    }
  }

  const toRemove = Array.from(currentIds).filter((permissionId) => !desiredIds.has(permissionId));
  const toAdd = Array.from(desiredIds).filter((permissionId) => !currentIds.has(permissionId));

  if (toRemove.length > 0) {
    const { error: removeError } = await context.supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .in("permission_id", toRemove);

    if (removeError) {
      return { error: "The removed permissions could not be saved.", success: null };
    }
  }

  if (toAdd.length > 0) {
    const { error: addError } = await context.supabase.from("role_permissions").insert(
      toAdd.map((permissionId) => ({
        organisation_id: organisationId,
        role_id: roleId,
        permission_id: permissionId,
      })),
    );

    if (addError) {
      return { error: "The added permissions could not be saved.", success: null };
    }
  }

  const service = createMemberServiceClient();
  await service.from("audit_logs").insert({
    organisation_id: organisationId,
    user_id: context.tenant.profileId,
    action: "access.role_permissions_updated",
    entity_type: "roles",
    entity_id: roleId,
    old_values: {
      role: role.name,
      permission_keys: Array.from(currentIds)
        .map((permissionId) => permissionById.get(permissionId))
        .filter(Boolean),
    },
    new_values: {
      role: role.name,
      permission_keys: Array.from(desiredIds)
        .map((permissionId) => permissionById.get(permissionId))
        .filter(Boolean),
    },
  });

  revalidatePath("/workspace/access");
  revalidatePath(`/workspace/access/roles/${roleId}`);

  return {
    error: null,
    success:
      toAdd.length === 0 && toRemove.length === 0
        ? "No permission changes to save."
        : `Permissions updated for ${role.name}.`,
  };
}
