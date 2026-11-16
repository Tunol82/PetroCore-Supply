"use client";

import { useActionState } from "react";
import {
  addReconciliationItem,
  confirmLiability,
  createReconciliation,
  createToleranceRule,
  deleteToleranceRule,
  recordInvestigation,
  recordRecovery,
  rejectLiability,
  reportDiscrepancy,
  type ReconciliationActionState,
} from "./actions";

export type Option = { id: string; label: string };

const initialState: ReconciliationActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] disabled:text-[var(--muted)] disabled:shadow-none";

function Feedback({ state }: { state: ReconciliationActionState }) {
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

export function ReconciliationForm({ trips }: { trips: Option[] }) {
  const [state, formAction, pending] = useActionState(createReconciliation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rc-trip" className={labelClass}>Trip</label>
          <select id="rc-trip" name="tripId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rc-number" className={labelClass}>Reconciliation number</label>
          <input id="rc-number" name="reconciliationNumber" required className={fieldClass} placeholder="REC-2026-0001" />
        </div>
        <div>
          <label htmlFor="rc-status" className={labelClass}>Status</label>
          <select id="rc-status" name="status" className={fieldClass} defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
        <div>
          <label htmlFor="rc-notes" className={labelClass}>Notes</label>
          <input id="rc-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save reconciliation"}
      </button>
    </form>
  );
}

