type Numeric = number | string;

export type MatchLineInput = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  ordered_quantity: Numeric;
  agreed_unit_price: Numeric;
  discount_amount: Numeric;
  line_total: Numeric;
};

export type MatchBatchInput = {
  id: string;
  batch_number: string;
  purchase_order_item_id: string | null;
  supplier_quantity: Numeric;
  received_quantity: Numeric | null;
  supplier_invoice_number: string | null;
  supplier_invoice_unit_price: Numeric | null;
  supplier_invoice_amount: Numeric | null;
};

export type MatchStatus =
  | "awaiting_invoice"
  | "awaiting_receipt"
  | "part_received"
  | "awaiting_price"
  | "price_variance"
  | "matched"
  | "variance";

export type MatchLine = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  ordered: number;
  invoiced: number;
  received: number;
  invoicedVariance: number | null;
  receivedVariance: number | null;
  hasReceipts: boolean;
  fullyReceived: boolean;
  effectiveUnitPrice: number;
  orderedValue: number;
  invoicedValue: number;
  receivedValue: number;
  invoicePrice: number | null;
  invoicePriceVariance: number | null;
  invoiceValueVariance: number | null;
  hasInvoicePricing: boolean;
  fullyPriced: boolean;
  invoiceNumbers: string[];
  batchNumbers: string[];
  missingInvoiceNumber: boolean;
  status: MatchStatus;
  batchCount: number;
};

/**
 * Quantities are stored to three decimals, so anything within half a unit of
 * the third decimal is treated as equal rather than a variance. Invoice prices
 * are stored to four decimals and compared at the same precision.
 */
export const MATCH_EPSILON = 0.0005;
export const PRICE_EPSILON = 0.00005;

function quantity(value: Numeric | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: Numeric | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > MATCH_EPSILON;
}

/**
 * Builds the ordered / invoiced / received comparison for purchase-order lines.
 *
 * "Invoiced" is the supplier quantity recorded on each linked procurement
 * batch, together with its supplier invoice reference. Invoice value uses the
 * recorded amount when present, otherwise quantity x invoice unit price, and
 * falls back to the PO effective rate when no invoice price was captured.
 *
 * Price variance compares the quantity-weighted invoice rate with the PO
 * effective rate (line total divided by ordered quantity, which already
 * reflects the discount). No tolerance is applied.
 */
export function buildMatchLines(items: MatchLineInput[], batches: MatchBatchInput[]): MatchLine[] {
  const batchesByLine = new Map<string, MatchBatchInput[]>();

  for (const batch of batches) {
    if (!batch.purchase_order_item_id) {
      continue;
    }

    const current = batchesByLine.get(batch.purchase_order_item_id) ?? [];
    current.push(batch);
    batchesByLine.set(batch.purchase_order_item_id, current);
  }

  return items.map((item) => {
    const lineBatches = batchesByLine.get(item.id) ?? [];
    const ordered = quantity(item.ordered_quantity);
    const invoiced = lineBatches.reduce((sum, batch) => sum + quantity(batch.supplier_quantity), 0);

    const receiptEntries = lineBatches.filter((batch) => batch.received_quantity !== null);
    const received = receiptEntries.reduce((sum, batch) => sum + quantity(batch.received_quantity), 0);
    const hasReceipts = receiptEntries.length > 0;
    const fullyReceived = lineBatches.length > 0 && receiptEntries.length === lineBatches.length;

    const orderedValue = quantity(item.line_total);
    const effectiveUnitPrice = ordered > 0 ? orderedValue / ordered : quantity(item.agreed_unit_price);

    let invoicedValue = 0;
    let pricedQuantity = 0;
    let pricedValue = 0;
    let pricedBatches = 0;
    let hasInvoicePricing = false;

    for (const batch of lineBatches) {
      const batchQuantity = quantity(batch.supplier_quantity);
      const amount = optionalNumber(batch.supplier_invoice_amount);
      const statedPrice = optionalNumber(batch.supplier_invoice_unit_price);
      const price = statedPrice ?? (amount !== null && batchQuantity > 0 ? amount / batchQuantity : null);

      if (price !== null) {
        hasInvoicePricing = true;
        pricedBatches += 1;
        pricedQuantity += batchQuantity;
        pricedValue += batchQuantity * price;
      }

      invoicedValue += amount ?? (price !== null ? batchQuantity * price : batchQuantity * effectiveUnitPrice);
    }

    const fullyPriced = lineBatches.length > 0 && pricedBatches === lineBatches.length;
    const invoicePrice = pricedQuantity > 0 ? pricedValue / pricedQuantity : null;
    const invoicePriceVariance = invoicePrice !== null ? invoicePrice - effectiveUnitPrice : null;
    const invoiceValueVariance = hasInvoicePricing ? invoicedValue - invoiced * effectiveUnitPrice : null;

    const invoiceNumbers = Array.from(
      new Set(
        lineBatches
          .map((batch) => batch.supplier_invoice_number?.trim() ?? "")
          .filter((value) => value.length > 0),
      ),
    );

    const batchNumbers = lineBatches.map((batch) => batch.batch_number);

    const invoicedVariance = lineBatches.length > 0 ? invoiced - ordered : null;
    const receivedVariance = fullyReceived ? received - invoiced : null;

    let status: MatchStatus = "matched";

    if (lineBatches.length === 0) {
      status = "awaiting_invoice";
    } else if (invoicedVariance !== null && differs(invoiced, ordered)) {
      status = "variance";
    } else if (!hasReceipts) {
      status = "awaiting_receipt";
    } else if (!fullyReceived) {
      status = "part_received";
    } else if (differs(received, invoiced)) {
      status = "variance";
    } else if (!fullyPriced) {
      status = "awaiting_price";
    } else if (invoicePriceVariance !== null && Math.abs(invoicePriceVariance) > PRICE_EPSILON) {
      status = "price_variance";
    }

    return {
      id: item.id,
      purchase_order_id: item.purchase_order_id,
      product_id: item.product_id,
      ordered,
      invoiced,
      received,
      invoicedVariance,
      receivedVariance,
      hasReceipts,
      fullyReceived,
      effectiveUnitPrice,
      orderedValue,
      invoicedValue,
      receivedValue: received * effectiveUnitPrice,
      invoicePrice,
      invoicePriceVariance,
      invoiceValueVariance,
      hasInvoicePricing,
      fullyPriced,
      invoiceNumbers,
      batchNumbers,
      missingInvoiceNumber: lineBatches.length > 0 && invoiceNumbers.length === 0,
      status,
      batchCount: lineBatches.length,
    };
  });
}

export function unlinkedBatches<T extends MatchBatchInput>(batches: T[]): T[] {
  return batches.filter((batch) => !batch.purchase_order_item_id);
}
