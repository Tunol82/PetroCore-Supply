"use client";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  createApprovalThreshold,
  createChargeCategory,
  saveOperatingPolicy,
  setApprovalThresholdActive,
  setChargeCategoryActive,
  type RuleActionState,
} from "./actions";

const initialState: RuleActionState = { error: null, success: null };

const ACTION_LABELS: Record<string, string> = {
  liability_confirm: "Liability confirmation",
  liability_write_off: "Write-off approval",
};

const CLOSURE_LABELS: Record<string, string> = {
  allow: "Allow closure with open items",
  warn: "Warn but allow closure",
  block: "Block closure with open items",
};

function Feedback({ state }: { state: RuleActionState }) {
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

export function ApprovalThresholdForm({ permissions }: { permissions: string[] }) {
  const [state, formAction, pending] = useActionState(createApprovalThreshold, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Applies to" htmlFor="threshold-action">
          <Select id="threshold-action" name="action" defaultValue="liability_confirm">
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From amount (₦)" htmlFor="threshold-min">
          <Input id="threshold-min" name="minAmount" type="number" min="0" step="0.01" defaultValue="0" required />
        </Field>
        <Field label="Up to amount (₦)" htmlFor="threshold-max" hint="Leave blank for no upper limit.">
          <Input id="threshold-max" name="maxAmount" type="number" min="0" step="0.01" />
        </Field>
        <Field label="Required permission" htmlFor="threshold-permission">
          <Select id="threshold-permission" name="requiredPermission" defaultValue="transport.manage">
            {permissions.map((permission) => (
              <option key={permission} value={permission}>
                {permission}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="threshold-notes" className="sm:col-span-2 xl:col-span-4">
          <Input id="threshold-notes" name="notes" maxLength={240} placeholder="Why this tier exists" />
        </Field>
      </div>
      <p className="text-xs text-[var(--muted)]">
        The highest matching tier wins. With no active tier, any user holding transport.manage can confirm.
      </p>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add threshold"}
      </Button>
    </form>
  );
}

export function ThresholdToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(setApprovalThresholdActive, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Working…" : active ? "Deactivate" : "Activate"}
      </Button>
      <Feedback state={state} />
      <ToastOnState state={state} />
    </form>
  );
}

export function ChargeCategoryForm() {
  const [state, formAction, pending] = useActionState(createChargeCategory, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Code" htmlFor="category-code" hint="Lowercase letters, numbers or underscores.">
          <Input id="category-code" name="code" required placeholder="escort" maxLength={40} />
        </Field>
        <Field label="Label" htmlFor="category-label">
          <Input id="category-label" name="label" required maxLength={80} placeholder="Escort" />
        </Field>
        <Field label="Sort order" htmlFor="category-sort">
          <Input id="category-sort" name="sortOrder" type="number" step="1" defaultValue="100" />
        </Field>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add category"}
      </Button>
    </form>
  );
}

export function ChargeCategoryToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(setChargeCategoryActive, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Working…" : active ? "Deactivate" : "Activate"}
      </Button>
      <Feedback state={state} />
      <ToastOnState state={state} />
    </form>
  );
}

export function PolicyForm({
  permissions,
  policy,
}: {
  permissions: string[];
  policy: {
    tripClosurePolicy: string;
    closureOverridePermission: string;
    unresolvedAgingDays: number;
    defaultCorrectionMethod: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveOperatingPolicy, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trip closure" htmlFor="policy-closure">
          <Select id="policy-closure" name="tripClosurePolicy" defaultValue={policy.tripClosurePolicy}>
            {Object.entries(CLOSURE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Override permission" htmlFor="policy-override">
          <Select
            id="policy-override"
            name="closureOverridePermission"
            defaultValue={policy.closureOverridePermission}
          >
            {permissions.map((permission) => (
              <option key={permission} value={permission}>
                {permission}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unresolved aging (days)" htmlFor="policy-aging" hint="Used by the aging report; never auto-closes.">
          <Input
            id="policy-aging"
            name="unresolvedAgingDays"
            type="number"
            min="1"
            max="365"
            step="1"
            defaultValue={policy.unresolvedAgingDays}
            required
          />
        </Field>
        <Field
          label="Default correction method"
          htmlFor="policy-correction"
          hint="Prefills delivery and loading forms. Leave blank for no default."
        >
          <Input
            id="policy-correction"
            name="defaultCorrectionMethod"
            maxLength={80}
            defaultValue={policy.defaultCorrectionMethod ?? ""}
            placeholder="Supplier conversion factor"
          />
        </Field>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Trip closure policy is stored and shown to operators. The close action itself is not implemented yet, so no
        closure is blocked by this setting.
      </p>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save policy"}
      </Button>
    </form>
  );
}
