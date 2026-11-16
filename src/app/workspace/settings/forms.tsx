"use client";

import { useActionState } from "react";
import { resetDemoData, type SettingsActionState } from "./actions";

const initialState: SettingsActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";

export function ResetDemoDataForm({ organisationCode }: { organisationCode: string }) {
  const [state, formAction, pending] = useActionState(resetDemoData, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="reset-confirm" className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Type {organisationCode} to confirm
        </label>
        <input
          id="reset-confirm"
          name="confirmation"
          required
          autoComplete="off"
          placeholder={organisationCode}
          className={fieldClass}
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Clearing…" : "Clear demo data"}
      </button>
    </form>
  );
}
