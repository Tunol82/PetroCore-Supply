"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  deleteToleranceRuleSchema,
  discrepancySchema,
  investigationSchema,
  liabilityConfirmationSchema,
  liabilityRejectionSchema,
  reconciliationItemSchema,
  reconciliationSchema,
  toleranceRuleSchema,
} from "@/modules/transport/validation";

export type ReconciliationActionState = {
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
    return { error: "You do not have permission to manage reconciliation." };
  }

  return { context: { supabase, tenant } };
}

export async function createReconciliation(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = reconciliationSchema.safeParse({
    tripId: formData.get("tripId"),
    reconciliationNumber: formData.get("reconciliationNumber"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trip_reconciliations").insert({
    organisation_id: context.tenant.organisationId,
    trip_id: parsed.data.tripId,
    reconciliation_number: parsed.data.reconciliationNumber,
    status: parsed.data.status,
    notes: textOrNull(parsed.data.notes),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That reconciliation number or trip already has a reconciliation."
          : "The reconciliation could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Reconciliation saved." };
}

export async function addReconciliationItem(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = reconciliationItemSchema.safeParse({
    reconciliationId: formData.get("reconciliationId"),
    tripLoadingRecordId: formData.get("tripLoadingRecordId"),
    tripDeliveryRecordId: formData.get("tripDeliveryRecordId"),
    productId: formData.get("productId"),
    loadedQuantity: formData.get("loadedQuantity"),
    deliveredQuantity: formData.get("deliveredQuantity"),
    reconciliationStatus: formData.get("reconciliationStatus"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("trip_reconciliation_items").insert({
    organisation_id: context.tenant.organisationId,
    reconciliation_id: parsed.data.reconciliationId,
    trip_loading_record_id: textOrNull(parsed.data.tripLoadingRecordId),
    trip_delivery_record_id: textOrNull(parsed.data.tripDeliveryRecordId),
    product_id: parsed.data.productId,
    loaded_quantity: parsed.data.loadedQuantity,
    delivered_quantity: parsed.data.deliveredQuantity,
    reconciliation_status: parsed.data.reconciliationStatus,
    notes: textOrNull(parsed.data.notes),
  });

  if (insertError) {
    return { error: "The reconciliation item could not be saved.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Reconciliation item saved." };
}

export async function reportDiscrepancy(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = discrepancySchema.safeParse({
    reconciliationItemId: formData.get("reconciliationItemId"),
    discrepancyType: formData.get("discrepancyType"),
    expectedQuantity: formData.get("expectedQuantity"),
    actualQuantity: formData.get("actualQuantity"),
    provisionalFinancialImpact: formData.get("provisionalFinancialImpact"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("delivery_discrepancies").insert({
    organisation_id: context.tenant.organisationId,
    reconciliation_item_id: parsed.data.reconciliationItemId,
    discrepancy_type: parsed.data.discrepancyType,
    expected_quantity: parsed.data.expectedQuantity,
    actual_quantity: parsed.data.actualQuantity,
    provisional_financial_impact: parsed.data.provisionalFinancialImpact ?? null,
    status: parsed.data.status,
    reported_by: context.tenant.profileId,
  });

  if (insertError) {
    return { error: "The discrepancy could not be recorded.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Discrepancy recorded." };
}

export async function recordInvestigation(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = investigationSchema.safeParse({
    discrepancyId: formData.get("discrepancyId"),
    findings: formData.get("findings"),
    responsiblePartyType: formData.get("responsiblePartyType"),
    responsibilityStatus: formData.get("responsibilityStatus"),
    resolution: formData.get("resolution"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("discrepancy_investigations").insert({
    organisation_id: context.tenant.organisationId,
    discrepancy_id: parsed.data.discrepancyId,
    findings: textOrNull(parsed.data.findings),
    responsible_party_type: parsed.data.responsiblePartyType,
    responsibility_status: parsed.data.responsibilityStatus,
    resolution: textOrNull(parsed.data.resolution),
    investigator_id: context.tenant.profileId,
  });

  if (insertError) {
    return { error: "The investigation could not be recorded.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Investigation recorded." };
}

export async function confirmLiability(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = liabilityConfirmationSchema.safeParse({
    discrepancyId: formData.get("discrepancyId"),
    unitCost: formData.get("unitCost"),
    recoveryMethod: formData.get("recoveryMethod"),
    invoiceId: formData.get("invoiceId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("confirm_discrepancy_liability", {
    p_discrepancy_id: parsed.data.discrepancyId,
    p_unit_cost: parsed.data.unitCost ?? null,
    p_recovery_method: parsed.data.recoveryMethod,
    p_invoice_id: textOrNull(parsed.data.invoiceId),
    p_note: textOrNull(parsed.data.note),
  });

  if (rpcError) {
    if (rpcError.message.includes("only a shortage")) {
      return { error: "Only a shortage can become a liability.", success: null };
    }

    if (rpcError.message.includes("no landed cost is available")) {
      return { error: "No landed cost is available for this trip. Enter a unit cost.", success: null };
    }

    if (rpcError.message.includes("not linked to the reconciled trip")) {
      return { error: "That invoice is not linked to the reconciled trip.", success: null };
    }

    if (rpcError.message.includes("already has a confirmed liability")) {
      return { error: "That discrepancy already has a confirmed liability.", success: null };
    }

    return { error: "The liability could not be confirmed.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Liability confirmed at the recorded cost." };
}

export async function rejectLiability(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = liabilityRejectionSchema.safeParse({
    discrepancyId: formData.get("discrepancyId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("reject_discrepancy_liability", {
    p_discrepancy_id: parsed.data.discrepancyId,
    p_note: parsed.data.note,
  });

  if (rpcError) {
    if (rpcError.message.includes("confirmed liability")) {
      return { error: "A confirmed liability cannot be rejected.", success: null };
    }

    return { error: "The liability could not be rejected.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Liability rejected with a reason." };
}

export async function createToleranceRule(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = toleranceRuleSchema.safeParse({
    productId: formData.get("productId"),
    basis: formData.get("basis"),
    percentage: formData.get("percentage"),
    absoluteQuantity: formData.get("absoluteQuantity"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("tolerance_rules").insert({
    organisation_id: context.tenant.organisationId,
    product_id: textOrNull(parsed.data.productId),
    basis: parsed.data.basis,
    percentage: parsed.data.basis === "absolute" ? null : parsed.data.percentage ?? null,
    absolute_quantity: parsed.data.basis === "percentage" ? null : parsed.data.absoluteQuantity ?? null,
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "A tolerance rule already exists for that product."
          : "The tolerance rule could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Tolerance rule saved. New reconciliation items are classified automatically." };
}

export async function deleteToleranceRule(
  _previous: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const parsed = deleteToleranceRuleSchema.safeParse({ ruleId: formData.get("ruleId") });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: deleteError } = await context.supabase
    .from("tolerance_rules")
    .delete()
    .eq("id", parsed.data.ruleId);

  if (deleteError) {
    return { error: "The tolerance rule could not be removed.", success: null };
  }

  revalidatePath("/workspace/reconciliation");
  return { error: null, success: "Tolerance rule removed." };
}
