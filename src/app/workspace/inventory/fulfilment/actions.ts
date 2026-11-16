"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  issueLineSchema,
  issueSchema,
  postIssueSchema,
  releaseReservationSchema,
  reservationItemSchema,
  reservationSchema,
  reverseIssueSchema,
} from "@/modules/inventory/validation";

export type FulfilmentActionState = {
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

function uuidOrNull(value: string | undefined): string | null {
  const trimmed = textOrNull(value);
  return trimmed && /^[0-9a-fA-F-]{36}$/.test(trimmed) ? trimmed : null;
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

function mapPostingError(message: string): string {
  if (message.includes("insufficient available stock")) {
    return "There is not enough available stock at that location to post this issue.";
  }

  if (message.includes("at least one line")) {
    return "Add at least one line before posting the issue.";
  }

  if (message.includes("only a draft issue")) {
    return "That issue has already been posted.";
  }

  if (message.includes("permission denied")) {
    return "You do not have permission to post inventory issues.";
  }

  return "The issue could not be posted.";
}

export async function createReservation(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = reservationSchema.safeParse({
    reservationNumber: formData.get("reservationNumber"),
    salesOrderId: formData.get("salesOrderId"),
    locationId: formData.get("locationId"),
    expiryAt: formData.get("expiryAt"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("inventory_reservations").insert({
    organisation_id: context.tenant.organisationId,
    reservation_number: parsed.data.reservationNumber,
    sales_order_id: parsed.data.salesOrderId,
    location_id: parsed.data.locationId,
    expiry_at: parsed.data.expiryAt ? new Date(`${parsed.data.expiryAt}T00:00:00Z`).toISOString() : null,
    notes: textOrNull(parsed.data.notes),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That reservation number already exists."
          : "The reservation could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  return { error: null, success: "Reservation created. Add reservation lines to commit stock." };
}

export async function addReservationItem(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = reservationItemSchema.safeParse({
    reservationId: formData.get("reservationId"),
    salesOrderItemId: formData.get("salesOrderItemId"),
    inventoryBatchId: formData.get("inventoryBatchId"),
    reservedQuantity: formData.get("reservedQuantity"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: orderItem, error: orderItemError } = await context.supabase
    .from("sales_order_items")
    .select("id, product_id")
    .eq("id", parsed.data.salesOrderItemId)
    .maybeSingle();

  if (orderItemError || !orderItem) {
    return { error: "That sales order line is not available to this company.", success: null };
  }

  const { error: insertError } = await context.supabase.from("inventory_reservation_items").insert({
    organisation_id: context.tenant.organisationId,
    reservation_id: parsed.data.reservationId,
    sales_order_item_id: orderItem.id,
    inventory_batch_id: parsed.data.inventoryBatchId,
    reserved_quantity: parsed.data.reservedQuantity,
  });

  if (insertError) {
    if (insertError.message.includes("available quantity")) {
      return { error: "That reservation exceeds the available quantity of the batch.", success: null };
    }

    if (insertError.message.includes("does not match the sales order line")) {
      return { error: "The reserved product does not match the sales order line.", success: null };
    }

    if (insertError.message.includes("not at the reservation location")) {
      return { error: "The batch is not held at the reservation location.", success: null };
    }

    return { error: "The reservation line could not be saved.", success: null };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  return { error: null, success: "Stock reserved. Physical stock is unchanged." };
}

export async function releaseReservationItem(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = releaseReservationSchema.safeParse({
    reservationItemId: formData.get("reservationItemId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("release_reservation_item", {
    p_item_id: parsed.data.reservationItemId,
    p_quantity: parsed.data.quantity,
  });

  if (rpcError) {
    return {
      error: rpcError.message.includes("only")
        ? "The release quantity exceeds what is still outstanding."
        : "The reservation could not be released.",
      success: null,
    };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  return { error: null, success: "Reservation quantity released." };
}

export async function createIssue(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = issueSchema.safeParse({
    issueNumber: formData.get("issueNumber"),
    salesOrderId: formData.get("salesOrderId"),
    locationId: formData.get("locationId"),
    tripId: formData.get("tripId"),
    issueDate: formData.get("issueDate"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("inventory_issues").insert({
    organisation_id: context.tenant.organisationId,
    issue_number: parsed.data.issueNumber,
    sales_order_id: parsed.data.salesOrderId,
    location_id: parsed.data.locationId,
    trip_id: uuidOrNull(parsed.data.tripId),
    issue_date: parsed.data.issueDate
      ? new Date(`${parsed.data.issueDate}T00:00:00Z`).toISOString()
      : undefined,
    notes: textOrNull(parsed.data.notes),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That issue number already exists."
          : "The issue could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  return { error: null, success: "Draft issue created. Add lines, then post it." };
}

export async function addIssueLine(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = issueLineSchema.safeParse({
    issueId: formData.get("issueId"),
    salesOrderItemId: formData.get("salesOrderItemId"),
    requestedQuantity: formData.get("requestedQuantity"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { data: orderItem, error: orderItemError } = await context.supabase
    .from("sales_order_items")
    .select("id, product_id")
    .eq("id", parsed.data.salesOrderItemId)
    .maybeSingle();

  if (orderItemError || !orderItem) {
    return { error: "That sales order line is not available to this company.", success: null };
  }

  const { error: insertError } = await context.supabase.from("inventory_issue_lines").insert({
    organisation_id: context.tenant.organisationId,
    issue_id: parsed.data.issueId,
    sales_order_item_id: orderItem.id,
    product_id: orderItem.product_id,
    requested_quantity: parsed.data.requestedQuantity,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "That sales order line is already on this issue.", success: null };
    }

    if (insertError.message.includes("draft issue")) {
      return { error: "Lines can only be added to a draft issue.", success: null };
    }

    if (insertError.message.includes("does not match the sales order line")) {
      return { error: "The issue product does not match the sales order line.", success: null };
    }

    return { error: "The issue line could not be saved.", success: null };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  return { error: null, success: "Issue line added. Post the issue to move stock." };
}

export async function postIssue(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = postIssueSchema.safeParse({ issueId: formData.get("issueId") });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("post_inventory_issue", {
    p_issue_id: parsed.data.issueId,
  });

  if (rpcError) {
    return { error: mapPostingError(rpcError.message), success: null };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  revalidatePath("/workspace/inventory");
  return { error: null, success: "Issue posted. Stock and FIFO allocations were recorded." };
}

export async function reverseIssue(
  _previous: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  const parsed = reverseIssueSchema.safeParse({
    issueId: formData.get("issueId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: rpcError } = await context.supabase.rpc("reverse_inventory_issue", {
    p_issue_id: parsed.data.issueId,
    p_reason: parsed.data.reason,
  });

  if (rpcError) {
    if (rpcError.message.includes("already been reversed")) {
      return { error: "That issue has already been reversed.", success: null };
    }

    if (rpcError.message.includes("a reversal reason is required")) {
      return { error: "Give a reason for the reversal.", success: null };
    }

    if (rpcError.message.includes("only a posted issue")) {
      return { error: "Only a posted issue can be reversed.", success: null };
    }

    return { error: "The issue could not be reversed.", success: null };
  }

  revalidatePath("/workspace/inventory/fulfilment");
  revalidatePath("/workspace/inventory");
  return { error: null, success: "Issue reversed. Stock and cost were compensated." };
}
