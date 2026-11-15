import { describe, expect, it } from "vitest";
import { batchSchema, depotSchema, productSchema, supplierSchema } from "./validation";

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
