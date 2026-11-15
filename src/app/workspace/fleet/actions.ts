"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  compartmentSchema,
  driverSchema,
  transporterSchema,
  truckSchema,
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
