"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";
import { FormDraft } from "@/components/ui/form-draft";

import { ToastOnState } from "@/components/ui/toast";

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
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--muted)] disabled:shadow-none";

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
  defaultCorrectionMethod,
}: {
  trips: Option[];
  salesLines: Option[];
  loadingRecords: Option[];
  locations: Option[];
  products: Option[];
  defaultCorrectionMethod?: string | null;
}) {
  const [state, formAction, pending] = useActionState(recordDelivery, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <FormDraft storageKey="delivery:new" state={state} />
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
        <div>
          <label htmlFor="dl-temp" className={labelClass}>Observed temperature (°C)</label>
          <input id="dl-temp" name="observedTemperatureC" type="number" step="0.01" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-density" className={labelClass}>Density at 15 °C</label>
          <input id="dl-density" name="density15c" type="number" step="0.01" min="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dl-method" className={labelClass}>Correction method</label>
          <input
            id="dl-method"
            name="correctionMethod"
            className={fieldClass}
            placeholder="Optional"
            defaultValue={defaultCorrectionMethod ?? ""}
          />
        </div>
        <div>
          <label htmlFor="dl-factor" className={labelClass}>Correction factor</label>
          <input id="dl-factor" name="correctionFactor" type="number" step="0.000001" min="0" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Cumulative deliveries cannot exceed the ordered quantity. Confirmed quantity cannot exceed delivered quantity.
        Measurement fields are optional.
      </p>
      <Feedback state={state} />
      <ToastOnState state={state} />
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
      <UnsavedGuard />
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
        <div className="sm:col-span-2">
          <label htmlFor="ev-file" className={labelClass}>Evidence file</label>
          <input
            id="ev-file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ev-notes" className={labelClass}>Notes</label>
          <input id="ev-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Files upload to private tenant storage. JPEG, PNG, WebP or PDF up to 5 MB. Evidence is append-only.
      </p>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Uploading…" : "Upload evidence"}
      </button>
    </form>
  );
}
