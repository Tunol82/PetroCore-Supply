"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { assignmentSchema, tripSchema } from "@/modules/transport/validation";

export type DispatchActionState = {
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

function dateToIso(value: string | undefined): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`).toISOString();
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

  if (tenantError) {
    return { error: "We could not confirm your membership." };
  }

  if (!tenant) {
    return { error: "Your account has no active membership." };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_permission_key: "transport.manage",
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return { error: "You do not have permission to manage dispatch." };
  }

  return { context: { supabase, tenant } };
}

export async function createTrip(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = tripSchema.safeParse({
    tripNumber: formData.get("tripNumber"),
    originSupplierDepotId: formData.get("originSupplierDepotId"),
    originLocationId: formData.get("originLocationId"),
    destinationLocationId: formData.get("destinationLocationId"),
    departureDate: formData.get("departureDate"),
    expectedArrivalDate: formData.get("expectedArrivalDate"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trips").insert({
    organisation_id: context.tenant.organisationId,
    trip_number: parsed.data.tripNumber,
    origin_supplier_depot_id: textOrNull(parsed.data.originSupplierDepotId),
    origin_location_id: textOrNull(parsed.data.originLocationId),
    destination_location_id: textOrNull(parsed.data.destinationLocationId),
    departure_time: dateToIso(parsed.data.departureDate),
    expected_arrival: dateToIso(parsed.data.expectedArrivalDate),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That trip number already exists."
          : "The trip could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Trip saved." };
}

export async function assignTrip(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = assignmentSchema.safeParse({
    tripId: formData.get("tripId"),
    truckId: formData.get("truckId"),
    driverId: formData.get("driverId"),
    transporterId: formData.get("transporterId"),
    assignmentRole: formData.get("assignmentRole"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trip_assignments").insert({
    organisation_id: context.tenant.organisationId,
    trip_id: parsed.data.tripId,
    truck_id: parsed.data.truckId,
    driver_id: parsed.data.driverId,
    transporter_id: textOrNull(parsed.data.transporterId),
    assignment_role: parsed.data.assignmentRole,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That trip already has an active primary assignment."
          : "The assignment could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Trip assigned." };
}
