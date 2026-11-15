"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { assignRoleSchema, grantAccessSchema, idSchema } from "@/modules/tenant/access-validation";

export type AccessActionState = {
  error: string | null;
  success: string | null;
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
