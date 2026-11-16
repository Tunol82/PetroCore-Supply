import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUuid = (message: string) =>
  z.string().optional().or(z.literal("")).refine((value) => !value || UUID_PATTERN.test(value), message);
const requiredDate = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  requiredDate("Enter a valid date.").optional(),
);
const money = (message: string) => z.coerce.number().min(0, message);

export const PAYMENT_DIRECTIONS = ["receipt", "payment"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "pos", "other"] as const;

export const transporterInvoiceSchema = z.object({
  transporterId: uuid("Select a transporter."),
  tripId: optionalUuid("Select a valid trip."),
  invoiceNumber: z.string().trim().min(1, "Enter the invoice number.").max(80),
  invoiceDate: requiredDate("Enter the invoice date."),
  subtotal: money("Subtotal cannot be negative."),
  taxAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    money("Tax cannot be negative.").optional(),
  ),
  notes: optionalText(500),
});

export const CHARGE_CATEGORIES = ["haulage", "loading", "waiting", "demurrage", "other"] as const;

export const transporterInvoiceLineSchema = z.object({
  invoiceId: uuid("Select an invoice."),
  description: z.string().trim().min(2, "Enter a description.").max(200),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitRate: money("Unit rate cannot be negative."),
  chargeCategory: z.enum(CHARGE_CATEGORIES).optional().or(z.literal("")),
});

export const paymentSchema = z
  .object({
    direction: z.enum(PAYMENT_DIRECTIONS),
    customerId: optionalUuid("Select a customer."),
    supplierId: optionalUuid("Select a supplier."),
    transporterId: optionalUuid("Select a transporter."),
    salesOrderId: optionalUuid("Select a sales order."),
    purchaseOrderId: optionalUuid("Select a purchase order."),
    transporterInvoiceId: optionalUuid("Select a transporter invoice."),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    method: z.enum(PAYMENT_METHODS),
    reference: optionalText(120),
    paidAt: optionalDate,
    notes: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.direction === "receipt") {
      if (!value.customerId) {
        ctx.addIssue({ code: "custom", message: "Select the customer paying.", path: ["customerId"] });
      }

      if (value.supplierId || value.transporterId) {
        ctx.addIssue({ code: "custom", message: "A receipt cannot name a supplier or transporter.", path: ["customerId"] });
      }

      return;
    }

    const payerCount = [value.supplierId, value.transporterId].filter(Boolean).length;

    if (payerCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Select either a supplier or a transporter for a payment.",
        path: ["supplierId"],
      });
    }

    if (value.customerId) {
      ctx.addIssue({ code: "custom", message: "A payment cannot name a customer.", path: ["supplierId"] });
    }
  });

export type TransporterInvoiceInput = z.infer<typeof transporterInvoiceSchema>;
export type TransporterInvoiceLineInput = z.infer<typeof transporterInvoiceLineSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
