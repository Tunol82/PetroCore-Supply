"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";

export type RuleActionState = { error: string | null; success: string | null };

const APPROVAL_ACTIONS = ["liability_confirm", "liability_write_off"] as const;
const CLOSURE_POLICIES = ["allow", "warn", "block"] as const;

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

async function requireOrganisationManage() {
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
    p_permission_key: "organisation.manage",
  });

  if (!canManage) {
    return { context: null, error: "You need organisation.manage to change business rules." };
  }

  return { context: { supabase, tenant }, error: null };
}

function revalidateRules() {
  revalidatePath("/workspace/settings/rules");
  revalidatePath("/workspace/settings");
}

export async function createApprovalThreshold(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const action = String(formData.get("action") ?? "");

  if (!APPROVAL_ACTIONS.includes(action as (typeof APPROVAL_ACTIONS)[number])) {
    return { error: "Choose what the threshold applies to.", success: null };
  }

  const minAmount = numberOrNull(formData.get("minAmount")) ?? 0;
  const maxAmount = numberOrNull(formData.get("maxAmount"));
  const permission = textOrNull(formData.get("requiredPermission"));

  if (Number.isNaN(minAmount) || minAmount < 0) {
    return { error: "Enter a starting amount of zero or more.", success: null };
  }

  if (maxAmount !== null && (Number.isNaN(maxAmount) || maxAmount <= minAmount)) {
    return { error: "The upper amount must be greater than the starting amount.", success: null };
  }

  if (!permission) {
    return { error: "Choose the permission required for this tier.", success: null };
  }

  const { context, error } = await requireOrganisationManage();
  if (!context) return { error, success: null };

  const { error: insertError } = await context.supabase.from("approval_thresholds").insert({
    organisation_id: context.tenant.organisationId,
    action,
    min_amount: minAmount,
    max_amount: maxAmount,
    required_permission: permission,
    notes: textOrNull(formData.get("notes")),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23503"
          ? "That permission does not exist."
          : "The approval threshold could not be saved.",
      success: null,
    };
  }

  revalidateRules();
  return { error: null, success: "Approval threshold saved." };
}

export async function setApprovalThresholdActive(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const id = textOrNull(formData.get("id"));
  const active = formData.get("active") === "true";

  if (!id) {
    return { error: "Missing threshold.", success: null };
  }

  const { context, error } = await requireOrganisationManage();
  if (!context) return { error, success: null };

  const { error: updateError } = await context.supabase
    .from("approval_thresholds")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", context.tenant.organisationId);

  if (updateError) {
    return { error: "The threshold could not be updated.", success: null };
  }

  revalidateRules();
  return { error: null, success: active ? "Threshold activated." : "Threshold deactivated." };
}

export async function createChargeCategory(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const code = (textOrNull(formData.get("code")) ?? "").toLowerCase();
  const label = textOrNull(formData.get("label"));
  const sortOrder = numberOrNull(formData.get("sortOrder")) ?? 100;

  if (!/^[a-z0-9_]{2,40}$/.test(code)) {
    return { error: "Use 2–40 characters: lowercase letters, numbers or underscores.", success: null };
  }

  if (!label) {
    return { error: "Enter a label for the category.", success: null };
  }

  if (Number.isNaN(sortOrder)) {
    return { error: "Sort order must be a number.", success: null };
  }

  const { context, error } = await requireOrganisationManage();
  if (!context) return { error, success: null };

  const { error: insertError } = await context.supabase.from("transporter_charge_categories").insert({
    organisation_id: context.tenant.organisationId,
    code,
    label,
    sort_order: sortOrder,
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That category code is already in use."
          : "The charge category could not be saved.",
      success: null,
    };
  }

  revalidateRules();
  revalidatePath("/workspace/transport-invoices");
  return { error: null, success: "Charge category saved." };
}

export async function setChargeCategoryActive(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const id = textOrNull(formData.get("id"));
  const active = formData.get("active") === "true";

  if (!id) {
    return { error: "Missing charge category.", success: null };
  }

  const { context, error } = await requireOrganisationManage();
  if (!context) return { error, success: null };

  const { error: updateError } = await context.supabase
    .from("transporter_charge_categories")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", context.tenant.organisationId);

  if (updateError) {
    return { error: "The charge category could not be updated.", success: null };
  }

  revalidateRules();
  revalidatePath("/workspace/transport-invoices");
  return { error: null, success: active ? "Category activated." : "Category deactivated." };
}

export async function saveOperatingPolicy(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const closurePolicy = String(formData.get("tripClosurePolicy") ?? "");

  if (!CLOSURE_POLICIES.includes(closurePolicy as (typeof CLOSURE_POLICIES)[number])) {
    return { error: "Choose a trip closure policy.", success: null };
  }

  const overridePermission = textOrNull(formData.get("closureOverridePermission"));
  const agingDays = numberOrNull(formData.get("unresolvedAgingDays"));

  if (!overridePermission) {
    return { error: "Choose the permission allowed to override closure.", success: null };
  }

  if (agingDays === null || Number.isNaN(agingDays) || agingDays < 1 || agingDays > 365) {
    return { error: "Aging days must be between 1 and 365.", success: null };
  }

  const { context, error } = await requireOrganisationManage();
  if (!context) return { error, success: null };

  const { error: upsertError } = await context.supabase.from("operating_policies").upsert(
    {
      organisation_id: context.tenant.organisationId,
      trip_closure_policy: closurePolicy,
      closure_override_permission: overridePermission,
      unresolved_aging_days: Math.round(agingDays),
      default_correction_method: textOrNull(formData.get("defaultCorrectionMethod")),
      updated_by: context.tenant.profileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organisation_id" },
  );

  if (upsertError) {
    return { error: "The operating policy could not be saved.", success: null };
  }

  revalidateRules();
  revalidatePath("/workspace/dispatch");
  revalidatePath("/workspace/deliveries");
  return { error: null, success: "Operating policy saved." };
}
