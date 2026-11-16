"use client";

import { useActionState, useState } from "react";
import { recordPayment, type FinanceActionState } from "./actions";

export type Option = { id: string; label: string };

const initialState: FinanceActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--muted)] disabled:shadow-none";

export function PaymentForm({
  customers,
  suppliers,
  transporters,
  salesOrders,
  purchaseOrders,
  transporterInvoices,
}: {
  customers: Option[];
  suppliers: Option[];
  transporters: Option[];
  salesOrders: Option[];
  purchaseOrders: Option[];
  transporterInvoices: Option[];
}) {
  const [state, formAction, pending] = useActionState(recordPayment, initialState);
  const [direction, setDirection] = useState<"receipt" | "payment">("receipt");

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="pm-direction" className={labelClass}>Direction</label>
          <select
            id="pm-direction"
            name="direction"
            className={fieldClass}
            value={direction}
            onChange={(event) => setDirection(event.target.value as "receipt" | "payment")}
          >
            <option value="receipt">Receipt from customer</option>
            <option value="payment">Payment to supplier or transporter</option>
          </select>
        </div>

        {direction === "receipt" ? (
          <div>
            <label htmlFor="pm-customer" className={labelClass}>Customer</label>
            <select id="pm-customer" name="customerId" required className={fieldClass} defaultValue="">
              <option value="" disabled>Select a customer</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="pm-supplier" className={labelClass}>Supplier (optional)</label>
              <select id="pm-supplier" name="supplierId" className={fieldClass} defaultValue="">
                <option value="">No supplier</option>
                {suppliers.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pm-transporter" className={labelClass}>Transporter (optional)</label>
              <select id="pm-transporter" name="transporterId" className={fieldClass} defaultValue="">
                <option value="">No transporter</option>
                {transporters.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label htmlFor="pm-amount" className={labelClass}>Amount (NGN)</label>
          <input id="pm-amount" name="amount" type="number" step="0.01" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="pm-method" className={labelClass}>Method</label>
          <select id="pm-method" name="method" className={fieldClass} defaultValue="bank_transfer">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="pos">POS</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="pm-date" className={labelClass}>Paid on (optional)</label>
          <input id="pm-date" name="paidAt" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="pm-reference" className={labelClass}>Reference</label>
          <input id="pm-reference" name="reference" className={fieldClass} placeholder="Transfer or receipt number" />
        </div>

        {direction === "receipt" ? (
          <div>
            <label htmlFor="pm-sales-order" className={labelClass}>Sales order (optional)</label>
            <select id="pm-sales-order" name="salesOrderId" className={fieldClass} defaultValue="">
              <option value="">Not linked</option>
              {salesOrders.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="pm-purchase-order" className={labelClass}>Purchase order (optional)</label>
              <select id="pm-purchase-order" name="purchaseOrderId" className={fieldClass} defaultValue="">
                <option value="">Not linked</option>
                {purchaseOrders.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pm-transporter-invoice" className={labelClass}>Transporter invoice (optional)</label>
              <select id="pm-transporter-invoice" name="transporterInvoiceId" className={fieldClass} defaultValue="">
                <option value="">Not linked</option>
                {transporterInvoices.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="pm-notes" className={labelClass}>Notes</label>
          <input id="pm-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Payments are recorded as supplied. Links are explicit; there is no automatic matching, ageing or write-off.
      </p>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
