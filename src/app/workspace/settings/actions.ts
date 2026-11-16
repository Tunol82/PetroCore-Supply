"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";

export type SettingsActionState = {
  error: string | null;
  success: string | null;
};

const resetSchema = z.object({
  confirmation: z.string().trim().min(1, "Type the organisation code to confirm."),
});

export async function resetDemoData(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = resetSchema.safeParse({ confirmation: formData.get("confirmation") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the confirmation.", success: null };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { error: "Your session has expired. Sign in again.", success: null };
  }

  const { tenant, error: tenantError } = await getCurrentTenant(supabase, userData.user.id);

  if (tenantError || !tenant) {
    return { error: "We could not confirm your membership.", success: null };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    p_permission_key: "organisation.manage",
  });

  if (permissionError || !allowed) {
    return { error: "You do not have permission to reset demo data.", success: null };
  }

  if (parsed.data.confirmation !== tenant.organisationCode) {
    return { error: "The confirmation does not match the organisation code.", success: null };
  }

  const { data: evidenceRows } = await supabase.from("delivery_evidence").select("file_path");
  const paths = (evidenceRows ?? []).map((row) => row.file_path).filter(Boolean);

  const { data: counts, error: resetError } = await supabase.rpc("reset_organisation_demo_data", {
    p_confirm: parsed.data.confirmation,
  });

  if (resetError) {
    return {
      error: resetError.message.includes("organisation code")
        ? "The confirmation does not match the organisation code."
        : "The demo data could not be reset. Nothing was deleted.",
      success: null,
    };
  }

  if (paths.length > 0) {
    await supabase.storage.from("delivery-evidence").remove(paths);
  }

  const deleted = Object.values((counts ?? {}) as Record<string, number>).reduce(
    (total, value) => total + Number(value ?? 0),
    0,
  );

  revalidatePath("/workspace/settings");
  revalidatePath("/workspace");
  revalidatePath("/workspace/reconciliation");
  revalidatePath("/workspace/inventory");
  revalidatePath("/workspace/finance");

  return { error: null, success: `Demo data cleared. ${deleted} transaction records removed.` };
}
