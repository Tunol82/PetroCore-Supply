"use client";

import { useActionState } from "react";
import { addTransporterInvoiceLine, createTransporterInvoice, type InvoiceActionState } from "./actions";

export type Option = { id: string; label: string };

const initialState: InvoiceActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: InvoiceActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {state.success}
      </p>
    );
  }

  return null;
}

export function TransporterInvoiceForm({
  transporters,
  trips,
}: {
  transporters: Option[];
  trips: Option[];
}) {
  const [state, formAction, pending] = useActionState(createTransporterInvoice, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ti-number" className={labelClass}>Invoice number</label>
          <input id="ti-number" name="invoiceNumber" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ti-transporter" className={labelClass}>Transporter</label>
          <select id="ti-transporter" name="transporterId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a transporter</option>
            {transporters.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ti-trip" className={labelClass}>Trip (optional)</label>
          <select id="ti-trip" name="tripId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {trips.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ti-date" className={labelClass}>Invoice date</label>
          <input id="ti-date" name="invoiceDate" type="date" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ti-subtotal" className={labelClass}>Subtotal (NGN)</label>
          <input id="ti-subtotal" name="subtotal" type="number" step="0.01" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ti-tax" className={labelClass}>Tax (optional)</label>
          <input id="ti-tax" name="taxAmount" type="number" step="0.01" min="0" className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ti-notes" className={labelClass}>Notes</label>
          <input id="ti-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Recorded as supplied. Liability is not assessed and no payable or deduction is created.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record invoice"}
      </button>
    </form>
  );
}

export function InvoiceLineForm({ invoices }: { invoices: Option[] }) {
  const [state, formAction, pending] = useActionState(addTransporterInvoiceLine, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="il-invoice" className={labelClass}>Invoice</label>
          <select id="il-invoice" name="invoiceId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select an invoice</option>
            {invoices.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="il-description" className={labelClass}>Description</label>
          <input id="il-description" name="description" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="il-quantity" className={labelClass}>Quantity</label>
          <input id="il-quantity" name="quantity" type="number" step="0.001" min="0" defaultValue="1" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="il-rate" className={labelClass}>Unit rate (NGN)</label>
          <input id="il-rate" name="unitRate" type="number" step="0.01" min="0" required className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Adding…" : "Add line"}
      </button>
    </form>
  );
}
