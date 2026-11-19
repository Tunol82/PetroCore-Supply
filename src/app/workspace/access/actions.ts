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
