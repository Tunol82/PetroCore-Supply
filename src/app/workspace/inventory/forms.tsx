"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";
import { FormDraft } from "@/components/ui/form-draft";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState, useState } from "react";
import { receiveInventoryBatch, type InventoryActionState } from "./actions";

export type Option = { id: string; label: string };

export type BatchCostHint = {
  purchaseUnitPrice: number | null;
  purchaseValue: number | null;
  landedComponents: number;
  componentCount: number;
  quantity: number | null;
  indicativeUnitCost: number | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

const initialState: InventoryActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--muted)] disabled:shadow-none";

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
  costHints,
}: {
  batches: Option[];
  locations: Option[];
  costHints: Record<string, BatchCostHint>;
}) {
  const [state, formAction, pending] = useActionState(receiveInventoryBatch, initialState);
  const [batchId, setBatchId] = useState("");
  const [enteredCost, setEnteredCost] = useState("");
  const ready = batches.length > 0 && locations.length > 0;
  const hint = batchId ? costHints[batchId] : undefined;
  const hintHasData =
    hint !== undefined && (hint.purchaseValue !== null || hint.landedComponents > 0 || hint.quantity !== null);
  const entered = Number(enteredCost);
  const indicative = hint?.indicativeUnitCost ?? null;
  const variance =
    indicative !== null && enteredCost.trim().length > 0 && Number.isFinite(entered) ? entered - indicative : null;
  const blocker =
    batches.length === 0
      ? "No storage procurement has an outstanding quantity to receive."
      : locations.length === 0
        ? "No active storage location exists. Ask an administrator to add one."
        : null;

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <FormDraft storageKey="receipt:new" state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="iv-batch" className={labelClass}>Procurement batch</label>
          <select
            id="iv-batch"
            name="procurementBatchId"
            required
            className={fieldClass}
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
          >
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
          <input
            id="iv-cost"
            name="landedCostPerUnit"
            type="number"
            step="0.0001"
            min="0"
            className={fieldClass}
            value={enteredCost}
            onChange={(event) => setEnteredCost(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="iv-date" className={labelClass}>Received on (optional)</label>
          <input id="iv-date" name="receivedOn" type="date" className={fieldClass} />
        </div>
      </div>

      {batchId ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3">
          {hintHasData && hint ? (
            <div className="space-y-1.5 text-xs">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Indicative landed cost
              </p>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Purchase price per unit</span>
                <span className="tabular font-medium">
                  {hint.purchaseUnitPrice === null ? "Not priced" : formatMoney(hint.purchaseUnitPrice)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">
                  Landed components ({hint.componentCount} recorded, pending included)
                </span>
                <span className="tabular font-medium">{formatMoney(hint.landedComponents)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Batch quantity</span>
                <span className="tabular font-medium">
                  {hint.quantity === null ? "Not recorded" : formatQuantity(hint.quantity)}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-1.5">
                <span className="font-medium">Indicative cost per unit</span>
                <span className="tabular font-semibold">
                  {hint.indicativeUnitCost === null ? "Needs a purchase price" : formatMoney(hint.indicativeUnitCost)}
                </span>
              </div>
              {variance !== null ? (
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--muted)]">Your entry vs indicative</span>
                  <span className={`tabular font-medium ${Math.abs(variance) < 0.0001 ? "" : variance > 0 ? "text-[var(--warning)]" : "text-[var(--brand)]"}`}>
                    {variance > 0 ? "+" : ""}
                    {formatMoney(variance)}
                  </span>
                </div>
              ) : null}
              <p className="pt-1 text-[11px] leading-5 text-[var(--muted)]">
                Indicative only. The posted cost is the number you enter above; components are not allocated automatically.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              No purchase price or landed components are recorded for this batch, so there is nothing to compare.
            </p>
          )}
        </div>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        Only procurement recorded as a storage receipt can create stock. Receipts are cumulative: the total received
        cannot exceed the verified quantity, and the product is taken from the procurement batch.
      </p>
      {blocker ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{blocker}</p>
      ) : null}
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending || !ready}>
        {pending ? "Receiving…" : "Receive stock"}
      </button>
    </form>
  );
}
