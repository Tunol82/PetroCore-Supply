import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalEmail = z.string().trim().email("Enter a valid email address.").optional().or(z.literal(""));
const optionalQuantity = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().positive("Quantities must be greater than zero.").optional(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").optional(),
);

export const supplierSchema = z.object({
  supplierCode: z.string().trim().min(2, "Enter a supplier code.").max(40),
  name: z.string().trim().min(2, "Enter the supplier name.").max(200),
  contactPerson: optionalText(150),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
  paymentTerms: optionalText(40),
});

export const depotSchema = z.object({
  supplierId: uuid("Select a supplier."),
  depotCode: z.string().trim().min(2, "Enter a depot code.").max(40),
  name: z.string().trim().min(2, "Enter the depot name.").max(200),
  locationDescription: optionalText(200),
  contactPerson: optionalText(150),
  phone: optionalText(30),
});

export const productSchema = z.object({
  productCode: z.string().trim().min(2, "Enter a product code.").max(40),
  productName: z.string().trim().min(2, "Enter the product name.").max(120),
  productType: z.string().trim().min(2, "Enter the product type.").max(60),
  unitOfMeasure: z.string().trim().min(1).max(20).default("litres"),
  description: optionalText(500),
});

export const MASTER_STATUSES = ["active", "inactive"] as const;

export const masterStatusSchema = z.object({
  id: uuid("Select a record."),
  status: z.enum(MASTER_STATUSES),
});

export const supplierUpdateSchema = supplierSchema.extend({
  id: uuid("Select a supplier."),
});

export const depotUpdateSchema = depotSchema.extend({
  id: uuid("Select a depot."),
});

export const productUpdateSchema = productSchema.extend({
  id: uuid("Select a product."),
});

export const batchSchema = z
  .object({
    batchNumber: z.string().trim().min(2, "Enter the batch reference.").max(60),
    supplierId: uuid("Select a supplier."),
    supplierDepotId: uuid("Select a supplier depot."),
    productId: uuid("Select a product."),
    purchaseOrderItemId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || UUID_PATTERN.test(value), "Select a valid order line."),
    supplierQuantity: z.coerce.number().positive("Supplier quantity must be greater than zero."),
    loadedQuantity: optionalQuantity,
    receivedQuantity: optionalQuantity,
    fulfilmentType: z.enum(["storage_receipt", "direct_customer_delivery"]),
    supplierInvoiceNumber: optionalText(80),
    supplierLoadingTicket: optionalText(100),
    loadingDate: optionalDate,
    receiptDate: optionalDate,
    receivedAtLocationId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || UUID_PATTERN.test(value), "Select a location."),
  })
  .refine(
    (value) =>
      value.fulfilmentType !== "storage_receipt" || Boolean(value.receivedAtLocationId),
    {
      message: "Choose the location that received the product.",
      path: ["receivedAtLocationId"],
    },
  );

export const purchaseOrderSchema = z
  .object({
    poNumber: z.string().trim().min(2, "Enter a purchase order number.").max(50),
    supplierId: uuid("Select a supplier."),
    supplierDepotId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || UUID_PATTERN.test(value), "Select a depot."),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid order date."),
    expectedDate: optionalDate,
    paymentTerms: optionalText(40),
    notes: optionalText(500),
  })
  .refine((value) => !value.expectedDate || value.expectedDate >= value.orderDate, {
    message: "Expected date cannot be before the order date.",
    path: ["expectedDate"],
  });

export const purchaseOrderItemSchema = z.object({
  purchaseOrderId: uuid("Select a purchase order."),
  productId: uuid("Select a product."),
  orderedQuantity: z.coerce.number().positive("Ordered quantity must be greater than zero."),
  agreedUnitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
  discountAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, "Discount cannot be negative.").optional(),
  ),
});

export const COST_CATEGORY_TYPES = [
  "acquisition",
  "inbound_transport",
  "handling",
  "inspection",
  "documentation",
  "security",
  "other",
] as const;

export const ALLOCATION_METHODS = [
  "per_litre",
  "percentage",
  "fixed",
  "product_value",
  "manual",
] as const;

export const supplierProductSchema = z.object({
  supplierId: uuid("Select a supplier."),
  productId: uuid("Select a product."),
  supplierProductCode: optionalText(60),
});

export const costCategorySchema = z.object({
  categoryName: z.string().trim().min(2, "Enter the category name.").max(120),
  categoryType: z.enum(COST_CATEGORY_TYPES),
  allocationMethod: z.enum(ALLOCATION_METHODS),
});

export const costComponentSchema = z.object({
  procurementBatchId: uuid("Select a procurement batch."),
  costCategoryId: uuid("Select a cost category."),
  description: optionalText(500),
  amount: z.coerce.number().positive("Cost amount must be greater than zero."),
  supplierId: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || UUID_PATTERN.test(value), "Select a supplier."),
  referenceNumber: optionalText(100),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type DepotInput = z.infer<typeof depotSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;
export type SupplierProductInput = z.infer<typeof supplierProductSchema>;
export type CostCategoryInput = z.infer<typeof costCategorySchema>;
export type CostComponentInput = z.infer<typeof costComponentSchema>;
