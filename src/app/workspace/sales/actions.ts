"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "@/modules/tenant/current-tenant";
import {
  customerLocationSchema,
  customerSchema,
  salesOrderItemSchema,
  salesOrderSchema,
} from "@/modules/sales/validation";

export type SalesActionState = {
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
    p_permission_key: "sales.manage",
  });

  if (permissionError) {
    return { error: "We could not verify your permission." };
  }

  if (!allowed) {
    return { error: "You do not have permission to manage sales." };
  }

  return { context: { supabase, tenant } };
}

function duplicateMessage(error: { code?: string }, what: string): string {
  return error.code === "23505" ? `${what} already exists.` : `${what} could not be saved.`;
}

export async function createCustomer(
  _previous: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const parsed = customerSchema.safeParse({
    customerCode: formData.get("customerCode"),
    name: formData.get("name"),
    customerCategory: formData.get("customerCategory"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    creditLimit: formData.get("creditLimit"),
    paymentTerms: formData.get("paymentTerms"),
    creditStatus: formData.get("creditStatus"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("customers").insert({
    organisation_id: context.tenant.organisationId,
    customer_code: parsed.data.customerCode,
    name: parsed.data.name,
    customer_category: parsed.data.customerCategory,
    phone: textOrNull(parsed.data.phone),
    email: textOrNull(parsed.data.email),
    address: textOrNull(parsed.data.address),
    credit_limit: parsed.data.creditLimit,
    payment_terms: textOrNull(parsed.data.paymentTerms),
    credit_status: parsed.data.creditStatus,
  });

  if (insertError) {
    return { error: duplicateMessage(insertError, "That customer code"), success: null };
  }

  revalidatePath("/workspace/sales");
  return { error: null, success: "Customer saved." };
}

export async function createCustomerLocation(
  _previous: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const parsed = customerLocationSchema.safeParse({
    customerId: formData.get("customerId"),
    locationName: formData.get("locationName"),
    address: formData.get("address"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("customer_locations").insert({
    organisation_id: context.tenant.organisationId,
    customer_id: parsed.data.customerId,
    location_name: parsed.data.locationName,
    address: parsed.data.address,
    contact_person: textOrNull(parsed.data.contactPerson),
    phone: textOrNull(parsed.data.phone),
  });

  if (insertError) {
    return { error: "The delivery location could not be saved.", success: null };
  }

  revalidatePath("/workspace/sales");
  return { error: null, success: "Delivery location saved." };
}

export async function createSalesOrder(
  _previous: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const parsed = salesOrderSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    customerId: formData.get("customerId"),
    customerLocationId: formData.get("customerLocationId"),
    orderSource: formData.get("orderSource"),
    requestedDeliveryDate: formData.get("requestedDeliveryDate"),
    paymentArrangement: formData.get("paymentArrangement"),
    paymentTerms: formData.get("paymentTerms"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  if (parsed.data.customerLocationId) {
    const { data: location } = await context.supabase
      .from("customer_locations")
      .select("customer_id")
      .eq("id", parsed.data.customerLocationId)
      .maybeSingle();

    if (!location || location.customer_id !== parsed.data.customerId) {
      return { error: "The delivery location does not belong to that customer.", success: null };
    }
  }

  const { error: insertError } = await context.supabase.from("sales_orders").insert({
    organisation_id: context.tenant.organisationId,
    order_number: parsed.data.orderNumber,
    customer_id: parsed.data.customerId,
    customer_location_id: textOrNull(parsed.data.customerLocationId),
    order_source: parsed.data.orderSource,
    requested_delivery_date: dateToIso(parsed.data.requestedDeliveryDate),
    payment_arrangement: parsed.data.paymentArrangement,
    payment_terms: textOrNull(parsed.data.paymentTerms),
    notes: textOrNull(parsed.data.notes),
    created_by: context.tenant.profileId,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That order number already exists."
          : "The sales order could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/sales");
  return { error: null, success: "Sales order saved." };
}

export async function addSalesOrderItem(
  _previous: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const parsed = salesOrderItemSchema.safeParse({
    salesOrderId: formData.get("salesOrderId"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    sellingPrice: formData.get("sellingPrice"),
    discountAmount: formData.get("discountAmount"),
    deliveryFee: formData.get("deliveryFee"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed), success: null };
  }

  const { context, error } = await requireManageAccess();
  if (!context) return { error: error ?? "Access denied.", success: null };

  const { error: insertError } = await context.supabase.from("sales_order_items").insert({
    organisation_id: context.tenant.organisationId,
    sales_order_id: parsed.data.salesOrderId,
    product_id: parsed.data.productId,
    quantity: parsed.data.quantity,
    selling_price: parsed.data.sellingPrice,
    discount_amount: parsed.data.discountAmount ?? 0,
    delivery_fee: parsed.data.deliveryFee ?? 0,
  });

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "That product is already on this order."
          : "The order line could not be saved.",
      success: null,
    };
  }

  revalidatePath("/workspace/sales");
  return { error: null, success: "Order line saved." };
}
