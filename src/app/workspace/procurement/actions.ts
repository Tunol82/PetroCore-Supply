"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { batchSchema, depotSchema, productSchema, supplierSchema } from "@/modules/procurement/validation";

export type ProcurementActionState = {
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
    p_permission_key: "procurement.manage",
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return { error: "You do not have permission to manage procurement." };
  }

  return { context: { supabase, tenant } };
}

function duplicateMessage(error: { code?: string }, what: string): string {
  return error.code === "23505" ? `${what} already exists.` : `${what} could not be saved.`;
}

export async function createSupplier(
  _previous: ProcurementActionState,
  formData: FormData,
): Promise<ProcurementActionState> {
  const parsed = supplierSchema.safeParse({
    supplierCode: formData.get("supplierCode"),
    name: formData.get("name"),
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

  const { error: insertError } = await context.supabase.from("suppliers").insert({
    organisation_id: context.tenant.organisationId,
    supplier_code: parsed.data.supplierCode,
    name: parsed.data.name,
    contact_person: textOrNull(parsed.data.contactPerson),
    phone: textOrNull(parsed.data.phone),
    email: textOrNull(parsed.data.email),
    address: textOrNull(parsed.data.address),
    payment_terms: textOrNull(parsed.data.paymentTerms),
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That supplier code"), success: null };
  }

  revalidatePath("/workspace/procurement");
  return { error: null, success: "Supplier saved." };
}

export async function createDepot(
  _previous: ProcurementActionState,
  formData: FormData,
): Promise<ProcurementActionState> {
  const parsed = depotSchema.safeParse({
    supplierId: formData.get("supplierId"),
    depotCode: formData.get("depotCode"),
    name: formData.get("name"),
    locationDescription: formData.get("locationDescription"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("supplier_depots").insert({
    organisation_id: context.tenant.organisationId,
    supplier_id: parsed.data.supplierId,
    depot_code: parsed.data.depotCode,
    name: parsed.data.name,
    location_description: textOrNull(parsed.data.locationDescription),
    contact_person: textOrNull(parsed.data.contactPerson),
    phone: textOrNull(parsed.data.phone),
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That depot code"), success: null };
  }

  revalidatePath("/workspace/procurement");
  return { error: null, success: "Depot saved." };
}

export async function createProduct(
  _previous: ProcurementActionState,
  formData: FormData,
): Promise<ProcurementActionState> {
  const parsed = productSchema.safeParse({
    productCode: formData.get("productCode"),
    productName: formData.get("productName"),
    productType: formData.get("productType"),
    unitOfMeasure: formData.get("unitOfMeasure") || "litres",
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("products").insert({
    organisation_id: context.tenant.organisationId,
    product_code: parsed.data.productCode,
    product_name: parsed.data.productName,
    product_type: parsed.data.productType,
    unit_of_measure: parsed.data.unitOfMeasure,
    description: textOrNull(parsed.data.description),
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That product code"), success: null };
  }

  revalidatePath("/workspace/procurement");
  return { error: null, success: "Product saved." };
}

export async function recordBatch(
  _previous: ProcurementActionState,
  formData: FormData,
): Promise<ProcurementActionState> {
  const parsed = batchSchema.safeParse({
    batchNumber: formData.get("batchNumber"),
    supplierId: formData.get("supplierId"),
    supplierDepotId: formData.get("supplierDepotId"),
    productId: formData.get("productId"),
    supplierQuantity: formData.get("supplierQuantity"),
    loadedQuantity: formData.get("loadedQuantity"),
    receivedQuantity: formData.get("receivedQuantity"),
    fulfilmentType: formData.get("fulfilmentType"),
    supplierInvoiceNumber: formData.get("supplierInvoiceNumber"),
    supplierLoadingTicket: formData.get("supplierLoadingTicket"),
    loadingDate: formData.get("loadingDate"),
    receiptDate: formData.get("receiptDate"),
    receivedAtLocationId: formData.get("receivedAtLocationId"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: depot } = await context.supabase
    .from("supplier_depots")
    .select("supplier_id")
    .eq("id", parsed.data.supplierDepotId)
    .maybeSingle();

  if (!depot || depot.supplier_id !== parsed.data.supplierId) {
    return { error: "The selected depot does not belong to that supplier.", success: null };
  }

  const { error: insertError } = await context.supabase.from("procurement_batches").insert({
    organisation_id: context.tenant.organisationId,
    batch_number: parsed.data.batchNumber,
    supplier_id: parsed.data.supplierId,
    supplier_depot_id: parsed.data.supplierDepotId,
    product_id: parsed.data.productId,
    supplier_quantity: parsed.data.supplierQuantity,
    loaded_quantity: parsed.data.loadedQuantity ?? null,
    received_quantity: parsed.data.receivedQuantity ?? null,
    received_at_location_id: textOrNull(parsed.data.receivedAtLocationId),
    fulfilment_type: parsed.data.fulfilmentType,
    supplier_invoice_number: textOrNull(parsed.data.supplierInvoiceNumber),
    supplier_loading_ticket: textOrNull(parsed.data.supplierLoadingTicket),
    loading_date: dateToIso(parsed.data.loadingDate),
    receipt_date: dateToIso(parsed.data.receiptDate),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That batch reference already exists."
          : "The procurement batch could not be recorded.",
      success: null,
    };
  }

  revalidatePath("/workspace/procurement");
  return { error: null, success: "Procurement batch recorded." };
}