export function ReconciliationItemForm({
  reconciliations,
  loadingRecords,
  deliveries,
  products,
}: {
  reconciliations: Option[];
  loadingRecords: Option[];
  deliveries: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(addReconciliationItem, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ri-reconciliation" className={labelClass}>Reconciliation</label>
          <select id="ri-reconciliation" name="reconciliationId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a reconciliation</option>
            {reconciliations.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-product" className={labelClass}>Product</label>
          <select id="ri-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-status" className={labelClass}>Item status</label>
          <select id="ri-status" name="reconciliationStatus" className={fieldClass} defaultValue="flagged">
            <option value="within_tolerance">Within tolerance</option>
            <option value="flagged">Flagged</option>
            <option value="investigated">Investigated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label htmlFor="ri-loading" className={labelClass}>Loading record (optional)</label>
          <select id="ri-loading" name="tripLoadingRecordId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {loadingRecords.map((record) => (
              <option key={record.id} value={record.id}>{record.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-delivery" className={labelClass}>Delivery record (optional)</label>
          <select id="ri-delivery" name="tripDeliveryRecordId" className={fieldClass} defaultValue="">
            <option value="">Not linked</option>
            {deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>{delivery.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ri-loaded" className={labelClass}>Loaded quantity</label>
          <input id="ri-loaded" name="loadedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ri-delivered" className={labelClass}>Delivered quantity</label>
          <input id="ri-delivered" name="deliveredQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ri-notes" className={labelClass}>Notes</label>
          <input id="ri-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save item"}
      </button>
    </form>
  );
}

export function DiscrepancyForm({ items }: { items: Option[] }) {
  const [state, formAction, pending] = useActionState(reportDiscrepancy, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="dc-item" className={labelClass}>Reconciliation item</label>
          <select id="dc-item" name="reconciliationItemId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select an item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dc-type" className={labelClass}>Discrepancy type</label>
          <select id="dc-type" name="discrepancyType" className={fieldClass} defaultValue="transport">
            <option value="supplier">Supplier</option>
            <option value="loading">Loading</option>
            <option value="transport">Transport</option>
            <option value="customer_measurement">Customer measurement</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-status" className={labelClass}>Status</label>
          <select id="dc-status" name="status" className={fieldClass} defaultValue="open">
            <option value="open">Open</option>
            <option value="under_investigation">Under investigation</option>
            <option value="resolved">Resolved</option>
            <option value="approved_loss">Approved loss</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-expected" className={labelClass}>Expected quantity</label>
          <input id="dc-expected" name="expectedQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dc-actual" className={labelClass}>Actual quantity</label>
          <input id="dc-actual" name="actualQuantity" type="number" step="0.001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="dc-impact" className={labelClass}>Provisional impact (optional)</label>
          <input id="dc-impact" name="provisionalFinancialImpact" type="number" step="0.01" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        A discrepancy is not a loss or liability. It requires investigation and authorised confirmation.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record discrepancy"}
      </button>
    </form>
  );
}

export function InvestigationForm({ discrepancies }: { discrepancies: Option[] }) {
  const [state, formAction, pending] = useActionState(recordInvestigation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="in-discrepancy" className={labelClass}>Discrepancy</label>
          <select id="in-discrepancy" name="discrepancyId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a discrepancy</option>
            {discrepancies.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="in-party" className={labelClass}>Responsible party type</label>
          <select id="in-party" name="responsiblePartyType" className={fieldClass} defaultValue="unresolved">
            <option value="supplier">Supplier</option>
            <option value="transporter">Transporter</option>
            <option value="customer">Customer</option>
            <option value="internal">Internal</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
        <div>
          <label htmlFor="in-status" className={labelClass}>Responsibility status</label>
          <select id="in-status" name="responsibilityStatus" className={fieldClass} defaultValue="undetermined">
            <option value="undetermined">Undetermined</option>
            <option value="confirmed">Confirmed</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>
        <div>
          <label htmlFor="in-findings" className={labelClass}>Findings</label>
          <input id="in-findings" name="findings" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="in-resolution" className={labelClass}>Resolution</label>
          <input id="in-resolution" name="resolution" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record investigation"}
      </button>
    </form>
  );
}

export function LiabilityForm({
  discrepancyId,
  invoices,
}: {
  discrepancyId: string;
  invoices: Option[];
}) {
  const [state, formAction, pending] = useActionState(confirmLiability, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="discrepancyId" value={discrepancyId} />
      <div className="grid min-w-[320px] gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`lb-cost-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Unit cost (optional)
          </label>
          <input
            id={`lb-cost-${discrepancyId}`}
            name="unitCost"
            type="number"
            step="0.0001"
            min="0"
            placeholder="From FIFO"
            className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label htmlFor={`lb-method-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Recovery
          </label>
          <select
            id={`lb-method-${discrepancyId}`}
            name="recoveryMethod"
            defaultValue="none"
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          >
            <option value="none">None</option>
            <option value="invoice_deduction">Invoice deduction</option>
            <option value="debit_note">Debit note</option>
          </select>
        </div>
        <div>
          <label htmlFor={`lb-amount-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Recover now (optional)
          </label>
          <input
            id={`lb-amount-${discrepancyId}`}
            name="recoveryAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Full amount"
            className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label htmlFor={`lb-invoice-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Invoice (optional)
          </label>
          <select
            id={`lb-invoice-${discrepancyId}`}
            name="invoiceId"
            defaultValue=""
            className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          >
            <option value="">Not linked</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>{invoice.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[var(--brand)] px-2 py-1 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/5 disabled:opacity-50 sm:col-span-2"
          disabled={pending}
        >
          {pending ? "Confirming…" : "Confirm liability"}
        </button>
      </div>
      {state.error ? <span className="block text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="block text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

export function RejectLiabilityForm({ discrepancyId }: { discrepancyId: string }) {
  const [state, formAction, pending] = useActionState(rejectLiability, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="discrepancyId" value={discrepancyId} />
      <input
        name="note"
        required
        minLength={3}
        maxLength={500}
        placeholder="Reason"
        aria-label="Rejection reason"
        className="w-32 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
      />
      <button
        type="submit"
        className="text-xs font-semibold text-red-700 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Rejecting…" : "Reject"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

export function ToleranceRuleForm({ products }: { products: Option[] }) {
  const [state, formAction, pending] = useActionState(createToleranceRule, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="tr-product" className={labelClass}>Product</label>
          <select id="tr-product" name="productId" className={fieldClass} defaultValue="">
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tr-basis" className={labelClass}>Basis</label>
          <select id="tr-basis" name="basis" className={fieldClass} defaultValue="greater_of">
            <option value="percentage">Percentage of loaded</option>
            <option value="absolute">Absolute quantity</option>
            <option value="greater_of">Greater of both</option>
          </select>
        </div>
        <div>
          <label htmlFor="tr-percentage" className={labelClass}>Percentage</label>
          <input id="tr-percentage" name="percentage" type="number" step="0.001" min="0" max="100" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="tr-absolute" className={labelClass}>Absolute tolerance</label>
          <input id="tr-absolute" name="absoluteQuantity" type="number" step="0.001" min="0" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Optional. Without a rule, items keep the status chosen by the user and no tolerance is recorded.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save tolerance rule"}
      </button>
    </form>
  );
}

export function DeleteToleranceRuleForm({ ruleId }: { ruleId: string }) {
  const [state, formAction, pending] = useActionState(deleteToleranceRule, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="ruleId" value={ruleId} />
      <button type="submit" className="text-xs font-semibold text-red-700 disabled:opacity-50" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function RecoveryForm({
  discrepancyId,
  invoices,
  outstanding,
}: {
  discrepancyId: string;
  invoices: Option[];
  outstanding: number;
}) {
  const [state, formAction, pending] = useActionState(recordRecovery, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="discrepancyId" value={discrepancyId} />
      <div className="grid min-w-[320px] gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`rc-amount-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Recover amount
          </label>
          <input
            id={`rc-amount-${discrepancyId}`}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={outstanding}
            defaultValue={outstanding}
            required
            className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label htmlFor={`rc-method-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Method
          </label>
          <select
            id={`rc-method-${discrepancyId}`}
            name="method"
            defaultValue="debit_note"
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          >
            <option value="invoice_deduction">Invoice deduction</option>
            <option value="debit_note">Debit note</option>
          </select>
        </div>
        <div>
          <label htmlFor={`rc-invoice-${discrepancyId}`} className="mb-1 block text-[10px] font-medium text-[var(--muted)]">
            Invoice (optional)
          </label>
          <select
            id={`rc-invoice-${discrepancyId}`}
            name="invoiceId"
            defaultValue=""
            className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
          >
            <option value="">Not linked</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>{invoice.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[var(--brand)] px-2 py-1 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/5 disabled:opacity-50 sm:col-span-2"
          disabled={pending}
        >
          {pending ? "Recording…" : "Record recovery"}
        </button>
      </div>
      {state.error ? <span className="block text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="block text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}
