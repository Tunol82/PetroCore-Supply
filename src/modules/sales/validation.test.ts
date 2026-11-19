import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CATEGORIES,
  customerLocationSchema,
  customerSchema,
  customerStatusSchema,
  customerUpdateSchema,
  salesOrderItemSchema,
  salesOrderSchema,
} from "./validation";

const customerId = "11111111-1111-1111-1111-111111111111";
const locationId = "22222222-2222-2222-2222-222222222222";
const productId = "33333333-3333-3333-3333-333333333333";
const orderId = "44444444-4444-4444-4444-444444444444";

describe("customerSchema", () => {
  it("accepts each supported category", () => {
    for (const category of CUSTOMER_CATEGORIES) {
      expect(
        customerSchema.safeParse({
          customerCode: "CUS-1",
          name: "Customer One",
          customerCategory: category,
          creditStatus: "active",
        }).success,
      ).toBe(true);
    }
  });

  it("defaults the credit limit to zero", () => {
    expect(
      customerSchema.parse({
        customerCode: "CUS-1",
        name: "Customer One",
        customerCategory: "business",
        creditStatus: "active",
      }).creditLimit,
    ).toBe(0);
  });

  it("rejects a negative credit limit", () => {
    expect(
      customerSchema.safeParse({
        customerCode: "CUS-1",
        name: "Customer One",
        customerCategory: "business",
        creditStatus: "active",
        creditLimit: "-1",
      }).success,
    ).toBe(false);
  });
});

describe("customer lifecycle", () => {
  it("accepts active and inactive status values", () => {
    expect(customerStatusSchema.safeParse({ id: customerId, status: "active" }).success).toBe(true);
    expect(customerStatusSchema.safeParse({ id: customerId, status: "inactive" }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(customerStatusSchema.safeParse({ id: customerId, status: "archived" }).success).toBe(false);
  });

  it("requires the customer id on update", () => {
    expect(
      customerUpdateSchema.safeParse({
        customerCode: "CUS-1",
        name: "Customer One",
        customerCategory: "business",
        creditStatus: "active",
      }).success,
    ).toBe(false);
  });

  it("keeps credit rules on update", () => {
    expect(
      customerUpdateSchema.safeParse({
        id: customerId,
        customerCode: "CUS-1",
        name: "Customer One",
        customerCategory: "business",
        creditStatus: "active",
        creditLimit: "-5",
      }).success,
    ).toBe(false);
  });
});

describe("customerLocationSchema", () => {
  it("requires an address", () => {
    expect(
      customerLocationSchema.safeParse({
        customerId,
        locationName: "Main station",
        address: "",
      }).success,
    ).toBe(false);
  });
});

describe("salesOrderSchema", () => {
  const base = {
    orderNumber: "SO-001",
    customerId,
    orderSource: "phone" as const,
    paymentArrangement: "credit" as const,
  };

  it("accepts a minimal order", () => {
    expect(salesOrderSchema.parse(base).orderNumber).toBe("SO-001");
  });

  it("accepts an optional delivery location", () => {
    expect(salesOrderSchema.safeParse({ ...base, customerLocationId: locationId }).success).toBe(true);
  });

  it("rejects an invalid delivery location", () => {
    expect(salesOrderSchema.safeParse({ ...base, customerLocationId: "abc" }).success).toBe(false);
  });

  it("rejects an unknown payment arrangement", () => {
    expect(salesOrderSchema.safeParse({ ...base, paymentArrangement: "barter" }).success).toBe(false);
  });
});

describe("salesOrderItemSchema", () => {
  const base = {
    salesOrderId: orderId,
    productId,
    quantity: "1000",
    sellingPrice: "900.25",
  };

  it("coerces quantity and price", () => {
    const parsed = salesOrderItemSchema.parse(base);
    expect(parsed.quantity).toBe(1000);
    expect(parsed.sellingPrice).toBe(900.25);
  });

  it("rejects a zero quantity", () => {
    expect(salesOrderItemSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
  });

  it("defaults discount and delivery fee to undefined", () => {
    const parsed = salesOrderItemSchema.parse(base);
    expect(parsed.discountAmount).toBeUndefined();
    expect(parsed.deliveryFee).toBeUndefined();
  });
});
