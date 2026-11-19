import { describe, expect, it } from "vitest";
import { buildMatchLines, unlinkedBatches, type MatchBatchInput, type MatchLineInput } from "./matching";

const line: MatchLineInput = {
  id: "11111111-1111-1111-1111-111111111111",
  purchase_order_id: "22222222-2222-2222-2222-222222222222",
  product_id: "33333333-3333-3333-3333-333333333333",
  ordered_quantity: "10000.000",
  agreed_unit_price: "900.0000",
  discount_amount: "0.00",
  line_total: "9000000.00",
};

function batch(overrides: Partial<MatchBatchInput>): MatchBatchInput {
  return {
    id: crypto.randomUUID(),
    batch_number: "BAT-1",
    purchase_order_item_id: line.id,
    supplier_quantity: "10000.000",
    received_quantity: "10000.000",
    supplier_invoice_number: "INV-1",
    ...overrides,
  };
}

describe("buildMatchLines", () => {
  it("matches when ordered, invoiced and received agree", () => {
    const [match] = buildMatchLines([line], [batch({})]);

    expect(match.status).toBe("matched");
    expect(match.ordered).toBe(10000);
    expect(match.invoiced).toBe(10000);
    expect(match.received).toBe(10000);
    expect(match.invoicedVariance).toBe(0);
    expect(match.receivedVariance).toBe(0);
    expect(match.orderedValue).toBe(9000000);
    expect(match.invoicedValue).toBe(9000000);
    expect(match.effectiveUnitPrice).toBe(900);
  });

  it("awaits an invoice when no batch is linked", () => {
    const [match] = buildMatchLines([line], []);

    expect(match.status).toBe("awaiting_invoice");
    expect(match.batchCount).toBe(0);
    expect(match.invoicedVariance).toBeNull();
    expect(match.receivedVariance).toBeNull();
    expect(match.missingInvoiceNumber).toBe(false);
  });

  it("flags an invoiced quantity that differs from the order", () => {
    const [match] = buildMatchLines([line], [batch({ supplier_quantity: "9800.000" })]);

    expect(match.status).toBe("variance");
    expect(match.invoicedVariance).toBe(-200);
  });

  it("awaits receipt when the invoice exists but nothing has been received", () => {
    const [match] = buildMatchLines([line], [batch({ received_quantity: null })]);

    expect(match.status).toBe("awaiting_receipt");
    expect(match.hasReceipts).toBe(false);
    expect(match.receivedVariance).toBeNull();
  });

  it("marks a partially received line separately", () => {
    const [match] = buildMatchLines(
      [line],
      [
        batch({ batch_number: "BAT-1", supplier_quantity: "6000.000", received_quantity: "6000.000" }),
        batch({ batch_number: "BAT-2", supplier_quantity: "4000.000", received_quantity: null }),
      ],
    );

    expect(match.status).toBe("part_received");
    expect(match.received).toBe(6000);
    expect(match.receivedVariance).toBeNull();
  });

  it("flags a receipt that differs from the invoiced quantity", () => {
    const [match] = buildMatchLines([line], [batch({ received_quantity: "9950.000" })]);

    expect(match.status).toBe("variance");
    expect(match.receivedVariance).toBe(-50);
  });

  it("sums multiple batches for the same line", () => {
    const [match] = buildMatchLines(
      [line],
      [
        batch({ batch_number: "BAT-1", supplier_quantity: "4000.000", received_quantity: "4000.000" }),
        batch({ batch_number: "BAT-2", supplier_quantity: "6000.000", received_quantity: "6000.000" }),
      ],
    );

    expect(match.invoiced).toBe(10000);
    expect(match.received).toBe(10000);
    expect(match.batchNumbers).toEqual(["BAT-1", "BAT-2"]);
    expect(match.status).toBe("matched");
  });

  it("collects unique invoice references and flags a missing one", () => {
    const [withRefs] = buildMatchLines(
      [line],
      [
        batch({ supplier_invoice_number: "INV-1" }),
        batch({ supplier_invoice_number: "INV-1" }),
        batch({ supplier_invoice_number: "INV-2" }),
      ],
    );
    expect(withRefs.invoiceNumbers).toEqual(["INV-1", "INV-2"]);

    const [missing] = buildMatchLines([line], [batch({ supplier_invoice_number: null })]);
    expect(missing.invoiceNumbers).toEqual([]);
    expect(missing.missingInvoiceNumber).toBe(true);
  });

  it("values the invoice at the PO effective rate, including discount", () => {
    const [match] = buildMatchLines(
      [{ ...line, ordered_quantity: "100.000", line_total: "9500.00", agreed_unit_price: "100.0000" }],
      [batch({ supplier_quantity: "100.000", received_quantity: "100.000" })],
    );

    expect(match.effectiveUnitPrice).toBe(95);
    expect(match.invoicedValue).toBe(9500);
  });

  it("treats differences below the stored precision as equal", () => {
    const [match] = buildMatchLines([line], [batch({ supplier_quantity: "10000.0004" })]);

    expect(match.status).toBe("matched");
  });
});

describe("unlinkedBatches", () => {
  it("returns only batches with no purchase-order line", () => {
    const linked = batch({});
    const unlinked = batch({ purchase_order_item_id: null, batch_number: "BAT-2" });

    expect(unlinkedBatches([linked, unlinked]).map((item) => item.batch_number)).toEqual(["BAT-2"]);
  });
});
