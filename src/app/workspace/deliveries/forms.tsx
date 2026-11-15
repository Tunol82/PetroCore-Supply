"use client";

import { useActionState } from "react";
import {
  addDeliveryEvidence,
  recordDelivery,
  type DispatchActionState,
} from "@/app/workspace/dispatch/actions";

export type Option = { id: string; label: string };

const initialState: DispatchActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: DispatchActionState }) {
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

export function DeliveryForm({
  trips,
  salesLines,
  loadingRecords,
  locations,
  products,
}: {
  trips: Option[];
  salesLines: Option[];
  loadingRecords: Option[];
  locations: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(recordDelivery, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="dl-trip" className={labelClass}>Trip</label>
          <select id="dl-trip" name="tripId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dl-sales-line" className={labelClass}>Sales order line</label>
          <select id="dl-sales-line" name="salesOrderItemId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select an order line</option>
            {salesLines.map((line) => (
              <option key={line.id} value={line.id}>{line.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dl-product" className={labelClass}>Product</label>
          <select id="dl-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dl-location" className={labelClass}>Delivery location</label>
          <select id="dl-location" name="customerLocationId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dl-loading" className={labelClass}>Loading record (optional)</label>
          <select id="dl-loading" name="tripLoadingRecordId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {loadingRecords.map((record) => (
              <option key={record.id} value={record.id}>{record.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dl-delivered" className={labelClass}>Delivered quantity</label>
          <input id="dl-delivered" name="deliveredQuantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-confirmed" className={labelClass}>Customer-confirmed quantity</label>
          <input id="dl-confirmed" name="customerConfirmedQuantity" type="number" step="0.001" min="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-status" className={labelClass}>Delivery status</label>
          <select id="dl-status" name="deliveryStatus" className={fieldClass} defaultValue="complete">
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="rejected">Rejected</option>
            <option value="disputed">Disputed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label htmlFor="dl-waybill" className={labelClass}>Waybill reference</label>
          <input id="dl-waybill" name="waybillReference" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-ack" className={labelClass}>Customer acknowledgement</label>
          <input id="dl-ack" name="customerAcknowledgement" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-date" className={labelClass}>Delivery date</label>
          <input id="dl-date" name="deliveryDate" type="date" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Cumulative deliveries cannot exceed the ordered quantity. Confirmed quantity cannot exceed delivered quantity.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record delivery"}
      </button>
    </form>
  );
}

export function EvidenceForm({ deliveries }: { deliveries: Option[] }) {
  const [state, formAction, pending] = useActionState(addDeliveryEvidence, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ev-delivery" className={labelClass}>Delivery record</label>
          <select id="ev-delivery" name="deliveryRecordId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a delivery</option>
            {deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>{delivery.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ev-type" className={labelClass}>Evidence type</label>
          <select id="ev-type" name="evidenceType" className={fieldClass} defaultValue="photo">
            <option value="signature">Signature</option>
            <option value="photo">Photo</option>
            <option value="waybill">Waybill</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="ev-path" className={labelClass}>Storage reference</label>
          <input id="ev-path" name="filePath" required className={fieldClass} placeholder="deliveries/2026/waybill.jpg" />
        </div>
        <div>
          <label htmlFor="ev-notes" className={labelClass}>Notes</label>
          <input id="ev-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        File upload is not implemented yet; this records the secure storage reference only.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save evidence"}
      </button>
    </form>
  );
}
