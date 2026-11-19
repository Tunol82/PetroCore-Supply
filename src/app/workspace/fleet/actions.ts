"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  compartmentSchema,
  compartmentUpdateSchema,
  driverSchema,
  driverUpdateSchema,
  fleetStatusSchema,
  transporterSchema,
  transporterUpdateSchema,
  truckSchema,
  truckUpdateSchema,
} from "@/modules/transport/validation";

export type FleetActionState = {
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
    return { error: "You do not have permission to manage transport." };
  }

  return { context: { supabase, tenant } };
}

function duplicateMessage(error: { code?: string }, what: string): string {
  return error.code === "23505" ? `${what} already exists.` : `${what} could not be saved.`;
}

function missingMessage(label: string): string {
  return `That ${label} was not found. It may have been removed.`;
}

type FleetTable = "transporters" | "trucks" | "drivers" | "truck_compartments";

/**
 * Activates or deactivates a fleet master. Trucks keep their richer status
 * (maintenance, retired) through the edit form; this control only moves a
 * record between active and inactive.
 */
async function setFleetStatus(
  table: FleetTable,
  label: string,
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = fleetStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from(table)
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: `The ${label.toLowerCase()} could not be updated.`, success: null };
  }

  if (!updated) {
    return { error: missingMessage(label.toLowerCase()), success: null };
  }

  revalidatePath("/workspace/fleet");

  return {
    error: null,
    success: parsed.data.status === "active" ? `${label} reactivated.` : `${label} deactivated.`,
  };
}

export async function setTransporterStatus(
  previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  return setFleetStatus("transporters", "Transporter", previous, formData);
}

export async function setTruckStatus(
  previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  return setFleetStatus("trucks", "Truck", previous, formData);
}

export async function setDriverStatus(
  previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  return setFleetStatus("drivers", "Driver", previous, formData);
}

export async function setCompartmentStatus(
  previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  return setFleetStatus("truck_compartments", "Compartment", previous, formData);
}

