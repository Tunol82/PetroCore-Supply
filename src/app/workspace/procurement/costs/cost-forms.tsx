"use client";

import { useActionState } from "react";
import {
  createCostCategory,
  recordCostComponent,
  type ProcurementActionState,
} from "../actions";

export type Option = { id: string; label: string };

const initialState: ProcurementActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const CATEGORY_TYPES: { value: string; label: string }[] = [
  { value: "acquisition", label: "Acquisition" },
  { value: "inbound_transport", label: "Inbound transport" },
  { value: "handling", label: "Handling" },
  { value: "inspection", label: "Inspection" },
  { value: "documentation", label: "Documentation" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const ALLOCATION_METHODS: { value: string; label: string }[] = [
  { value: "per_litre", label: "Per litre" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
  { value: "product_value", label: "Product value" },
  { value: "manual", label: "Manual" },
];

function Feedback({ state }: { state: ProcurementActionState }) {
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

export function CostCategoryForm() {
  const [state, formAction, pending] = useActionState(createCostCategory, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cc-name" className={labelClass}>Category name</label>
          <input id="cc-name" name="categoryName" required className={fieldClass} placeholder="Inbound haulage" />
        </div>
        <div>
          <label htmlFor="cc-type" className={labelClass}>Category type</label>
          <select id="cc-type" name="categoryType" className={fieldClass} defaultValue="inbound_transport">
            {CATEGORY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cc-allocation" className={labelClass}>Allocation method</label>
          <select id="cc-allocation" name="allocationMethod" className={fieldClass} defaultValue="manual">
            {ALLOCATION_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="landedCostInclusion" className="h-4 w-4" />
          Include in landed cost
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresApproval" className="h-4 w-4" />
          Requires approval
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresEvidence" className="h-4 w-4" />
          Requires evidence
        </label>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Allocation is not applied yet. Landed-cost allocation depends on decisions DR-06 and DR-21.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save cost category"}
      </button>
    </form>
  );
}

export function CostComponentForm({
  batches,
  categories,
  suppliers,
}: {
  batches: Option[];
  categories: Option[];
  suppliers: Option[];
}) {
  const [state, formAction, pending] = useActionState(recordCostComponent, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="pc-batch" className={labelClass}>Procurement batch</label>
          <select id="pc-batch" name="procurementBatchId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pc-category" className={labelClass}>Cost category</label>
          <select id="pc-category" name="costCategoryId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pc-amount" className={labelClass}>Amount</label>
          <input id="pc-amount" name="amount" type="number" step="0.01" min="0.01" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="pc-supplier" className={labelClass}>Related supplier (optional)</label>
          <select id="pc-supplier" name="supplierId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pc-reference" className={labelClass}>Reference number</label>
          <input id="pc-reference" name="referenceNumber" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="pc-description" className={labelClass}>Description</label>
          <input id="pc-description" name="description" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Costs are recorded as pending evidence. Approval and allocation are not applied.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record cost component"}
      </button>
    </form>
  );
}
