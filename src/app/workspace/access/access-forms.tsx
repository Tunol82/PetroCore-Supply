"use client";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState, useState } from "react";
import {
  assignRole,
  grantAccess,
  inviteMember,
  revokeAccess,
  revokeRole,
  setMemberStatus,
  type AccessActionState,
} from "./actions";
import { ACCESS_LEVELS } from "@/modules/tenant/access-validation";

export type Option = {
  id: string;
  label: string;
};

const initialState: AccessActionState = { error: null, success: null };

function Feedback({ state }: { state: AccessActionState }) {
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

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function AssignRoleForm({ members, roles }: { members: Option[]; roles: Option[] }) {
  const [state, formAction, pending] = useActionState(assignRole, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="assign-user" className={labelClass}>Member</label>
          <select id="assign-user" name="userId" className={fieldClass} defaultValue="">
            <option value="" disabled>Select a member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assign-role" className={labelClass}>Role</label>
          <select id="assign-role" name="roleId" className={fieldClass} defaultValue="">
            <option value="" disabled>Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Assigning…" : "Assign role"}
      </button>
    </form>
  );
}

export function GrantAccessForm({
  members,
  locations,
}: {
  members: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(grantAccess, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="grant-user" className={labelClass}>Member</label>
          <select id="grant-user" name="userId" className={fieldClass} defaultValue="">
            <option value="" disabled>Select a member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="grant-location" className={labelClass}>Location</label>
          <select id="grant-location" name="locationId" className={fieldClass} defaultValue="">
            <option value="" disabled>Select a location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="grant-level" className={labelClass}>Access level</label>
          <select id="grant-level" name="accessLevel" className={fieldClass} defaultValue="view">
            {ACCESS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Granting…" : "Grant location access"}
      </button>
    </form>
  );
}

export function RevokeForm({ kind, id }: { kind: "role" | "access"; id: string }) {
  const action = kind === "role" ? revokeRole : revokeAccess;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      <Feedback state={state} />
      <ToastOnState state={state} />
    </form>
  );
}

export function InviteMemberForm({ roles, locations }: { roles: Option[]; locations: Option[] }) {
  const [state, formAction, pending] = useActionState(inviteMember, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-email" className={labelClass}>Email</label>
          <input id="invite-email" name="email" type="email" required className={fieldClass} placeholder="name@company.com" />
        </div>
        <div>
          <label htmlFor="invite-name" className={labelClass}>Full name</label>
          <input id="invite-name" name="fullName" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="invite-role" className={labelClass}>Role (optional)</label>
          <select id="invite-role" name="roleId" className={fieldClass} defaultValue="">
            <option value="">Assign later</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invite-location" className={labelClass}>Location, view access (optional)</label>
          <select id="invite-location" name="locationId" className={fieldClass} defaultValue="">
            <option value="">No location grant</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Creates the sign-in account and member profile. No email is sent by Supply: copy the single-use invitation link
        after saving and send it to the member.
      </p>
      <Feedback state={state} />
      <ToastOnState state={state} />
      {state.inviteLink ? (
        <div>
          <label htmlFor="invite-link" className={labelClass}>Invitation link</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="invite-link"
              readOnly
              value={state.inviteLink}
              onFocus={(event) => event.currentTarget.select()}
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.inviteLink ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Inviting…" : "Invite member"}
      </button>
    </form>
  );
}

export function MemberStatusForm({ userId, active }: { userId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(setMemberStatus, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={active ? "inactive" : "active"} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {state.error ? <span role="alert" className="text-xs text-[var(--danger)]">{state.error}</span> : null}
      <ToastOnState state={state} />
    </form>
  );
}
