"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  assignmentSchema,
  deliverySchema,
  evidenceFileExtension,
  evidenceSchema,
  loadingAllocationSchema,
  loadingRecordSchema,
  releaseAssignmentSchema,
  tripSchema,
  validateEvidenceFile,
} from "@/modules/transport/validation";

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
    if (insertError.code === "23505") {
      return { error: "That trip already has an active primary assignment.", success: null };
    }

    if (insertError.message.includes("truck already has an active assignment")) {
      return { error: "That truck is already assigned to an active trip. Release it first.", success: null };
    }

    if (insertError.message.includes("driver already has an active assignment")) {
      return { error: "That driver is already assigned to an active trip. Release them first.", success: null };
    }

    if (insertError.message.includes("cancelled trips cannot be assigned")) {
      return { error: "A cancelled trip cannot be assigned.", success: null };
    }

    return { error: "The assignment could not be saved.", success: null };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Trip assigned." };
}

export async function releaseAssignment(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = releaseAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("release_trip_assignment", {
    p_assignment_id: parsed.data.assignmentId,
  });

  if (rpcError) {
    return {
      error: rpcError.message.includes("already been released")
        ? "That assignment has already been released."
        : "The assignment could not be released.",
      success: null,
    };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Assignment released. The truck and driver are available again." };
}

export async function createLoadingRecord(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = loadingRecordSchema.safeParse({
    tripId: formData.get("tripId"),
    compartmentId: formData.get("compartmentId"),
    productId: formData.get("productId"),
    loadedQuantity: formData.get("loadedQuantity"),
    loadingTicket: formData.get("loadingTicket"),
    sealNumber: formData.get("sealNumber"),
    loadingDate: formData.get("loadingDate"),
    observedTemperatureC: formData.get("observedTemperatureC"),
    density15c: formData.get("density15c"),
    correctionMethod: formData.get("correctionMethod"),
    correctionFactor: formData.get("correctionFactor"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trip_loading_records").insert({
    organisation_id: context.tenant.organisationId,
    trip_id: parsed.data.tripId,
    compartment_id: parsed.data.compartmentId,
    product_id: parsed.data.productId,
    loaded_quantity: parsed.data.loadedQuantity,
    loading_ticket: textOrNull(parsed.data.loadingTicket),
    seal_number: textOrNull(parsed.data.sealNumber),
    loading_time: dateToIso(parsed.data.loadingDate) ?? new Date().toISOString(),
    observed_temperature_c: parsed.data.observedTemperatureC ?? null,
    density_15c: parsed.data.density15c ?? null,
    correction_method: textOrNull(parsed.data.correctionMethod),
    correction_factor: parsed.data.correctionFactor ?? null,
    officer_id: context.tenant.profileId,
  });

  if (insertError) {
    return { error: loadingErrorMessage(insertError), success: null };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Loading record saved." };
}

export async function addLoadingAllocation(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = loadingAllocationSchema.safeParse({
    loadingRecordId: formData.get("loadingRecordId"),
    procurementBatchId: formData.get("procurementBatchId"),
    salesOrderItemId: formData.get("salesOrderItemId"),
    productId: formData.get("productId"),
    allocatedQuantity: formData.get("allocatedQuantity"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase
    .from("trip_loading_procurement_allocations")
    .insert({
      organisation_id: context.tenant.organisationId,
      trip_loading_record_id: parsed.data.loadingRecordId,
      procurement_batch_id: parsed.data.procurementBatchId,
      sales_order_item_id: textOrNull(parsed.data.salesOrderItemId),
      product_id: parsed.data.productId,
      allocated_quantity: parsed.data.allocatedQuantity,
      created_by: context.tenant.profileId,
    });

  if (insertError) {
    return { error: loadingErrorMessage(insertError), success: null };
  }

  revalidatePath("/workspace/dispatch");
  return { error: null, success: "Loading allocation saved." };
}

function loadingErrorMessage(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";

  if (
    message.includes("exceeds") ||
    message.includes("does not match") ||
    message.includes("not found")
  ) {
    return message;
  }

  if (error.code === "23505") {
    return "That procurement batch is already allocated to this loading record.";
  }

  return "The record could not be saved. Check the quantities and try again.";
}

export async function recordDelivery(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = deliverySchema.safeParse({
    tripId: formData.get("tripId"),
    salesOrderItemId: formData.get("salesOrderItemId"),
    tripLoadingRecordId: formData.get("tripLoadingRecordId"),
    customerLocationId: formData.get("customerLocationId"),
    productId: formData.get("productId"),
    deliveredQuantity: formData.get("deliveredQuantity"),
    customerConfirmedQuantity: formData.get("customerConfirmedQuantity"),
    deliveryStatus: formData.get("deliveryStatus"),
    waybillReference: formData.get("waybillReference"),
    customerAcknowledgement: formData.get("customerAcknowledgement"),
    deliveryDate: formData.get("deliveryDate"),
    observedTemperatureC: formData.get("observedTemperatureC"),
    density15c: formData.get("density15c"),
    correctionMethod: formData.get("correctionMethod"),
    correctionFactor: formData.get("correctionFactor"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trip_delivery_records").insert({
    organisation_id: context.tenant.organisationId,
    trip_id: parsed.data.tripId,
    sales_order_item_id: parsed.data.salesOrderItemId,
    trip_loading_record_id: textOrNull(parsed.data.tripLoadingRecordId),
    customer_location_id: parsed.data.customerLocationId,
    product_id: parsed.data.productId,
    delivered_quantity: parsed.data.deliveredQuantity,
    customer_confirmed_quantity: parsed.data.customerConfirmedQuantity ?? null,
    delivery_status: parsed.data.deliveryStatus,
    waybill_reference: textOrNull(parsed.data.waybillReference),
    customer_acknowledgement: textOrNull(parsed.data.customerAcknowledgement),
    delivery_time: dateToIso(parsed.data.deliveryDate) ?? new Date().toISOString(),
    observed_temperature_c: parsed.data.observedTemperatureC ?? null,
    density_15c: parsed.data.density15c ?? null,
    correction_method: textOrNull(parsed.data.correctionMethod),
    correction_factor: parsed.data.correctionFactor ?? null,
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return { error: deliveryErrorMessage(insertError), success: null };
  }

  revalidatePath("/workspace/deliveries");
  return { error: null, success: "Delivery recorded." };
}

export async function addDeliveryEvidence(
  _previous: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const parsed = evidenceSchema.safeParse({
    deliveryRecordId: formData.get("deliveryRecordId"),
    evidenceType: formData.get("evidenceType"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "Choose a file to upload.", success: null };
  }

  const fileError = validateEvidenceFile(file);

  if (fileError) {
    return { error: fileError, success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: delivery, error: deliveryError } = await context.supabase
    .from("trip_delivery_records")
    .select("id")
    .eq("id", parsed.data.deliveryRecordId)
    .maybeSingle();

  if (deliveryError || !delivery) {
    return { error: "That delivery record is not available to this company.", success: null };
  }

  const path = `${context.tenant.organisationId}/${delivery.id}/${crypto.randomUUID()}.${evidenceFileExtension(
    file.type,
  )}`;

  const { error: uploadError } = await context.supabase.storage
    .from("delivery-evidence")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("bucket not found")) {
      return { error: "Evidence storage is not configured yet.", success: null };
    }

    if (uploadError.message.toLowerCase().includes("too large")) {
      return { error: "The file cannot be larger than 5 MB.", success: null };
    }

    return { error: "The file could not be uploaded.", success: null };
  }

  const { error: insertError } = await context.supabase.from("delivery_evidence").insert({
    organisation_id: context.tenant.organisationId,
    trip_delivery_record_id: delivery.id,
    evidence_type: parsed.data.evidenceType,
    file_path: path,
    file_size: file.size,
    content_type: file.type,
    original_filename: file.name.slice(0, 255),
    notes: textOrNull(parsed.data.notes),
    uploaded_by: context.tenant.profileId,
  });

  if (insertError) {
    await context.supabase.storage.from("delivery-evidence").remove([path]);
    return { error: "The evidence could not be recorded, so the upload was discarded.", success: null };
  }

  revalidatePath("/workspace/deliveries");
  return { error: null, success: "Evidence uploaded." };
}

function deliveryErrorMessage(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";

  if (
    message.includes("does not match") ||
    message.includes("exceed") ||
    message.includes("belong") ||
    message.includes("not found")
  ) {
    return message;
  }

  return "The delivery could not be recorded. Check the quantities and references.";
}

