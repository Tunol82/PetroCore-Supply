"use client";

import { useActionState } from "react";
import { enterTenant, type PlatformActionState } from "./actions";

type TenantOption = {
  id: string;
  label: string;
};

const initialState: PlatformActionState = { error: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";

export function EnterTenantForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, formAction, pending] = useActionState(enterTenant, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="platform-tenant" className={labelClass}>
          Tenant
        </label>
        <select id="platform-tenant" name="organisationId" className={fieldClass} defaultValue="">
          <option value="" disabled>
            Select a tenant
          </option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="platform-reason" className={labelClass}>
          Reason for access
        </label>
        <input
          id="platform-reason"
          name="reason"
          type="text"
          maxLength={500}
          placeholder="Support ticket, incident or owner request"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Recorded in the platform audit trail. Be specific and avoid customer data.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Entering…" : "Enter tenant"}
      </button>
    </form>
  );
}
