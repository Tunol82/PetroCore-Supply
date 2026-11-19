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
};

export type MatchStatus =
  | "awaiting_invoice"
  | "awaiting_receipt"
  | "part_received"
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
  invoiceNumbers: string[];
  batchNumbers: string[];
  missingInvoiceNumber: boolean;
  status: MatchStatus;
  batchCount: number;
};

/**
 * Quantities are stored to three decimals, so anything within half a unit of
 * the third decimal is treated as equal rather than a variance.
 */
export const MATCH_EPSILON = 0.0005;

function quantity(value: Numeric | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > MATCH_EPSILON;
}

/**
 * Builds the ordered / invoiced / received comparison for purchase-order lines.
 *
 * "Invoiced" is the supplier quantity recorded on each linked procurement
 * batch, together with its supplier invoice reference. Invoice unit prices are
 * not captured yet, so values use the PO effective rate (line total divided by
 * ordered quantity, which already reflects the discount).
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
      invoicedValue: invoiced * effectiveUnitPrice,
      receivedValue: received * effectiveUnitPrice,
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
