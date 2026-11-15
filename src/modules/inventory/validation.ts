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

export const inventoryReceiptSchema = z.object({
  procurementBatchId: uuid("Select a procurement batch."),
  locationId: uuid("Select a storage location."),
  originalQuantity: z.coerce.number().positive("Receipt quantity must be greater than zero."),
  landedCostPerUnit: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, "Landed cost cannot be negative.").optional(),
  ),
  receivedOn: optionalDate,
});

export type InventoryReceiptInput = z.infer<typeof inventoryReceiptSchema>;
