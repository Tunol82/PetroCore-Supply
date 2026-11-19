"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";
import { ToastOnState } from "@/components/ui/toast";

import { useActionState } from "react";
import {
  createCompartment,
  createDriver,
  createTransporter,
  createTruck,
  updateCompartment,
  updateDriver,
  updateTransporter,
  updateTruck,
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

export type TransporterRecord = {
  id: string;
  transporter_code: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
};

export function TransporterForm({ transporter }: { transporter?: TransporterRecord }) {
  const [state, formAction, pending] = useActionState(
    transporter ? updateTransporter : createTransporter,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {transporter ? <input type="hidden" name="id" value={transporter.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tp-code" className={labelClass}>Transporter code</label>
          <input
            id="tp-code"
            name="transporterCode"
            required
            className={fieldClass}
            placeholder="TR-001"
            defaultValue={transporter?.transporter_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="tp-name" className={labelClass}>Business name</label>
          <input
            id="tp-name"
            name="businessName"
            required
            className={fieldClass}
            defaultValue={transporter?.business_name ?? ""}
          />
        </div>
        <div>
          <label htmlFor="tp-contact" className={labelClass}>Contact person</label>
          <input
            id="tp-contact"
            name="contactPerson"
            className={fieldClass}
            defaultValue={transporter?.contact_person ?? ""}
          />
        </div>
        <div>
          <label htmlFor="tp-phone" className={labelClass}>Phone</label>
          <input id="tp-phone" name="phone" className={fieldClass} defaultValue={transporter?.phone ?? ""} />
        </div>
        <div>
          <label htmlFor="tp-email" className={labelClass}>Email</label>
          <input
            id="tp-email"
            name="email"
            type="email"
            className={fieldClass}
            defaultValue={transporter?.email ?? ""}
          />
        </div>
        <div>
          <label htmlFor="tp-terms" className={labelClass}>Payment terms</label>
          <input
            id="tp-terms"
            name="paymentTerms"
            className={fieldClass}
            defaultValue={transporter?.payment_terms ?? ""}
          />
        </div>
      </div>
      <div>
        <label htmlFor="tp-address" className={labelClass}>Address</label>
        <input id="tp-address" name="address" className={fieldClass} defaultValue={transporter?.address ?? ""} />
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : transporter ? "Save changes" : "Save transporter"}
      </button>
    </form>
  );
}

export type TruckRecord = {
  id: string;
  registration_number: string;
  transporter_id: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity: number;
  ownership_type: string;
  status: string;
};

export function TruckForm({ transporters, truck }: { transporters: Option[]; truck?: TruckRecord }) {
  const [state, formAction, pending] = useActionState(truck ? updateTruck : createTruck, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {truck ? <input type="hidden" name="id" value={truck.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tr-reg" className={labelClass}>Registration number</label>
          <input
            id="tr-reg"
            name="registrationNumber"
            required
            className={fieldClass}
            placeholder="LAG-123-XY"
            defaultValue={truck?.registration_number ?? ""}
          />
        </div>
        <div>
          <label htmlFor="tr-transporter" className={labelClass}>Transporter (third-party)</label>
          <select
            id="tr-transporter"
            name="transporterId"
            className={fieldClass}
            defaultValue={truck?.transporter_id ?? ""}
          >
            <option value="">Company-owned</option>
            {transporters.map((transporter) => (
              <option key={transporter.id} value={transporter.id}>{transporter.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tr-capacity" className={labelClass}>Capacity</label>
          <input
            id="tr-capacity"
            name="capacity"
            type="number"
            step="0.001"
            min="0.001"
            required
            className={fieldClass}
            defaultValue={truck ? String(truck.capacity) : ""}
          />
        </div>
        <div>
          <label htmlFor="tr-make" className={labelClass}>Make</label>
          <input id="tr-make" name="make" className={fieldClass} defaultValue={truck?.make ?? ""} />
        </div>
        <div>
          <label htmlFor="tr-model" className={labelClass}>Model</label>
          <input id="tr-model" name="model" className={fieldClass} defaultValue={truck?.model ?? ""} />
        </div>
        <div>
          <label htmlFor="tr-year" className={labelClass}>Year</label>
          <input
            id="tr-year"
            name="year"
            type="number"
            min="1900"
            max="2100"
            className={fieldClass}
            defaultValue={truck?.year ? String(truck.year) : ""}
          />
        </div>
        <div>
          <label htmlFor="tr-ownership" className={labelClass}>Ownership</label>
          <select
            id="tr-ownership"
            name="ownershipType"
            className={fieldClass}
            defaultValue={truck?.ownership_type ?? "company"}
          >
            <option value="company">Company</option>
            <option value="third_party">Third party</option>
          </select>
        </div>
        <div>
          <label htmlFor="tr-status" className={labelClass}>Status</label>
          <select
            id="tr-status"
            name="status"
            className={fieldClass}
            defaultValue={truck?.status ?? "active"}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : truck ? "Save changes" : "Save truck"}
      </button>
    </form>
  );
}

export type CompartmentRecord = {
  id: string;
  truck_id: string;
  compartment_number: string;
  capacity: number;
  product_compatibility: string | null;
};

export function CompartmentForm({
  trucks,
  compartment,
  truckLabel,
}: {
  trucks: Option[];
  compartment?: CompartmentRecord;
  truckLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    compartment ? updateCompartment : createCompartment,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {compartment ? <input type="hidden" name="id" value={compartment.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          {compartment ? (
            <>
              <span className={labelClass}>Truck</span>
              <p className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm">
                {truckLabel ?? "Truck"}
              </p>
            </>
          ) : (
            <>
              <label htmlFor="cp-truck" className={labelClass}>Truck</label>
              <select id="cp-truck" name="truckId" required className={fieldClass} defaultValue="">
                <option value="" disabled>Select a truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>{truck.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div>
          <label htmlFor="cp-number" className={labelClass}>Compartment number</label>
          <input
            id="cp-number"
            name="compartmentNumber"
            required
            className={fieldClass}
            placeholder="1"
            defaultValue={compartment?.compartment_number ?? ""}
          />
        </div>
        <div>
          <label htmlFor="cp-capacity" className={labelClass}>Capacity</label>
          <input
            id="cp-capacity"
            name="capacity"
            type="number"
            step="0.001"
            min="0.001"
            required
            className={fieldClass}
            defaultValue={compartment ? String(compartment.capacity) : ""}
          />
        </div>
      </div>
      <div>
        <label htmlFor="cp-compatibility" className={labelClass}>Product compatibility</label>
        <input
          id="cp-compatibility"
          name="productCompatibility"
          className={fieldClass}
          defaultValue={compartment?.product_compatibility ?? ""}
        />
      </div>
      {compartment ? (
        <p className="text-xs text-[var(--muted)]">
          The truck cannot be changed here, so historical loading records stay attached to the same vehicle.
        </p>
      ) : null}
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : compartment ? "Save changes" : "Save compartment"}
      </button>
    </form>
  );
}

export type DriverRecord = {
  id: string;
  driver_code: string;
  full_name: string;
  phone: string | null;
  licence_number: string;
  licence_expiry: string | null;
  driver_type: string;
  transporter_id: string | null;
};

export function DriverForm({ transporters, driver }: { transporters: Option[]; driver?: DriverRecord }) {
  const [state, formAction, pending] = useActionState(driver ? updateDriver : createDriver, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {driver ? <input type="hidden" name="id" value={driver.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="dv-code" className={labelClass}>Driver code</label>
          <input
            id="dv-code"
            name="driverCode"
            required
            className={fieldClass}
            placeholder="DRV-001"
            defaultValue={driver?.driver_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="dv-name" className={labelClass}>Full name</label>
          <input
            id="dv-name"
            name="fullName"
            required
            className={fieldClass}
            defaultValue={driver?.full_name ?? ""}
          />
        </div>
        <div>
          <label htmlFor="dv-phone" className={labelClass}>Phone</label>
          <input id="dv-phone" name="phone" className={fieldClass} defaultValue={driver?.phone ?? ""} />
        </div>
        <div>
          <label htmlFor="dv-licence" className={labelClass}>Licence number</label>
          <input
            id="dv-licence"
            name="licenceNumber"
            required
            className={fieldClass}
            defaultValue={driver?.licence_number ?? ""}
          />
        </div>
        <div>
          <label htmlFor="dv-expiry" className={labelClass}>Licence expiry</label>
          <input
            id="dv-expiry"
            name="licenceExpiry"
            type="date"
            className={fieldClass}
            defaultValue={driver?.licence_expiry ?? ""}
          />
        </div>
        <div>
          <label htmlFor="dv-type" className={labelClass}>Driver type</label>
          <select
            id="dv-type"
            name="driverType"
            className={fieldClass}
            defaultValue={driver?.driver_type ?? "employee"}
          >
            <option value="employee">Employee</option>
            <option value="third_party">Third party</option>
          </select>
        </div>
        <div>
          <label htmlFor="dv-transporter" className={labelClass}>Transporter (third-party)</label>
          <select
            id="dv-transporter"
            name="transporterId"
            className={fieldClass}
            defaultValue={driver?.transporter_id ?? ""}
          >
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
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : driver ? "Save changes" : "Save driver"}
      </button>
    </form>
  );
}
