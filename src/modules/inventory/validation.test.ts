import { describe, expect, it } from "vitest";
import { inventoryReceiptSchema } from "./validation";

const batchId = "11111111-1111-1111-1111-111111111111";
const locationId = "22222222-2222-2222-2222-222222222222";

describe("inventoryReceiptSchema", () => {
  const base = {
    procurementBatchId: batchId,
    locationId,
    originalQuantity: "33000",
    landedCostPerUnit: "850.5",
  };

  it("accepts a verified receipt", () => {
    const parsed = inventoryReceiptSchema.parse(base);
    expect(parsed.originalQuantity).toBe(33000);
    expect(parsed.landedCostPerUnit).toBe(850.5);
  });

  it("treats a blank landed cost as absent", () => {
    expect(inventoryReceiptSchema.parse({ ...base, landedCostPerUnit: "" }).landedCostPerUnit).toBeUndefined();
  });

  it("rejects a zero quantity", () => {
    expect(inventoryReceiptSchema.safeParse({ ...base, originalQuantity: "0" }).success).toBe(false);
  });

  it("rejects a negative landed cost", () => {
    expect(inventoryReceiptSchema.safeParse({ ...base, landedCostPerUnit: "-1" }).success).toBe(false);
  });

  it("rejects an invalid location identifier", () => {
    expect(inventoryReceiptSchema.safeParse({ ...base, locationId: "depot" }).success).toBe(false);
  });

  it("rejects a malformed receipt date", () => {
    expect(inventoryReceiptSchema.safeParse({ ...base, receivedOn: "15/11/2026" }).success).toBe(false);
  });
});
