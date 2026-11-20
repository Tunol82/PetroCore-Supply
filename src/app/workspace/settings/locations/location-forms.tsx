"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";
import { ToastOnState } from "@/components/ui/toast";

import { useActionState } from "react";
import { createLocation, updateLocation, type LocationActionState } from "./actions";

const initialState: LocationActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const TYPE_LABELS: Record<string, string> = {
  storage: "Storage depot",
  transit: "Transit point",
  depot: "Depot",
  station: "Station",
  office: "Office",
  other: "Other",
};

export type LocationRecord = {
  id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  is_storage_location: boolean;
};

function Feedback({ state }: { state: LocationActionState }) {
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

export function LocationForm({ location }: { location?: LocationRecord }) {
  const [state, formAction, pending] = useActionState(
    location ? updateLocation : createLocation,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <label htmlFor="loc-code" className={labelClass}>Location code</label>
          <input
            id="loc-code"
            name="locationCode"
            required
            className={fieldClass}
            placeholder="LOC-001"
            defaultValue={location?.location_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="loc-name" className={labelClass}>Location name</label>
          <input
            id="loc-name"
            name="locationName"
            required
            className={fieldClass}
            defaultValue={location?.location_name ?? ""}
          />
        </div>
        <div>
          <label htmlFor="loc-type" className={labelClass}>Type</label>
          <select
            id="loc-type"
            name="locationType"
            className={fieldClass}
            defaultValue={location?.location_type ?? "storage"}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="loc-address" className={labelClass}>Address</label>
          <input id="loc-address" name="address" className={fieldClass} defaultValue={location?.address ?? ""} />
        </div>
        <div>
          <label htmlFor="loc-contact" className={labelClass}>Contact person</label>
          <input
            id="loc-contact"
            name="contactPerson"
            className={fieldClass}
            defaultValue={location?.contact_person ?? ""}
          />
        </div>
        <div>
          <label htmlFor="loc-phone" className={labelClass}>Phone</label>
          <input id="loc-phone" name="phone" className={fieldClass} defaultValue={location?.phone ?? ""} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isStorageLocation"
          defaultChecked={location?.is_storage_location ?? true}
          className="h-4 w-4 rounded border-[var(--line)]"
        />
        Storage location — product can be received here
      </label>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : location ? "Save changes" : "Save location"}
      </button>
    </form>
  );
}
