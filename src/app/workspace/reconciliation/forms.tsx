"use client";

import { useActionState } from "react";
import {
  addReconciliationItem,
  createReconciliation,
  recordInvestigation,
  reportDiscrepancy,
  type ReconciliationActionState,
} from "./actions";

export type Option = { id: string; label: string };

const initialState: ReconciliationActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: ReconciliationActionState }) {
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

export function ReconciliationForm({ trips }: { trips: Option[] }) {
  const [state, formAction, pending] = useActionState(createReconciliation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rc-trip" className={labelClass}>Trip</label>
          <select id="rc-trip" name="tripId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rc-number" className={labelClass}>Reconciliation number</label>
          <input id="rc-number" name="reconciliationNumber" required className={fieldClass} placeholder="REC-2026-0001" />
        </div>
        <div>
          <label htmlFor="rc-status" className={labelClass}>Status</label>
          <select id="rc-status" name="status" className={fieldClass} defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
        <div>
          <label htmlFor="rc-notes" className={labelClass}>Notes</label>
          <input id="rc-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save reconciliation"}
      </button>
    </form>
  );
}

export function ReconciliationItemForm({
  reconciliations,
  loadingRecords,
  deliveries,
  products,
}: {
  reconciliations: Option[];
  loadingRecords: Option[];
  deliveries: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(addReconciliationItem, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ri-reconciliation" className={labelClass}>Reconciliation</label>
          <select id="ri-reconciliation" name="reconciliationId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a reconciliation</option>
            {reconciliations.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-product" className={labelClass}>Product</label>
          <select id="ri-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-status" className={labelClass}>Item status</label>
          <select id="ri-status" name="reconciliationStatus" className={fieldClass} defaultValue="flagged">
            <option value="within_tolerance">Within tolerance</option>
            <option value="flagged">Flagged</option>
            <option value="investigated">Investigated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label htmlFor="ri-loading" className={labelClass}>Loading record (optional)</label>
          <select id="ri-loading" name="tripLoadingRecordId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {loadingRecords.map((record) => (
              <option key={record.id} value={record.id}>{record.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-delivery" className={labelClass}>Delivery record (optional)</label>
          <select id="ri-delivery" name="tripDeliveryRecordId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>{delivery.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-loaded" className={labelClass}>Loaded quantity</label>
          <input id="ri-loaded" name="loadedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ri-delivered" className={labelClass}>Delivered quantity</label>
          <input id="ri-delivered" name="deliveredQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ri-notes" className={labelClass}>Notes</label>
          <input id="ri-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save item"}
      </button>
    </form>
  );
}

export function DiscrepancyForm({ items }: { items: Option[] }) {
  const [state, formAction, pending] = useActionState(reportDiscrepancy, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="dc-item" className={labelClass}>Reconciliation item</label>
          <select id="dc-item" name="reconciliationItemId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select an item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dc-type" className={labelClass}>Discrepancy type</label>
          <select id="dc-type" name="discrepancyType" className={fieldClass} defaultValue="transport">
            <option value="supplier">Supplier</option>
            <option value="loading">Loading</option>
            <option value="transport">Transport</option>
            <option value="customer_measurement">Customer measurement</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-status" className={labelClass}>Status</label>
          <select id="dc-status" name="status" className={fieldClass} defaultValue="open">
            <option value="open">Open</option>
            <option value="under_investigation">Under investigation</option>
            <option value="resolved">Resolved</option>
            <option value="approved_loss">Approved loss</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-expected" className={labelClass}>Expected quantity</label>
          <input id="dc-expected" name="expectedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dc-actual" className={labelClass}>Actual quantity</label>
          <input id="dc-actual" name="actualQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dc-impact" className={labelClass}>Provisional impact (optional)</label>
          <input id="dc-impact" name="provisionalFinancialImpact" type="number" step="0.01" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        A discrepancy is not a loss or liability. It requires investigation and authorised confirmation.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record discrepancy"}
      </button>
    </form>
  );
}

export function InvestigationForm({ discrepancies }: { discrepancies: Option[] }) {
  const [state, formAction, pending] = useActionState(recordInvestigation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="in-discrepancy" className={labelClass}>Discrepancy</label>
          <select id="in-discrepancy" name="discrepancyId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a discrepancy</option>
            {discrepancies.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="in-party" className={labelClass}>Responsible party type</label>
          <select id="in-party" name="responsiblePartyType" className={fieldClass} defaultValue="unresolved">
            <option value="supplier">Supplier</option>
            <option value="transporter">Transporter</option>
            <option value="customer">Customer</option>
            <option value="internal">Internal</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
        <div>
          <label htmlFor="in-status" className={labelClass}>Responsibility status</label>
          <select id="in-status" name="responsibilityStatus" className={fieldClass} defaultValue="undetermined">
            <option value="undetermined">Undetermined</option>
            <option value="confirmed">Confirmed</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>
        <div>
          <label htmlFor="in-findings" className={labelClass}>Findings</label>
          <input id="in-findings" name="findings" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="in-resolution" className={labelClass}>Resolution</label>
          <input id="in-resolution" name="resolution" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record investigation"}
      </button>
    </form>
  );
}
