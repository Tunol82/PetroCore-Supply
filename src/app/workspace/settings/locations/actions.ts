"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { locationSchema, locationStatusSchema, locationUpdateSchema } from "@/modules/tenant/location-validation";

export type LocationActionState = {
  error: string | null;
  success: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ManageContext = {
  supabase: SupabaseServerClient;
  tenant: CurrentTenant;
};

function textOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  return result.error.issues[0]?.message ?? "Check the submitted values.";
}

async function requireManageAccess(): Promise<{ context?: ManageContext; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "Your session has expired. Sign in again." };
  }

  const { tenant, error: tenantError } = await getCurrentTenant(supabase, data.user.id);

  if (tenantError || !tenant) {
    return { error: "We could not confirm your membership." };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_permission_key: "locations.manage",
  });

  if (permissionError || !allowed) {
    return { error: "You do not have permission to manage locations." };
  }

  return { context: { supabase, tenant } };
}

function duplicateMessage(error: { code?: string }, what: string): string {
  return error.code === "23505" ? `${what} already exists.` : `${what} could not be saved.`;
}

export async function createLocation(
  _previous: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = locationSchema.safeParse({
    locationCode: formData.get("locationCode"),
    locationName: formData.get("locationName"),
    locationType: formData.get("locationType"),
    address: formData.get("address"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    isStorageLocation: formData.get("isStorageLocation") === "on",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("business_locations").insert({
    organisation_id: context.tenant.organisationId,
    location_code: parsed.data.locationCode,
    location_name: parsed.data.locationName,
    location_type: parsed.data.locationType,
    address: textOrNull(parsed.data.address),
    contact_person: textOrNull(parsed.data.contactPerson),
    phone: textOrNull(parsed.data.phone),
    is_storage_location: parsed.data.isStorageLocation,
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That location code"), success: null };
  }

  revalidatePath("/workspace/settings/locations");
  revalidatePath("/workspace/settings");
  return { error: null, success: "Location saved." };
}

export async function updateLocation(
  _previous: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = locationUpdateSchema.safeParse({
    id: formData.get("id"),
    locationCode: formData.get("locationCode"),
    locationName: formData.get("locationName"),
    locationType: formData.get("locationType"),
    address: formData.get("address"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    isStorageLocation: formData.get("isStorageLocation") === "on",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("business_locations")
    .update({
      location_code: parsed.data.locationCode,
      location_name: parsed.data.locationName,
      location_type: parsed.data.locationType,
      address: textOrNull(parsed.data.address),
      contact_person: textOrNull(parsed.data.contactPerson),
      phone: textOrNull(parsed.data.phone),
      is_storage_location: parsed.data.isStorageLocation,
    })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error:
        updateError.code === "23505"
          ? "That location code is already in use."
          : "The location could not be updated.",
      success: null,
    };
  }

  if (!updated) {
    return { error: "That location was not found. It may have been removed.", success: null };
  }

  revalidatePath("/workspace/settings/locations");
  revalidatePath("/workspace/settings");
  return { error: null, success: "Location updated." };
}

export async function setLocationStatus(
  _previous: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = locationStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("business_locations")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: "The location could not be updated.", success: null };
  }

  if (!updated) {
    return { error: "That location was not found. It may have been removed.", success: null };
  }

  revalidatePath("/workspace/settings/locations");
  revalidatePath("/workspace/settings");
  return {
    error: null,
    success: parsed.data.status === "active" ? "Location reactivated." : "Location deactivated.",
  };
}
