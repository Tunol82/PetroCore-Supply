"use client";

import { useActionState } from "react";
import {
  addLoadingAllocation,
  assignTrip,
  closeTrip,
  createLoadingRecord,
  createTrip,
  releaseAssignment,
  type DispatchActionState,
} from "./actions";

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

export function TripForm({
  depots,
  locations,
}: {
  depots: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="trip-number" className={labelClass}>Trip number</label>
          <input id="trip-number" name="tripNumber" required className={fieldClass} placeholder="TRIP-2026-0001" />
        </div>
        <div>
          <label htmlFor="trip-origin-depot" className={labelClass}>Origin supplier depot</label>
          <select id="trip-origin-depot" name="originSupplierDepotId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>{depot.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trip-origin-location" className={labelClass}>Origin location</label>
          <select id="trip-origin-location" name="originLocationId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trip-destination" className={labelClass}>Destination location</label>
          <select id="trip-destination" name="destinationLocationId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trip-departure" className={labelClass}>Departure date</label>
          <input id="trip-departure" name="departureDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="trip-expected" className={labelClass}>Expected arrival</label>
          <input id="trip-expected" name="expectedArrivalDate" type="date" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save trip"}
      </button>
    </form>
  );
}

export function AssignmentForm({
  trips,
  trucks,
  drivers,
  transporters,
}: {
  trips: Option[];
  trucks: Option[];
  drivers: Option[];
  transporters: Option[];
}) {
  const [state, formAction, pending] = useActionState(assignTrip, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="as-trip" className={labelClass}>Trip</label>
          <select id="as-trip" name="tripId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="as-truck" className={labelClass}>Truck</label>
          <select id="as-truck" name="truckId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="as-driver" className={labelClass}>Driver</label>
          <select id="as-driver" name="driverId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a driver</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="as-transporter" className={labelClass}>Transporter (optional)</label>
          <select id="as-transporter" name="transporterId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {transporters.map((transporter) => (
              <option key={transporter.id} value={transporter.id}>{transporter.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="as-role" className={labelClass}>Assignment role</label>
          <select id="as-role" name="assignmentRole" className={fieldClass} defaultValue="primary">
            <option value="primary">Primary</option>
            <option value="additional">Additional</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        A truck or driver can hold only one active assignment. Release the previous assignment before reuse, or cancel
        the trip to release it automatically.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Assigning…" : "Assign trip"}
      </button>
    </form>
  );
}

export function ReleaseAssignmentForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(releaseAssignment, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button
        type="submit"
        className="rounded-lg border border-[var(--brand)] px-2 py-1 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/5 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Releasing…" : "Release"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

export function LoadingRecordForm({
  trips,
  compartments,
  products,
  defaultCorrectionMethod,
}: {
  trips: Option[];
  compartments: Option[];
  products: Option[];
  defaultCorrectionMethod?: string | null;
}) {
  const [state, formAction, pending] = useActionState(createLoadingRecord, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ld-trip" className={labelClass}>Trip</label>
          <select id="ld-trip" name="tripId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ld-compartment" className={labelClass}>Compartment</label>
          <select id="ld-compartment" name="compartmentId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a compartment</option>
            {compartments.map((compartment) => (
              <option key={compartment.id} value={compartment.id}>{compartment.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ld-product" className={labelClass}>Product</label>
          <select id="ld-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ld-quantity" className={labelClass}>Loaded quantity</label>
          <input id="ld-quantity" name="loadedQuantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-ticket" className={labelClass}>Loading ticket</label>
          <input id="ld-ticket" name="loadingTicket" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-seal" className={labelClass}>Seal number</label>
          <input id="ld-seal" name="sealNumber" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-date" className={labelClass}>Loading date</label>
          <input id="ld-date" name="loadingDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-temp" className={labelClass}>Observed temperature (°C)</label>
          <input id="ld-temp" name="observedTemperatureC" type="number" step="0.01" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-density" className={labelClass}>Density at 15 °C</label>
          <input id="ld-density" name="density15c" type="number" step="0.01" min="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ld-method" className={labelClass}>Correction method</label>
          <input
            id="ld-method"
            name="correctionMethod"
            className={fieldClass}
            placeholder="Optional"
            defaultValue={defaultCorrectionMethod ?? ""}
          />
        </div>
        <div>
          <label htmlFor="ld-factor" className={labelClass}>Correction factor</label>
          <input id="ld-factor" name="correctionFactor" type="number" step="0.000001" min="0" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Measurement fields are optional. A corrected quantity is derived when a factor is supplied; no method is applied
        automatically.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record loading"}
      </button>
    </form>
  );
}

export function CloseTripForm({
  tripId,
  unresolvedItems,
  policy,
  canOverride,
}: {
  tripId: string;
  unresolvedItems: number;
  policy: "allow" | "warn" | "block";
  canOverride: boolean;
}) {
  const [state, formAction, pending] = useActionState(closeTrip, initialState);
  const needsReason = policy === "block" && unresolvedItems > 0;
  const blocked = needsReason && !canOverride;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tripId" value={tripId} />
      <input
        name="reason"
        placeholder={needsReason ? "Override reason (required)" : "Reason (optional)"}
        disabled={blocked}
        className="w-52 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 disabled:bg-[var(--surface-3)]"
      />
      <button
        type="submit"
        disabled={pending || blocked}
        className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--muted)]"
      >
        {pending ? "Closing…" : blocked ? "Override needed" : "Close trip"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function LoadingAllocationForm({
  loadingRecords,
  batches,
  salesOrderLines,
  products,
}: {
  loadingRecords: Option[];
  batches: Option[];
  salesOrderLines: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(addLoadingAllocation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="la-record" className={labelClass}>Loading record</label>
          <select id="la-record" name="loadingRecordId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a loading record</option>
            {loadingRecords.map((record) => (
              <option key={record.id} value={record.id}>{record.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="la-batch" className={labelClass}>Procurement batch</label>
          <select id="la-batch" name="procurementBatchId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="la-product" className={labelClass}>Product</label>
          <select id="la-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="la-sales-line" className={labelClass}>Sales order line (optional)</label>
          <select id="la-sales-line" name="salesOrderItemId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {salesOrderLines.map((line) => (
              <option key={line.id} value={line.id}>{line.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="la-quantity" className={labelClass}>Allocated quantity</label>
          <input id="la-quantity" name="allocatedQuantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Allocations are checked against the loaded quantity and the procurement batch quantity.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save allocation"}
      </button>
    </form>
  );
}
