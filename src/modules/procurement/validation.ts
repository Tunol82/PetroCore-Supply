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

export const batchSchema = z
  .object({
    batchNumber: z.string().trim().min(2, "Enter the batch reference.").max(60),
    supplierId: uuid("Select a supplier."),
    supplierDepotId: uuid("Select a supplier depot."),
    productId: uuid("Select a product."),
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

export type SupplierInput = z.infer<typeof supplierSchema>;
export type DepotInput = z.infer<typeof depotSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
