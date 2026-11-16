"use client";

import { useActionState } from "react";
import {
  addIssueLine,
  addReservationItem,
  createIssue,
  createReservation,
  postIssue,
  releaseReservationItem,
  reverseIssue,
  type FulfilmentActionState,
} from "./actions";

export type Option = { id: string; label: string };

const initialState: FulfilmentActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: FulfilmentActionState }) {
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

function Select({
  id,
  name,
  label,
  options,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  options: Option[];
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} name={name} required className={fieldClass} defaultValue={defaultValue ?? ""}>
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ReservationForm({
  salesOrders,
  locations,
}: {
  salesOrders: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(createReservation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="rs-number" className={labelClass}>Reservation number</label>
          <input id="rs-number" name="reservationNumber" required className={fieldClass} placeholder="RES-2026-0001" />
        </div>
        <Select id="rs-order" name="salesOrderId" label="Sales order" options={salesOrders} placeholder="Select a sales order" />
        <Select id="rs-location" name="locationId" label="Storage location" options={locations} placeholder="Select a storage location" />
        <div>
          <label htmlFor="rs-expiry" className={labelClass}>Expires on (optional)</label>
          <input id="rs-expiry" name="expiryAt" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="rs-notes" className={labelClass}>Notes</label>
          <input id="rs-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Create reservation"}
      </button>
    </form>
  );
}

export function ReservationItemForm({
  reservations,
  orderItems,
  batches,
}: {
  reservations: Option[];
  orderItems: Option[];
  batches: Option[];
}) {
  const [state, formAction, pending] = useActionState(addReservationItem, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Select id="ri-reservation" name="reservationId" label="Reservation" options={reservations} placeholder="Select a reservation" />
        <Select id="ri-item" name="salesOrderItemId" label="Sales order line" options={orderItems} placeholder="Select a sales order line" />
        <Select id="ri-batch" name="inventoryBatchId" label="Inventory batch" options={batches} placeholder="Select a batch" />
        <div>
          <label htmlFor="ri-quantity" className={labelClass}>Reserved quantity</label>
          <input id="ri-quantity" name="reservedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Reserving…" : "Reserve stock"}
      </button>
    </form>
  );
}

export function ReleaseForm({ reservationItemId, outstanding }: { reservationItemId: string; outstanding: number }) {
  const [state, formAction, pending] = useActionState(releaseReservationItem, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="reservationItemId" value={reservationItemId} />
      <input
        name="quantity"
        type="number"
        step="0.001"
        min="0"
        max={outstanding}
        defaultValue={outstanding}
        aria-label="Release quantity"
        className="w-24 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
      />
      <button type="submit" className="text-xs font-semibold text-[var(--brand)] disabled:opacity-50" disabled={pending}>
        {pending ? "Releasing…" : "Release"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

export function IssueForm({
  salesOrders,
  locations,
  trips,
}: {
  salesOrders: Option[];
  locations: Option[];
  trips: Option[];
}) {
  const [state, formAction, pending] = useActionState(createIssue, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="is-number" className={labelClass}>Issue number</label>
          <input id="is-number" name="issueNumber" required className={fieldClass} placeholder="ISS-2026-0001" />
        </div>
        <Select id="is-order" name="salesOrderId" label="Sales order" options={salesOrders} placeholder="Select a sales order" />
        <Select id="is-location" name="locationId" label="Issue location" options={locations} placeholder="Select a storage location" />
        <div>
          <label htmlFor="is-trip" className={labelClass}>Trip (optional)</label>
          <select id="is-trip" name="tripId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="is-date" className={labelClass}>Issue date (optional)</label>
          <input id="is-date" name="issueDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="is-notes" className={labelClass}>Notes</label>
          <input id="is-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Create draft issue"}
      </button>
    </form>
  );
}

export function IssueLineForm({ issues, orderItems }: { issues: Option[]; orderItems: Option[] }) {
  const [state, formAction, pending] = useActionState(addIssueLine, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select id="il-issue" name="issueId" label="Draft issue" options={issues} placeholder="Select a draft issue" />
        <Select id="il-item" name="salesOrderItemId" label="Sales order line" options={orderItems} placeholder="Select a sales order line" />
        <div>
          <label htmlFor="il-quantity" className={labelClass}>Quantity to issue</label>
          <input id="il-quantity" name="requestedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Adding…" : "Add issue line"}
      </button>
    </form>
  );
}

export function PostIssueForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(postIssue, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <button
        type="submit"
        className="rounded-lg border border-[var(--brand)] px-2 py-1 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/5 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Posting…" : "Post issue"}
      </button>
      {state.error ? <span className="block text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="block text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

export function ReverseIssueForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(reverseIssue, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <input
        name="reason"
        required
        minLength={3}
        maxLength={500}
        placeholder="Reversal reason"
        aria-label="Reversal reason"
        className="w-48 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
      />
      <button
        type="submit"
        className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Reversing…" : "Reverse issue"}
      </button>
      {state.error ? <span className="block text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="block text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}
