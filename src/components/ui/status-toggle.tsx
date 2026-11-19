"use client";

import { useActionState } from "react";
import { ToastOnState } from "@/components/ui/toast";

type ActionState = { error: string | null; success: string | null };

const initialState: ActionState = { error: null, success: null };

/**
 * Activate/deactivate control for master records.
 *
 * The server action is passed in from the page so each module keeps its own
 * permission check and table. Nothing is deleted; deactivated records stay in
 * history but drop out of the option lists used for new documents.
 */
export function StatusToggle({
  action,
  id,
  name,
  active,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  name: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={active ? "inactive" : "active"} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${active ? "Deactivate" : "Reactivate"} ${name}`}
        className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-[var(--danger)]">
          {state.error}
        </span>
      ) : null}
      <ToastOnState state={state} />
    </form>
  );
}
