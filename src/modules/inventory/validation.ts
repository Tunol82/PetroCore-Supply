import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").optional(),
);

export const INVENTORY_STATUSES = ["available", "held", "exhausted", "closed"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUuid = (message: string) =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || UUID_PATTERN.test(value), message);
const positiveQuantity = (message: string) => z.coerce.number().positive(message);

export const inventoryReceiptSchema = z.object({
  procurementBatchId: uuid("Select a procurement batch."),
  locationId: uuid("Select a storage location."),
  originalQuantity: positiveQuantity("Receipt quantity must be greater than zero."),
  landedCostPerUnit: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, "Landed cost cannot be negative.").optional(),
  ),
  receivedOn: optionalDate,
});

export type InventoryReceiptInput = z.infer<typeof inventoryReceiptSchema>;

export const RESERVATION_STATUSES = [
  "active",
  "partially_fulfilled",
  "fulfilled",
  "released",
  "cancelled",
] as const;
export const ISSUE_STATUSES = ["draft", "posted", "reversed", "cancelled"] as const;

export const reservationSchema = z.object({
  reservationNumber: z.string().trim().min(2, "Enter a reservation number.").max(50),
  salesOrderId: uuid("Select a sales order."),
  locationId: uuid("Select a storage location."),
  expiryAt: optionalDate,
  notes: optionalText(500),
});

export const reservationItemSchema = z.object({
  reservationId: uuid("Select a reservation."),
  salesOrderItemId: uuid("Select a sales order line."),
  inventoryBatchId: uuid("Select an inventory batch."),
  reservedQuantity: positiveQuantity("Reserved quantity must be greater than zero."),
});

export const releaseReservationSchema = z.object({
  reservationItemId: uuid("Select a reservation line."),
  quantity: positiveQuantity("Release quantity must be greater than zero."),
});

export const issueSchema = z.object({
  issueNumber: z.string().trim().min(2, "Enter an issue number.").max(50),
  salesOrderId: uuid("Select a sales order."),
  locationId: uuid("Select a storage location."),
  tripId: optionalUuid("Select a valid trip."),
  issueDate: optionalDate,
  notes: optionalText(500),
});

export const issueLineSchema = z.object({
  issueId: uuid("Select a draft issue."),
  salesOrderItemId: uuid("Select a sales order line."),
  requestedQuantity: positiveQuantity("Issue quantity must be greater than zero."),
});

export const postIssueSchema = z.object({
  issueId: uuid("Select a draft issue."),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type IssueInput = z.infer<typeof issueSchema>;
