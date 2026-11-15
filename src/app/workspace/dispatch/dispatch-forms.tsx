"use client";

import { useActionState } from "react";
import { assignTrip, createTrip, type DispatchActionState } from "./actions";

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
        A trip can have one active primary truck and driver. Additional assignments are allowed.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Assigning…" : "Assign trip"}
      </button>
    </form>
  );
}
