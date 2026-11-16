import { describe, expect, it } from "vitest";
import {
  inventoryReceiptSchema,
  issueLineSchema,
  issueSchema,
  releaseReservationSchema,
  reservationItemSchema,
  reservationSchema,
  reverseIssueSchema,
} from "./validation";

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

describe("reservationSchema", () => {
  const base = {
    reservationNumber: "RES-1",
    salesOrderId: batchId,
    locationId,
  };

  it("accepts a reservation", () => {
    expect(reservationSchema.parse(base).reservationNumber).toBe("RES-1");
  });

  it("rejects a missing sales order", () => {
    expect(reservationSchema.safeParse({ ...base, salesOrderId: "" }).success).toBe(false);
  });
});

describe("reservationItemSchema", () => {
  const base = {
    reservationId: batchId,
    salesOrderItemId: locationId,
    inventoryBatchId: batchId,
    reservedQuantity: "100",
  };

  it("accepts a reservation line", () => {
    expect(reservationItemSchema.parse(base).reservedQuantity).toBe(100);
  });

  it("rejects a zero reserved quantity", () => {
    expect(reservationItemSchema.safeParse({ ...base, reservedQuantity: "0" }).success).toBe(false);
  });
});

describe("releaseReservationSchema", () => {
  it("accepts a release", () => {
    expect(releaseReservationSchema.safeParse({ reservationItemId: batchId, quantity: "5" }).success).toBe(true);
  });

  it("rejects a negative release", () => {
    expect(releaseReservationSchema.safeParse({ reservationItemId: batchId, quantity: "-5" }).success).toBe(false);
  });
});

describe("issueSchema", () => {
  const base = {
    issueNumber: "ISS-1",
    salesOrderId: batchId,
    locationId,
  };

  it("accepts an issue without a trip", () => {
    expect(issueSchema.parse({ ...base, tripId: "" }).issueNumber).toBe("ISS-1");
  });

  it("rejects a malformed trip identifier", () => {
    expect(issueSchema.safeParse({ ...base, tripId: "trip-1" }).success).toBe(false);
  });
});

describe("issueLineSchema", () => {
  it("accepts an issue line", () => {
    expect(issueLineSchema.safeParse({ issueId: batchId, salesOrderItemId: locationId, requestedQuantity: "10" }).success).toBe(true);
  });

  it("rejects a negative issue quantity", () => {
    expect(issueLineSchema.safeParse({ issueId: batchId, salesOrderItemId: locationId, requestedQuantity: "-1" }).success).toBe(false);
  });
});

describe("reverseIssueSchema", () => {
  it("accepts a reversal with a reason", () => {
    expect(reverseIssueSchema.safeParse({ issueId: batchId, reason: "Wrong order line" }).success).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(reverseIssueSchema.safeParse({ issueId: batchId, reason: "  " }).success).toBe(false);
  });

  it("rejects a reason shorter than three characters", () => {
    expect(reverseIssueSchema.safeParse({ issueId: batchId, reason: "x" }).success).toBe(false);
  });
});

