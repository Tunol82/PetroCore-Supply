"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import { inventoryReceiptSchema } from "@/modules/inventory/validation";

export type InventoryActionState = {
  error: string | null;
  success: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ManageContext = {
  supabase: SupabaseServerClient;
  tenant: CurrentTenant;
};

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
    p_permission_key: "inventory.manage",
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return { error: "You do not have permission to manage inventory." };
  }

  return { context: { supabase, tenant } };
}

export async function receiveInventoryBatch(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const parsed = inventoryReceiptSchema.safeParse({
    procurementBatchId: formData.get("procurementBatchId"),
    locationId: formData.get("locationId"),
    originalQuantity: formData.get("originalQuantity"),
    landedCostPerUnit: formData.get("landedCostPerUnit"),
    receivedOn: formData.get("receivedOn"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: batch, error: batchError } = await context.supabase
    .from("procurement_batches")
    .select("id, product_id, fulfilment_type, supplier_quantity, received_quantity")
    .eq("id", parsed.data.procurementBatchId)
    .maybeSingle();

  if (batchError) {
    return { error: "We could not load that procurement batch.", success: null };
  }

  if (!batch) {
    return { error: "That procurement batch is not available to this company.", success: null };
  }

  if (batch.fulfilment_type !== "storage_receipt") {
    return {
      error: "Only storage-receipt procurement can be received into inventory.",
      success: null,
    };
  }

  const verifiedQuantity = Number(batch.received_quantity ?? batch.supplier_quantity);

  const { data: priorReceipts, error: priorError } = await context.supabase
    .from("inventory_batches")
    .select("original_quantity")
    .eq("procurement_batch_id", batch.id);

  if (priorError) {
    return { error: "We could not confirm the stock already received for that batch.", success: null };
  }

  const alreadyReceived = (priorReceipts ?? []).reduce(
    (total, receipt) => total + Number(receipt.original_quantity),
    0,
  );
  const outstanding = verifiedQuantity - alreadyReceived;

  if (outstanding <= 0) {
    return {
      error: "The full verified quantity of that procurement batch has already been received.",
      success: null,
    };
  }

  if (parsed.data.originalQuantity > outstanding) {
    return {
      error: `The receipt quantity cannot exceed the outstanding verified quantity of ${new Intl.NumberFormat("en-NG", {
        maximumFractionDigits: 3,
      }).format(outstanding)}.`,
      success: null,
    };
  }

  const receivedAt = parsed.data.receivedOn
    ? new Date(`${parsed.data.receivedOn}T00:00:00Z`).toISOString()
    : undefined;

  const { error: insertError } = await context.supabase.from("inventory_batches").insert({
    organisation_id: context.tenant.organisationId,
    procurement_batch_id: batch.id,
    product_id: batch.product_id,
    location_id: parsed.data.locationId,
    original_quantity: parsed.data.originalQuantity,
    remaining_quantity: parsed.data.originalQuantity,
    landed_cost_per_unit: parsed.data.landedCostPerUnit ?? 0,
    ...(receivedAt ? { received_at: receivedAt } : {}),
    status: "available",
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    if (insertError.message.includes("storage location")) {
      return { error: "Stock can only be received into a storage location.", success: null };
    }

    if (insertError.message.includes("exceeds the outstanding verified quantity")) {
      return {
        error: "The receipt quantity exceeds what is still outstanding for that batch.",
        success: null,
      };
    }

    return { error: "The inventory receipt could not be saved.", success: null };
  }

  revalidatePath("/workspace/inventory");
  return { error: null, success: "Stock received. A receipt movement was posted." };
}
