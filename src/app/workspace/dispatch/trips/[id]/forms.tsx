"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { addTripExpense, recordTripArrival, type TripActionState } from "./actions";

const initialState: TripActionState = { error: null, success: null };

const EXPENSE_LABELS: Record<string, string> = {
  fuel: "Fuel",
  toll: "Toll",
  loading: "Loading",
  driver_allowance: "Driver allowance",
  maintenance: "Maintenance",
  other: "Other",
};

function Feedback({ state }: { state: TripActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p role="status" className="rounded-lg border border-[var(--success)]/30 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
        {state.success}
      </p>
    );
  }

  return null;
}

export function TripArrivalForm({
  tripId,
  initialArrival,
  initialOdometer,
}: {
  tripId: string;
  initialArrival: string;
  initialOdometer: string;
}) {
  const [state, formAction, pending] = useActionState(recordTripArrival, initialState);
  const hasArrival = initialArrival.length > 0;

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
      <UnsavedGuard />
      <input type="hidden" name="tripId" value={tripId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Actual arrival" htmlFor="arrival-at">
          <Input id="arrival-at" name="arrivedAt" type="datetime-local" required defaultValue={initialArrival} />
        </Field>
        <Field label="Odometer at arrival (km)" htmlFor="arrival-odometer" hint="Optional; unlocks distance and km/L.">
          <Input
            id="arrival-odometer"
            name="odometerEnd"
            type="number"
            min="0"
            step="0.1"
            defaultValue={initialOdometer}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : hasArrival ? "Update arrival" : "Record arrival"}
      </Button>
    </form>
  );
}

export function TripExpenseForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(addTripExpense, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <UnsavedGuard />
      <input type="hidden" name="tripId" value={tripId} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Type" htmlFor="expense-type">
          <Select id="expense-type" name="expenseType" defaultValue="fuel">
            {Object.entries(EXPENSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₦)" htmlFor="expense-amount">
          <Input id="expense-amount" name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Litres (fuel only)" htmlFor="expense-litres" hint="Optional; used for fuel cost per litre.">
          <Input id="expense-litres" name="litres" type="number" min="0.001" step="0.001" />
        </Field>
        <Field label="Date" htmlFor="expense-date">
          <Input id="expense-date" name="incurredOn" type="date" />
        </Field>
        <Field label="Reference" htmlFor="expense-reference" hint="Receipt or voucher number.">
          <Input id="expense-reference" name="reference" maxLength={80} />
        </Field>
        <Field label="Description" htmlFor="expense-description">
          <Input id="expense-description" name="description" maxLength={160} />
        </Field>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add expense"}
      </Button>
    </form>
  );
}
