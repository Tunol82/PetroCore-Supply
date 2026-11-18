"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";

export type TripActionState = { error: string | null; success: string | null };

const EXPENSE_TYPES = [
  "fuel",
  "toll",
  "loading",
  "driver_allowance",
  "maintenance",
  "other",
] as const;

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (text.length === 0) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function requireTransportManage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { context: null, error: "Your session has expired." };
  }

  const { tenant, error: tenantError } = await getCurrentTenant(supabase, userData.user.id);

  if (tenantError || !tenant) {
    return { context: null, error: tenantError ?? "No active workspace." };
  }

  const { data: canManage } = await supabase.rpc("has_permission", {
    p_permission_key: "transport.manage",
  });

  if (!canManage) {
    return { context: null, error: "You need transport.manage to change this trip." };
  }

  return { context: { supabase, tenant }, error: null };
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/workspace/dispatch/trips/${tripId}`);
  revalidatePath("/workspace/dispatch");
}

export async function recordTripArrival(
  _previous: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const tripId = String(formData.get("tripId") ?? "").trim();
  const arrivedAt = String(formData.get("arrivedAt") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) {
    return { error: "Select a valid trip.", success: null };
  }

  const arrived = arrivedAt.length > 0 ? new Date(arrivedAt) : null;

  if (!arrived || Number.isNaN(arrived.getTime())) {
    return { error: "Enter a valid arrival date and time.", success: null };
  }

  const odometerEnd = numberOrNull(formData.get("odometerEnd"));

  if (odometerEnd !== null && (Number.isNaN(odometerEnd) || odometerEnd < 0)) {
    return { error: "Arrival odometer must be zero or more.", success: null };
  }

  const { context, error } = await requireTransportManage();
  if (!context) return { error, success: null };

  const { data: trip, error: tripError } = await context.supabase
    .from("trips")
    .select("id, departure_time, odometer_start")
    .eq("id", tripId)
    .eq("organisation_id", context.tenant.organisationId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "That trip is not available to this company.", success: null };
  }

  if (trip.departure_time && arrived.getTime() < new Date(trip.departure_time).getTime()) {
    return { error: "Arrival cannot be before departure.", success: null };
  }

  if (
    odometerEnd !== null &&
    trip.odometer_start !== null &&
    odometerEnd < Number(trip.odometer_start)
  ) {
    return { error: "Arrival odometer cannot be lower than the departure odometer.", success: null };
  }

  const { data: updated, error: updateError } = await context.supabase
    .from("trips")
    .update({
      actual_arrival: arrived.toISOString(),
      ...(odometerEnd !== null ? { odometer_end: odometerEnd } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { error: "The arrival could not be recorded.", success: null };
  }

  revalidateTrip(tripId);
  return { error: null, success: "Arrival recorded." };
}

export async function addTripExpense(
  _previous: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const tripId = String(formData.get("tripId") ?? "").trim();
  const expenseType = String(formData.get("expenseType") ?? "");
  const amount = numberOrNull(formData.get("amount"));
  const litres = numberOrNull(formData.get("litres"));
  const incurredOn = textOrNull(formData.get("incurredOn"));
  const description = textOrNull(formData.get("description"));
  const reference = textOrNull(formData.get("reference"));

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) {
    return { error: "Select a valid trip.", success: null };
  }

  if (!EXPENSE_TYPES.includes(expenseType as (typeof EXPENSE_TYPES)[number])) {
    return { error: "Choose an expense type.", success: null };
  }

  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter an amount above zero.", success: null };
  }

  if (litres !== null && (Number.isNaN(litres) || litres <= 0)) {
    return { error: "Litres must be above zero when entered.", success: null };
  }

  if (incurredOn && Number.isNaN(new Date(incurredOn).getTime())) {
    return { error: "Enter a valid expense date.", success: null };
  }

  const { context, error } = await requireTransportManage();
  if (!context) return { error, success: null };

  const { error: insertError } = await context.supabase.from("trip_expenses").insert({
    organisation_id: context.tenant.organisationId,
    trip_id: tripId,
    expense_type: expenseType,
    amount,
    litres,
    description,
    reference,
    ...(incurredOn ? { incurred_on: incurredOn } : {}),
    recorded_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23503"
          ? "That trip is not available to this company."
          : "The expense could not be recorded.",
      success: null,
    };
  }

  revalidateTrip(tripId);
  return { error: null, success: "Trip expense recorded." };
}
