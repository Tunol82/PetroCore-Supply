import { describe, expect, it } from "vitest";
import { paymentSchema, transporterInvoiceLineSchema, transporterInvoiceSchema } from "./validation";

const id = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

describe("transporterInvoiceSchema", () => {
  const base = {
    transporterId: id,
    invoiceNumber: "INV-1",
    invoiceDate: "2026-11-16",
    subtotal: "150000",
  };

  it("accepts an invoice without a trip", () => {
    expect(transporterInvoiceSchema.parse({ ...base, tripId: "" }).subtotal).toBe(150000);
  });

  it("treats a blank tax amount as absent", () => {
    expect(transporterInvoiceSchema.parse({ ...base, taxAmount: "" }).taxAmount).toBeUndefined();
  });

  it("rejects a negative subtotal", () => {
    expect(transporterInvoiceSchema.safeParse({ ...base, subtotal: "-1" }).success).toBe(false);
  });

  it("rejects a malformed invoice date", () => {
    expect(transporterInvoiceSchema.safeParse({ ...base, invoiceDate: "16/11/2026" }).success).toBe(false);
  });
});

describe("transporterInvoiceLineSchema", () => {
  const base = { invoiceId: id, description: "Haulage", quantity: "2", unitRate: "75000" };

  it("accepts an invoice line", () => {
    expect(transporterInvoiceLineSchema.parse(base).unitRate).toBe(75000);
  });

  it("rejects a zero quantity", () => {
    expect(transporterInvoiceLineSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
  });
});

describe("paymentSchema", () => {
  const receipt = {
    direction: "receipt" as const,
    customerId: id,
    amount: "250000",
    method: "bank_transfer" as const,
  };

  it("accepts a customer receipt", () => {
    expect(paymentSchema.safeParse(receipt).success).toBe(true);
  });

  it("rejects a receipt without a customer", () => {
    expect(paymentSchema.safeParse({ ...receipt, customerId: "" }).success).toBe(false);
  });

  it("rejects a receipt that names a supplier", () => {
    expect(paymentSchema.safeParse({ ...receipt, supplierId: other }).success).toBe(false);
  });

  it("accepts a supplier payment", () => {
    expect(
      paymentSchema.safeParse({
        direction: "payment",
        supplierId: id,
        amount: "100000",
        method: "cash",
      }).success,
    ).toBe(true);
  });

  it("rejects a payment without a supplier or transporter", () => {
    expect(
      paymentSchema.safeParse({ direction: "payment", amount: "100000", method: "cash" }).success,
    ).toBe(false);
  });

  it("rejects a customer payment that names both a supplier and a transporter", () => {
    expect(
      paymentSchema.safeParse({
        direction: "payment",
        supplierId: id,
        transporterId: other,
        amount: "100000",
        method: "cash",
      }).success,
    ).toBe(false);
  });

  it("rejects a zero amount", () => {
    expect(paymentSchema.safeParse({ ...receipt, amount: "0" }).success).toBe(false);
  });
});
