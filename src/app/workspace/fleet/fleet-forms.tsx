"use client";

import { useActionState } from "react";
import {
  createCompartment,
  createDriver,
  createTransporter,
  createTruck,
  type FleetActionState,
} from "./actions";

export type Option = { id: string; label: string };

const initialState: FleetActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: FleetActionState }) {
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

export function TransporterForm() {
  const [state, formAction, pending] = useActionState(createTransporter, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tp-code" className={labelClass}>Transporter code</label>
          <input id="tp-code" name="transporterCode" required className={fieldClass} placeholder="TR-001" />
        </div>
        <div>
          <label htmlFor="tp-name" className={labelClass}>Business name</label>
          <input id="tp-name" name="businessName" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tp-contact" className={labelClass}>Contact person</label>
          <input id="tp-contact" name="contactPerson" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tp-phone" className={labelClass}>Phone</label>
          <input id="tp-phone" name="phone" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tp-email" className={labelClass}>Email</label>
          <input id="tp-email" name="email" type="email" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tp-terms" className={labelClass}>Payment terms</label>
          <input id="tp-terms" name="paymentTerms" className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="tp-address" className={labelClass}>Address</label>
        <input id="tp-address" name="address" className={fieldClass} />
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save transporter"}
      </button>
    </form>
  );
}

export function TruckForm({ transporters }: { transporters: Option[] }) {
  const [state, formAction, pending] = useActionState(createTruck, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tr-reg" className={labelClass}>Registration number</label>
          <input id="tr-reg" name="registrationNumber" required className={fieldClass} placeholder="LAG-123-XY" />
        </div>
        <div>
          <label htmlFor="tr-transporter" className={labelClass}>Transporter (third-party)</label>
          <select id="tr-transporter" name="transporterId" className={fieldClass} defaultValue="">
            <option value="">Company-owned</option>
            {transporters.map((transporter) => (
              <option key={transporter.id} value={transporter.id}>{transporter.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tr-capacity" className={labelClass}>Capacity</label>
          <input id="tr-capacity" name="capacity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tr-make" className={labelClass}>Make</label>
          <input id="tr-make" name="make" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tr-model" className={labelClass}>Model</label>
          <input id="tr-model" name="model" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tr-year" className={labelClass}>Year</label>
          <input id="tr-year" name="year" type="number" min="1900" max="2100" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tr-ownership" className={labelClass}>Ownership</label>
          <select id="tr-ownership" name="ownershipType" className={fieldClass} defaultValue="company">
            <option value="company">Company</option>
            <option value="third_party">Third party</option>
          </select>
        </div>
        <div>
          <label htmlFor="tr-status" className={labelClass}>Status</label>
          <select id="tr-status" name="status" className={fieldClass} defaultValue="active">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save truck"}
      </button>
    </form>
  );
}

export function CompartmentForm({ trucks }: { trucks: Option[] }) {
  const [state, formAction, pending] = useActionState(createCompartment, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cp-truck" className={labelClass}>Truck</label>
          <select id="cp-truck" name="truckId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cp-number" className={labelClass}>Compartment number</label>
          <input id="cp-number" name="compartmentNumber" required className={fieldClass} placeholder="1" />
        </div>
        <div>
          <label htmlFor="cp-capacity" className={labelClass}>Capacity</label>
          <input id="cp-capacity" name="capacity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="cp-compatibility" className={labelClass}>Product compatibility</label>
        <input id="cp-compatibility" name="productCompatibility" className={fieldClass} />
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save compartment"}
      </button>
    </form>
  );
}

export function DriverForm({ transporters }: { transporters: Option[] }) {
  const [state, formAction, pending] = useActionState(createDriver, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="dv-code" className={labelClass}>Driver code</label>
          <input id="dv-code" name="driverCode" required className={fieldClass} placeholder="DRV-001" />
        </div>
        <div>
          <label htmlFor="dv-name" className={labelClass}>Full name</label>
          <input id="dv-name" name="fullName" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dv-phone" className={labelClass}>Phone</label>
          <input id="dv-phone" name="phone" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dv-licence" className={labelClass}>Licence number</label>
          <input id="dv-licence" name="licenceNumber" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dv-expiry" className={labelClass}>Licence expiry</label>
          <input id="dv-expiry" name="licenceExpiry" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dv-type" className={labelClass}>Driver type</label>
          <select id="dv-type" name="driverType" className={fieldClass} defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="third_party">Third party</option>
          </select>
        </div>
        <div>
          <label htmlFor="dv-transporter" className={labelClass}>Transporter (third-party)</label>
          <select id="dv-transporter" name="transporterId" className={fieldClass} defaultValue="">
            <option value="">Not applicable</option>
            {transporters.map((transporter) => (
              <option key={transporter.id} value={transporter.id}>{transporter.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Third-party drivers are operational records only and create no payroll obligation.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save driver"}
      </button>
    </form>
  );
}