export async function createTransporter(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = transporterSchema.safeParse({
    transporterCode: formData.get("transporterCode"),
    businessName: formData.get("businessName"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    paymentTerms: formData.get("paymentTerms"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("transporters").insert({
    organisation_id: context.tenant.organisationId,
    transporter_code: parsed.data.transporterCode,
    business_name: parsed.data.businessName,
    contact_person: textOrNull(parsed.data.contactPerson),
    phone: textOrNull(parsed.data.phone),
    email: textOrNull(parsed.data.email),
    address: textOrNull(parsed.data.address),
    payment_terms: textOrNull(parsed.data.paymentTerms),
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That transporter code"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Transporter saved." };
}

export async function updateTransporter(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = transporterUpdateSchema.safeParse({
    id: formData.get("id"),
    transporterCode: formData.get("transporterCode"),
    businessName: formData.get("businessName"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    paymentTerms: formData.get("paymentTerms"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("transporters")
    .update({
      transporter_code: parsed.data.transporterCode,
      business_name: parsed.data.businessName,
      contact_person: textOrNull(parsed.data.contactPerson),
      phone: textOrNull(parsed.data.phone),
      email: textOrNull(parsed.data.email),
      address: textOrNull(parsed.data.address),
      payment_terms: textOrNull(parsed.data.paymentTerms),
    })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error:
        updateError.code === "23505"
          ? "That transporter code is already in use."
          : "The transporter could not be updated.",
      success: null,
    };
  }

  if (!updated) {
    return { error: missingMessage("transporter"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Transporter updated." };
}

export async function createTruck(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = truckSchema.safeParse({
    registrationNumber: formData.get("registrationNumber"),
    transporterId: formData.get("transporterId"),
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    capacity: formData.get("capacity"),
    ownershipType: formData.get("ownershipType"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  if (parsed.data.transporterId) {
    const { data: transporter } = await context.supabase
      .from("transporters")
      .select("status")
      .eq("id", parsed.data.transporterId)
      .maybeSingle();

    if (!transporter || transporter.status !== "active") {
      return { error: "That transporter is not active. Choose another or reactivate it.", success: null };
    }
  }

  const { error: insertError } = await context.supabase.from("trucks").insert({
    organisation_id: context.tenant.organisationId,
    transporter_id: textOrNull(parsed.data.transporterId),
    registration_number: parsed.data.registrationNumber,
    make: textOrNull(parsed.data.make),
    model: textOrNull(parsed.data.model),
    year: parsed.data.year ?? null,
    capacity: parsed.data.capacity,
    ownership_type: parsed.data.ownershipType,
    status: parsed.data.status,
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That registration number"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Truck saved." };
}

export async function updateTruck(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = truckUpdateSchema.safeParse({
    id: formData.get("id"),
    registrationNumber: formData.get("registrationNumber"),
    transporterId: formData.get("transporterId"),
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    capacity: formData.get("capacity"),
    ownershipType: formData.get("ownershipType"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("trucks")
    .update({
      transporter_id: textOrNull(parsed.data.transporterId),
      registration_number: parsed.data.registrationNumber,
      make: textOrNull(parsed.data.make),
      model: textOrNull(parsed.data.model),
      year: parsed.data.year ?? null,
      capacity: parsed.data.capacity,
      ownership_type: parsed.data.ownershipType,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error:
        updateError.code === "23505"
          ? "That registration number is already in use."
          : "The truck could not be updated.",
      success: null,
    };
  }

  if (!updated) {
    return { error: missingMessage("truck"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Truck updated." };
}

export async function createCompartment(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = compartmentSchema.safeParse({
    truckId: formData.get("truckId"),
    compartmentNumber: formData.get("compartmentNumber"),
    capacity: formData.get("capacity"),
    productCompatibility: formData.get("productCompatibility"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: truck } = await context.supabase
    .from("trucks")
    .select("status")
    .eq("id", parsed.data.truckId)
    .maybeSingle();

  if (!truck) {
    return { error: missingMessage("truck"), success: null };
  }

  if (truck.status === "inactive" || truck.status === "retired") {
    return { error: "That truck is inactive or retired. Reactivate it before adding a compartment.", success: null };
  }

  const { error: insertError } = await context.supabase.from("truck_compartments").insert({
    organisation_id: context.tenant.organisationId,
    truck_id: parsed.data.truckId,
    compartment_number: parsed.data.compartmentNumber,
    capacity: parsed.data.capacity,
    product_compatibility: textOrNull(parsed.data.productCompatibility),
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That compartment number"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Compartment saved." };
}

export async function updateCompartment(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = compartmentUpdateSchema.safeParse({
    id: formData.get("id"),
    compartmentNumber: formData.get("compartmentNumber"),
    capacity: formData.get("capacity"),
    productCompatibility: formData.get("productCompatibility"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("truck_compartments")
    .update({
      compartment_number: parsed.data.compartmentNumber,
      capacity: parsed.data.capacity,
      product_compatibility: textOrNull(parsed.data.productCompatibility),
    })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error:
        updateError.code === "23505"
          ? "That compartment number is already in use on this truck."
          : "The compartment could not be updated.",
      success: null,
    };
  }

  if (!updated) {
    return { error: missingMessage("compartment"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Compartment updated." };
}

export async function createDriver(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = driverSchema.safeParse({
    transporterId: formData.get("transporterId"),
    driverCode: formData.get("driverCode"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    licenceNumber: formData.get("licenceNumber"),
    licenceExpiry: formData.get("licenceExpiry"),
    driverType: formData.get("driverType"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  if (parsed.data.transporterId) {
    const { data: transporter } = await context.supabase
      .from("transporters")
      .select("status")
      .eq("id", parsed.data.transporterId)
      .maybeSingle();

    if (!transporter || transporter.status !== "active") {
      return { error: "That transporter is not active. Choose another or reactivate it.", success: null };
    }
  }

  const { error: insertError } = await context.supabase.from("drivers").insert({
    organisation_id: context.tenant.organisationId,
    transporter_id: textOrNull(parsed.data.transporterId),
    driver_code: parsed.data.driverCode,
    full_name: parsed.data.fullName,
    phone: textOrNull(parsed.data.phone),
    licence_number: parsed.data.licenceNumber,
    licence_expiry: textOrNull(parsed.data.licenceExpiry),
    driver_type: parsed.data.driverType,
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That driver code"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Driver saved." };
}

export async function updateDriver(
  _previous: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = driverUpdateSchema.safeParse({
    id: formData.get("id"),
    transporterId: formData.get("transporterId"),
    driverCode: formData.get("driverCode"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    licenceNumber: formData.get("licenceNumber"),
    licenceExpiry: formData.get("licenceExpiry"),
    driverType: formData.get("driverType"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: updated, error: updateError } = await context.supabase
    .from("drivers")
    .update({
      transporter_id: textOrNull(parsed.data.transporterId),
      driver_code: parsed.data.driverCode,
      full_name: parsed.data.fullName,
      phone: textOrNull(parsed.data.phone),
      licence_number: parsed.data.licenceNumber,
      licence_expiry: textOrNull(parsed.data.licenceExpiry),
      driver_type: parsed.data.driverType,
    })
    .eq("id", parsed.data.id)
    .eq("organisation_id", context.tenant.organisationId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error:
        updateError.code === "23505"
          ? "That driver code is already in use."
          : "The driver could not be updated.",
      success: null,
    };
  }

  if (!updated) {
    return { error: missingMessage("driver"), success: null };
  }

  revalidatePath("/workspace/fleet");
  return { error: null, success: "Driver updated." };
}
