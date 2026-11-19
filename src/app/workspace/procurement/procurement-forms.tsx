"use client";

import { UnsavedGuard } from "@/components/ui/unsaved-guard";
import { FormDraft } from "@/components/ui/form-draft";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState, useState } from "react";
import {
  addPurchaseOrderItem,
  createDepot,
  createProduct,
  createPurchaseOrder,
  createSupplier,
  createSupplierProduct,
  recordBatch,
  updateDepot,
  updateProduct,
  updateSupplier,
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

export type SupplierRecord = {
  id: string;
  supplier_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
};

export function SupplierForm({ supplier }: { supplier?: SupplierRecord }) {
  const [state, formAction, pending] = useActionState(supplier ? updateSupplier : createSupplier, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="supplier-code" className={labelClass}>Supplier code</label>
          <input
            id="supplier-code"
            name="supplierCode"
            required
            className={fieldClass}
            placeholder="SUP-001"
            defaultValue={supplier?.supplier_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="supplier-name" className={labelClass}>Supplier name</label>
          <input
            id="supplier-name"
            name="name"
            required
            className={fieldClass}
            placeholder="North Depot Ltd"
            defaultValue={supplier?.name ?? ""}
          />
        </div>
        <div>
          <label htmlFor="supplier-contact" className={labelClass}>Contact person</label>
          <input
            id="supplier-contact"
            name="contactPerson"
            className={fieldClass}
            defaultValue={supplier?.contact_person ?? ""}
          />
        </div>
        <div>
          <label htmlFor="supplier-phone" className={labelClass}>Phone</label>
          <input id="supplier-phone" name="phone" className={fieldClass} defaultValue={supplier?.phone ?? ""} />
        </div>
        <div>
          <label htmlFor="supplier-email" className={labelClass}>Email</label>
          <input
            id="supplier-email"
            name="email"
            type="email"
            className={fieldClass}
            defaultValue={supplier?.email ?? ""}
          />
        </div>
        <div>
          <label htmlFor="supplier-terms" className={labelClass}>Payment terms</label>
          <input
            id="supplier-terms"
            name="paymentTerms"
            className={fieldClass}
            placeholder="30 days"
            defaultValue={supplier?.payment_terms ?? ""}
          />
        </div>
      </div>
      <div>
        <label htmlFor="supplier-address" className={labelClass}>Address</label>
        <input id="supplier-address" name="address" className={fieldClass} defaultValue={supplier?.address ?? ""} />
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : supplier ? "Save changes" : "Save supplier"}
      </button>
    </form>
  );
}

export type DepotRecord = {
  id: string;
  supplier_id: string;
  depot_code: string;
  name: string;
  location_description: string | null;
  contact_person: string | null;
  phone: string | null;
};

export function DepotForm({ suppliers, depot }: { suppliers: Option[]; depot?: DepotRecord }) {
  const [state, formAction, pending] = useActionState(depot ? updateDepot : createDepot, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {depot ? <input type="hidden" name="id" value={depot.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="depot-supplier" className={labelClass}>Supplier</label>
          <select
            id="depot-supplier"
            name="supplierId"
            required
            className={fieldClass}
            defaultValue={depot?.supplier_id ?? ""}
          >
            <option value="" disabled>Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="depot-code" className={labelClass}>Depot code</label>
          <input
            id="depot-code"
            name="depotCode"
            required
            className={fieldClass}
            placeholder="DEP-01"
            defaultValue={depot?.depot_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="depot-name" className={labelClass}>Depot name</label>
          <input id="depot-name" name="name" required className={fieldClass} defaultValue={depot?.name ?? ""} />
        </div>
        <div>
          <label htmlFor="depot-location" className={labelClass}>Location description</label>
          <input
            id="depot-location"
            name="locationDescription"
            className={fieldClass}
            defaultValue={depot?.location_description ?? ""}
          />
        </div>
        <div>
          <label htmlFor="depot-contact" className={labelClass}>Contact person</label>
          <input
            id="depot-contact"
            name="contactPerson"
            className={fieldClass}
            defaultValue={depot?.contact_person ?? ""}
          />
        </div>
        <div>
          <label htmlFor="depot-phone" className={labelClass}>Phone</label>
          <input id="depot-phone" name="phone" className={fieldClass} defaultValue={depot?.phone ?? ""} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : depot ? "Save changes" : "Save depot"}
      </button>
    </form>
  );
}

export type ProductRecord = {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  unit_of_measure: string;
  description: string | null;
};

export function ProductForm({ product }: { product?: ProductRecord }) {
  const [state, formAction, pending] = useActionState(product ? updateProduct : createProduct, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="product-code" className={labelClass}>Product code</label>
          <input
            id="product-code"
            name="productCode"
            required
            className={fieldClass}
            placeholder="PMS"
            defaultValue={product?.product_code ?? ""}
          />
        </div>
        <div>
          <label htmlFor="product-name" className={labelClass}>Product name</label>
          <input
            id="product-name"
            name="productName"
            required
            className={fieldClass}
            defaultValue={product?.product_name ?? ""}
          />
        </div>
        <div>
          <label htmlFor="product-type" className={labelClass}>Product type</label>
          <input
            id="product-type"
            name="productType"
            required
            className={fieldClass}
            placeholder="fuel"
            defaultValue={product?.product_type ?? ""}
          />
        </div>
        <div>
          <label htmlFor="product-unit" className={labelClass}>Unit of measure</label>
          <input
            id="product-unit"
            name="unitOfMeasure"
            className={fieldClass}
            defaultValue={product?.unit_of_measure ?? "litres"}
          />
        </div>
      </div>
      <div>
        <label htmlFor="product-description" className={labelClass}>Description</label>
        <input
          id="product-description"
          name="description"
          className={fieldClass}
          defaultValue={product?.description ?? ""}
        />
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : product ? "Save changes" : "Save product"}
      </button>
    </form>
  );
}

export function PurchaseOrderForm({
  suppliers,
  depots,
}: {
  suppliers: Option[];
  depots: DepotOption[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, initialState);
  const [supplierId, setSupplierId] = useState("");
  const depotsForSupplier = depots.filter((depot) => depot.supplierId === supplierId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="po-number" className={labelClass}>Purchase order number</label>
          <input id="po-number" name="poNumber" required className={fieldClass} placeholder="PO-2026-0001" />
        </div>
        <div>
          <label htmlFor="po-supplier" className={labelClass}>Supplier</label>
          <select
            id="po-supplier"
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
          <label htmlFor="po-depot" className={labelClass}>Supplier depot (optional)</label>
          <select id="po-depot" name="supplierDepotId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {depotsForSupplier.map((depot) => (
              <option key={depot.id} value={depot.id}>{depot.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="po-order-date" className={labelClass}>Order date</label>
          <input id="po-order-date" name="orderDate" type="date" required defaultValue={today} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="po-expected-date" className={labelClass}>Expected date (optional)</label>
          <input id="po-expected-date" name="expectedDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="po-terms" className={labelClass}>Payment terms</label>
          <input id="po-terms" name="paymentTerms" className={fieldClass} placeholder="30 days" />
        </div>
      </div>
      <div>
        <label htmlFor="po-notes" className={labelClass}>Notes</label>
        <input id="po-notes" name="notes" className={fieldClass} />
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save purchase order"}
      </button>
    </form>
  );
}

export function PurchaseOrderItemForm({
  orders,
  products,
}: {
  orders: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(addPurchaseOrderItem, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="poi-order" className={labelClass}>Purchase order</label>
          <select id="poi-order" name="purchaseOrderId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a purchase order</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>{order.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="poi-product" className={labelClass}>Product</label>
          <select id="poi-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="poi-quantity" className={labelClass}>Ordered quantity</label>
          <input id="poi-quantity" name="orderedQuantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="poi-price" className={labelClass}>Agreed unit price</label>
          <input id="poi-price" name="agreedUnitPrice" type="number" step="0.0001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="poi-discount" className={labelClass}>Discount (optional)</label>
          <input id="poi-discount" name="discountAmount" type="number" step="0.01" min="0" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save order line"}
      </button>
    </form>
  );
}

export function BatchForm({
  suppliers,
  depots,
  products,
  locations,
  purchaseOrderLines,
}: {
  suppliers: Option[];
  depots: DepotOption[];
  products: Option[];
  locations: Option[];
  purchaseOrderLines: Option[];
}) {
  const [state, formAction, pending] = useActionState(recordBatch, initialState);
  const [supplierId, setSupplierId] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState("storage_receipt");

  const depotsForSupplier = depots.filter((depot) => depot.supplierId === supplierId);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <FormDraft storageKey="batch:new" state={state} />
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
          <label htmlFor="batch-po-line" className={labelClass}>Purchase order line (optional)</label>
          <select id="batch-po-line" name="purchaseOrderItemId" className={fieldClass} defaultValue="">
            <option value="">Not linked to an order line</option>
            {purchaseOrderLines.map((line) => (
              <option key={line.id} value={line.id}>{line.label}</option>
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
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Recording…" : "Record batch"}
      </button>
    </form>
  );
}

export function SupplierProductForm({
  suppliers,
  products,
}: {
  suppliers: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(createSupplierProduct, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <UnsavedGuard />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="sp-supplier" className={labelClass}>Supplier</label>
          <select id="sp-supplier" name="supplierId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sp-product" className={labelClass}>Product</label>
          <select id="sp-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sp-code" className={labelClass}>Supplier product code</label>
          <input id="sp-code" name="supplierProductCode" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Link product to supplier"}
      </button>
    </form>
  );
}
