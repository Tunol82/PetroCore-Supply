"use client";

import { useActionState } from "react";
import { receiveInventoryBatch, type InventoryActionState } from "./actions";

export type Option = { id: string; label: string };

const initialState: InventoryActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: InventoryActionState }) {
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

export function ReceiptForm({
  batches,
  locations,
}: {
  batches: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(receiveInventoryBatch, initialState);
  const ready = batches.length > 0 && locations.length > 0;
  const blocker =
    batches.length === 0
      ? "No storage procurement has an outstanding quantity to receive."
      : locations.length === 0
        ? "No active storage location exists. Ask an administrator to add one."
        : null;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="iv-batch" className={labelClass}>Procurement batch</label>
          <select id="iv-batch" name="procurementBatchId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a storage procurement batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="iv-location" className={labelClass}>Storage location</label>
          <select id="iv-location" name="locationId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a storage location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="iv-quantity" className={labelClass}>Received quantity</label>
          <input
            id="iv-quantity"
            name="originalQuantity"
            type="number"
            step="0.001"
            min="0"
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="iv-cost" className={labelClass}>Landed cost per unit (optional)</label>
          <input id="iv-cost" name="landedCostPerUnit" type="number" step="0.0001" min="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="iv-date" className={labelClass}>Received on (optional)</label>
          <input id="iv-date" name="receivedOn" type="date" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Only procurement recorded as a storage receipt can create stock. Receipts are cumulative: the total received
        cannot exceed the verified quantity, and the product is taken from the procurement batch.
      </p>
      {blocker ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{blocker}</p>
      ) : null}
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending || !ready}>
        {pending ? "Receiving…" : "Receive stock"}
      </button>
    </form>
  );
}
