"use client";

import { useActionState, useState } from "react";
import {
  createDepot,
  createProduct,
  createSupplier,
  recordBatch,
  type ProcurementActionState,
} from "./actions";

export type Option = { id: string; label: string };
export type DepotOption = Option & { supplierId: string };

const initialState: ProcurementActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

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

export function SupplierForm() {
  const [state, formAction, pending] = useActionState(createSupplier, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="supplier-code" className={labelClass}>Supplier code</label>
          <input id="supplier-code" name="supplierCode" required className={fieldClass} placeholder="SUP-001" />
        </div>
        <div>
          <label htmlFor="supplier-name" className={labelClass}>Supplier name</label>
          <input id="supplier-name" name="name" required className={fieldClass} placeholder="North Depot Ltd" />
        </div>
        <div>
          <label htmlFor="supplier-contact" className={labelClass}>Contact person</label>
          <input id="supplier-contact" name="contactPerson" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="supplier-phone" className={labelClass}>Phone</label>
          <input id="supplier-phone" name="phone" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="supplier-email" className={labelClass}>Email</label>
          <input id="supplier-email" name="email" type="email" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="supplier-terms" className={labelClass}>Payment terms</label>
          <input id="supplier-terms" name="paymentTerms" className={fieldClass} placeholder="30 days" />
        </div>
      </div>
      <div>
        <label htmlFor="supplier-address" className={labelClass}>Address</label>
        <input id="supplier-address" name="address" className={fieldClass} />
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save supplier"}
      </button>
    </form>
  );
}

export function DepotForm({ suppliers }: { suppliers: Option[] }) {
  const [state, formAction, pending] = useActionState(createDepot, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="depot-supplier" className={labelClass}>Supplier</label>
          <select id="depot-supplier" name="supplierId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="depot-code" className={labelClass}>Depot code</label>
          <input id="depot-code" name="depotCode" required className={fieldClass} placeholder="DEP-01" />
        </div>
        <div>
          <label htmlFor="depot-name" className={labelClass}>Depot name</label>
          <input id="depot-name" name="name" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="depot-location" className={labelClass}>Location description</label>
          <input id="depot-location" name="locationDescription" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="depot-contact" className={labelClass}>Contact person</label>
          <input id="depot-contact" name="contactPerson" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="depot-phone" className={labelClass}>Phone</label>
          <input id="depot-phone" name="phone" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save depot"}
      </button>
    </form>
  );
}

export function ProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="product-code" className={labelClass}>Product code</label>
          <input id="product-code" name="productCode" required className={fieldClass} placeholder="PMS" />
        </div>
        <div>
          <label htmlFor="product-name" className={labelClass}>Product name</label>
          <input id="product-name" name="productName" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="product-type" className={labelClass}>Product type</label>
          <input id="product-type" name="productType" required className={fieldClass} placeholder="fuel" />
        </div>
        <div>
          <label htmlFor="product-unit" className={labelClass}>Unit of measure</label>
          <input id="product-unit" name="unitOfMeasure" className={fieldClass} defaultValue="litres" />
        </div>
      </div>
      <div>
        <label htmlFor="product-description" className={labelClass}>Description</label>
        <input id="product-description" name="description" className={fieldClass} />
      </div>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}

export function BatchForm({
  suppliers,
  depots,
  products,
  locations,
}: {
  suppliers: Option[];
  depots: DepotOption[];
  products: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(recordBatch, initialState);
  const [supplierId, setSupplierId] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState("storage_receipt");

  const depotsForSupplier = depots.filter((depot) => depot.supplierId === supplierId);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="batch-number" className={labelClass}>Batch reference</label>
          <input id="batch-number" name="batchNumber" required className={fieldClass} placeholder="BAT-2026-0001" />
        </div>
        <div>
          <label htmlFor="batch-supplier" className={labelClass}>Supplier</label>
          <select
            id="batch-supplier"
            name="supplierId"
            required
            className={fieldClass}
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="" disabled>Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="batch-depot" className={labelClass}>Supplier depot</label>
          <select id="batch-depot" name="supplierDepotId" required className={fieldClass} defaultValue="">
            <option value="" disabled>
              {supplierId ? "Select a depot" : "Select a supplier first"}
            </option>
            {depotsForSupplier.map((depot) => (
              <option key={depot.id} value={depot.id}>{depot.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="batch-product" className={labelClass}>Product</label>
          <select id="batch-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="batch-supplier-qty" className={labelClass}>Supplier quantity</label>
          <input id="batch-supplier-qty" name="supplierQuantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-loaded-qty" className={labelClass}>Loaded quantity (optional)</label>
          <input id="batch-loaded-qty" name="loadedQuantity" type="number" step="0.001" min="0.001" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-received-qty" className={labelClass}>Received quantity (optional)</label>
          <input id="batch-received-qty" name="receivedQuantity" type="number" step="0.001" min="0.001" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-fulfilment" className={labelClass}>Fulfilment path</label>
          <select
            id="batch-fulfilment"
            name="fulfilmentType"
            className={fieldClass}
            value={fulfilmentType}
            onChange={(event) => setFulfilmentType(event.target.value)}
          >
            <option value="storage_receipt">Storage receipt</option>
            <option value="direct_customer_delivery">Direct customer delivery</option>
          </select>
        </div>
        <div>
          <label htmlFor="batch-location" className={labelClass}>Receiving location</label>
          <select id="batch-location" name="receivedAtLocationId" className={fieldClass} defaultValue="">
            <option value="">{fulfilmentType === "storage_receipt" ? "Select a location" : "Not applicable"}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="batch-invoice" className={labelClass}>Supplier invoice number</label>
          <input id="batch-invoice" name="supplierInvoiceNumber" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-ticket" className={labelClass}>Loading ticket</label>
          <input id="batch-ticket" name="supplierLoadingTicket" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-loading-date" className={labelClass}>Loading date</label>
          <input id="batch-loading-date" name="loadingDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="batch-receipt-date" className={labelClass}>Receipt date</label>
          <input id="batch-receipt-date" name="receiptDate" type="date" className={fieldClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Record quantities exactly as measured. Tolerances, temperature correction and variance assessment are not
        applied yet.
      </p>
      <Feedback state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record batch"}
      </button>
    </form>
  );
}
