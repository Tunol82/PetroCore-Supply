import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalEmail = z.string().trim().email("Enter a valid email address.").optional().or(z.literal(""));
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").optional(),
);

export const CUSTOMER_CATEGORIES = [
  "individual",
  "business",
  "petrol_station",
  "distributor",
  "other",
] as const;

export const CREDIT_STATUSES = ["active", "on_hold", "suspended", "closed"] as const;
export const ORDER_SOURCES = ["sales_representative", "phone", "whatsapp", "other"] as const;
export const PAYMENT_ARRANGEMENTS = ["full_prepayment", "deposit_balance", "credit"] as const;

export const customerSchema = z.object({
  customerCode: z.string().trim().min(2, "Enter a customer code.").max(40),
  name: z.string().trim().min(2, "Enter the customer name.").max(200),
  customerCategory: z.enum(CUSTOMER_CATEGORIES),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
  creditLimit: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? 0 : value),
    z.coerce.number().min(0, "Credit limit cannot be negative."),
  ),
  paymentTerms: optionalText(40),
  creditStatus: z.enum(CREDIT_STATUSES),
});

export const customerLocationSchema = z.object({
  customerId: uuid("Select a customer."),
  locationName: z.string().trim().min(2, "Enter the location name.").max(150),
  address: z.string().trim().min(3, "Enter the delivery address.").max(500),
  contactPerson: optionalText(150),
  phone: optionalText(30),
});

export const salesOrderSchema = z.object({
  orderNumber: z.string().trim().min(2, "Enter the order number.").max(50),
  customerId: uuid("Select a customer."),
  customerLocationId: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || UUID_PATTERN.test(value), "Select a delivery location."),
  orderSource: z.enum(ORDER_SOURCES),
  requestedDeliveryDate: optionalDate,
  paymentArrangement: z.enum(PAYMENT_ARRANGEMENTS),
  paymentTerms: optionalText(40),
  notes: optionalText(500),
});

export const salesOrderItemSchema = z.object({
  salesOrderId: uuid("Select a sales order."),
  productId: uuid("Select a product."),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative."),
  discountAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, "Discount cannot be negative.").optional(),
  ),
  deliveryFee: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, "Delivery fee cannot be negative.").optional(),
  ),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerLocationInput = z.infer<typeof customerLocationSchema>;
export type SalesOrderInput = z.infer<typeof salesOrderSchema>;
export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;
