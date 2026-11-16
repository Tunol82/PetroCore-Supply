"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { transporterInvoiceLineSchema, transporterInvoiceSchema } from "@/modules/finance/validation";

export type InvoiceActionState = {
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
    return { error: "You do not have permission to record transporter invoices." };
  }

  return { context: { supabase, tenant } };
}

export async function createTransporterInvoice(
  _previous: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = transporterInvoiceSchema.safeParse({
    transporterId: formData.get("transporterId"),
    tripId: formData.get("tripId"),
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    subtotal: formData.get("subtotal"),
    taxAmount: formData.get("taxAmount"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("transporter_invoices").insert({
    organisation_id: context.tenant.organisationId,
    transporter_id: parsed.data.transporterId,
    trip_id: textOrNull(parsed.data.tripId),
    invoice_number: parsed.data.invoiceNumber,
    invoice_date: parsed.data.invoiceDate,
    subtotal: parsed.data.subtotal,
    tax_amount: parsed.data.taxAmount ?? 0,
    notes: textOrNull(parsed.data.notes),
    recorded_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That transporter has already submitted an invoice with that number."
          : "The invoice could not be recorded.",
      success: null,
    };
  }

  revalidatePath("/workspace/transport-invoices");
  return { error: null, success: "Invoice recorded. Liability remains unassessed." };
}

export async function addTransporterInvoiceLine(
  _previous: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = transporterInvoiceLineSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitRate: formData.get("unitRate"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("transporter_invoice_lines").insert({
    organisation_id: context.tenant.organisationId,
    invoice_id: parsed.data.invoiceId,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_rate: parsed.data.unitRate,
  });

  if (insertError) {
    return { error: "The invoice line could not be recorded.", success: null };
  }

  revalidatePath("/workspace/transport-invoices");
  return { error: null, success: "Invoice line recorded." };
}
