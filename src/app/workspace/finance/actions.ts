"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { paymentSchema } from "@/modules/finance/validation";

export type FinanceActionState = {
  error: string | null;
  success: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type FinanceContext = {
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

async function requireAccess(direction: "receipt" | "payment"): Promise<{ context?: FinanceContext; error?: string }> {
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

  const permission = direction === "receipt" ? "sales.manage" : "procurement.manage";
  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_permission_key: permission,
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return {
      error:
        direction === "receipt"
          ? "You do not have permission to record customer receipts."
          : "You do not have permission to record supplier or transporter payments.",
    };
  }

  return { context: { supabase, tenant } };
}

export async function recordPayment(
  _previous: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  // Conditional fields are absent from the form for the opposite direction, so
  // normalise every value to a string before validation.
  const value = (key: string) => String(formData.get(key) ?? "");

  const parsed = paymentSchema.safeParse({
    direction: value("direction"),
    customerId: value("customerId"),
    supplierId: value("supplierId"),
    transporterId: value("transporterId"),
    salesOrderId: value("salesOrderId"),
    purchaseOrderId: value("purchaseOrderId"),
    transporterInvoiceId: value("transporterInvoiceId"),
    amount: value("amount"),
    method: value("method"),
    reference: value("reference"),
    paidAt: value("paidAt"),
    notes: value("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireAccess(parsed.data.direction);
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("payments").insert({
    organisation_id: context.tenant.organisationId,
    direction: parsed.data.direction,
    customer_id: parsed.data.direction === "receipt" ? textOrNull(parsed.data.customerId) : null,
    supplier_id: parsed.data.direction === "payment" ? textOrNull(parsed.data.supplierId) : null,
    transporter_id: parsed.data.direction === "payment" ? textOrNull(parsed.data.transporterId) : null,
    sales_order_id: textOrNull(parsed.data.salesOrderId),
    purchase_order_id: textOrNull(parsed.data.purchaseOrderId),
    transporter_invoice_id: textOrNull(parsed.data.transporterInvoiceId),
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: textOrNull(parsed.data.reference),
    paid_at: parsed.data.paidAt ? new Date(`${parsed.data.paidAt}T00:00:00Z`).toISOString() : undefined,
    notes: textOrNull(parsed.data.notes),
    recorded_by: context.tenant.profileId,
  });

  if (insertError) {
    if (insertError.code === "23514") {
      return { error: "The payer and direction do not match.", success: null };
    }

    return { error: "The payment could not be recorded.", success: null };
  }

  revalidatePath("/workspace/finance");
  return { error: null, success: "Payment recorded. No ledger posting was made." };
}
