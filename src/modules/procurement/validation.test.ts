import { describe, expect, it } from "vitest";
import {
  batchSchema,
  depotSchema,
  productSchema,
  purchaseOrderItemSchema,
  purchaseOrderSchema,
  supplierSchema,
} from "./validation";

const supplierId = "11111111-1111-1111-1111-111111111111";
const depotId = "22222222-2222-2222-2222-222222222222";
const productId = "33333333-3333-3333-3333-333333333333";
const locationId = "44444444-4444-4444-4444-444444444444";

describe("supplierSchema", () => {
  it("accepts minimal supplier data and trims fields", () => {
    expect(
      supplierSchema.parse({ supplierCode: " SUP-1 ", name: "  North Depot Ltd  " }),
    ).toMatchObject({ supplierCode: "SUP-1", name: "North Depot Ltd" });
  });

  it("rejects a missing supplier name", () => {
    expect(supplierSchema.safeParse({ supplierCode: "SUP-1", name: "" }).success).toBe(false);
  });
});

describe("depotSchema", () => {
  it("requires a supplier", () => {
    expect(depotSchema.safeParse({ supplierId: "", depotCode: "D1", name: "Depot" }).success).toBe(
      false,
    );
  });
});

describe("productSchema", () => {
  it("defaults the unit to litres", () => {
    expect(
      productSchema.parse({ productCode: "PMS", productName: "Premium Motor Spirit", productType: "fuel" })
        .unitOfMeasure,
    ).toBe("litres");
  });
});

describe("batchSchema", () => {
  const base = {
    batchNumber: "BAT-001",
    supplierId,
    supplierDepotId: depotId,
    productId,
    supplierQuantity: "33000",
    fulfilmentType: "storage_receipt" as const,
    receivedAtLocationId: locationId,
  };

  it("accepts a storage receipt with only the supplier quantity", () => {
    const parsed = batchSchema.parse(base);
    expect(parsed.supplierQuantity).toBe(33000);
    expect(parsed.loadedQuantity).toBeUndefined();
    expect(parsed.receivedQuantity).toBeUndefined();
  });

  it("coerces loaded and received quantities when supplied", () => {
    const parsed = batchSchema.parse({ ...base, loadedQuantity: "32980", receivedQuantity: "32950" });
    expect(parsed.loadedQuantity).toBe(32980);
    expect(parsed.receivedQuantity).toBe(32950);
  });

  it("rejects a zero supplier quantity", () => {
    expect(batchSchema.safeParse({ ...base, supplierQuantity: "0" }).success).toBe(false);
  });

  it("requires a receiving location for a storage receipt", () => {
    expect(batchSchema.safeParse({ ...base, receivedAtLocationId: "" }).success).toBe(false);
  });

  it("allows a direct fulfilment without a tenant location", () => {
    expect(
      batchSchema.safeParse({
        ...base,
        fulfilmentType: "direct_customer_delivery",
        receivedAtLocationId: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid date", () => {
    expect(batchSchema.safeParse({ ...base, loadingDate: "15/11/2026" }).success).toBe(false);
  });
});

describe("purchaseOrderSchema", () => {
  const base = {
    poNumber: "PO-001",
    supplierId,
    orderDate: "2026-11-15",
  };

  it("accepts a minimal purchase order", () => {
    expect(purchaseOrderSchema.parse(base).poNumber).toBe("PO-001");
  });

  it("rejects an expected date before the order date", () => {
    expect(purchaseOrderSchema.safeParse({ ...base, expectedDate: "2026-11-14" }).success).toBe(false);
  });

  it("rejects a malformed order date", () => {
    expect(purchaseOrderSchema.safeParse({ ...base, orderDate: "15/11/2026" }).success).toBe(false);
  });
});

describe("purchaseOrderItemSchema", () => {
  const base = {
    purchaseOrderId: supplierId,
    productId,
    orderedQuantity: "33000",
    agreedUnitPrice: "850.5",
  };

  it("coerces quantity and price", () => {
    const parsed = purchaseOrderItemSchema.parse(base);
    expect(parsed.orderedQuantity).toBe(33000);
    expect(parsed.agreedUnitPrice).toBe(850.5);
  });

  it("rejects a zero quantity", () => {
    expect(purchaseOrderItemSchema.safeParse({ ...base, orderedQuantity: "0" }).success).toBe(false);
  });

  it("rejects a negative unit price", () => {
    expect(purchaseOrderItemSchema.safeParse({ ...base, agreedUnitPrice: "-1" }).success).toBe(false);
  });
});

describe("batch purchase-order linkage", () => {
  const base = {
    batchNumber: "BAT-001",
    supplierId,
    supplierDepotId: depotId,
    productId,
    supplierQuantity: "33000",
    fulfilmentType: "storage_receipt" as const,
    receivedAtLocationId: locationId,
  };

  it("accepts a valid purchase-order line reference", () => {
    expect(
      batchSchema.safeParse({ ...base, purchaseOrderItemId: supplierId }).success,
    ).toBe(true);
  });

  it("rejects an invalid purchase-order line reference", () => {
    expect(
      batchSchema.safeParse({ ...base, purchaseOrderItemId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
