"use client";

import { ToastOnState } from "@/components/ui/toast";

import { useActionState, useState } from "react";
import {
  addSalesOrderItem,
  createCustomer,
  createCustomerLocation,
  createSalesOrder,
  type SalesActionState,
} from "./actions";

export type Option = { id: string; label: string };
export type LocationOption = Option & { customerId: string };

const initialState: SalesActionState = { error: null, success: null };

const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: SalesActionState }) {
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

export function CustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomer, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cust-code" className={labelClass}>Customer code</label>
          <input id="cust-code" name="customerCode" required className={fieldClass} placeholder="CUS-001" />
        </div>
        <div>
          <label htmlFor="cust-name" className={labelClass}>Customer name</label>
          <input id="cust-name" name="name" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cust-category" className={labelClass}>Category</label>
          <select id="cust-category" name="customerCategory" className={fieldClass} defaultValue="business">
            <option value="individual">Individual</option>
            <option value="business">Business</option>
            <option value="petrol_station">Petrol station</option>
            <option value="distributor">Distributor</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="cust-phone" className={labelClass}>Phone</label>
          <input id="cust-phone" name="phone" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cust-email" className={labelClass}>Email</label>
          <input id="cust-email" name="email" type="email" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cust-terms" className={labelClass}>Payment terms</label>
          <input id="cust-terms" name="paymentTerms" className={fieldClass} placeholder="30 days" />
        </div>
        <div>
          <label htmlFor="cust-credit-limit" className={labelClass}>Credit limit</label>
          <input id="cust-credit-limit" name="creditLimit" type="number" step="0.01" min="0" defaultValue="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cust-credit-status" className={labelClass}>Credit status</label>
          <select id="cust-credit-status" name="creditStatus" className={fieldClass} defaultValue="active">
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="cust-address" className={labelClass}>Address</label>
          <input id="cust-address" name="address" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save customer"}
      </button>
    </form>
  );
}

export function CustomerLocationForm({ customers }: { customers: Option[] }) {
  const [state, formAction, pending] = useActionState(createCustomerLocation, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-customer" className={labelClass}>Customer</label>
          <select id="cl-customer" name="customerId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cl-name" className={labelClass}>Location name</label>
          <input id="cl-name" name="locationName" required className={fieldClass} placeholder="Main station" />
        </div>
        <div>
          <label htmlFor="cl-address" className={labelClass}>Delivery address</label>
          <input id="cl-address" name="address" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cl-contact" className={labelClass}>Contact person</label>
          <input id="cl-contact" name="contactPerson" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cl-phone" className={labelClass}>Phone</label>
          <input id="cl-phone" name="phone" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save delivery location"}
      </button>
    </form>
  );
}

export function SalesOrderForm({
  customers,
  locations,
}: {
  customers: Option[];
  locations: LocationOption[];
}) {
  const [state, formAction, pending] = useActionState(createSalesOrder, initialState);
  const [customerId, setCustomerId] = useState("");
  const locationsForCustomer = locations.filter((location) => location.customerId === customerId);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="so-number" className={labelClass}>Order number</label>
          <input id="so-number" name="orderNumber" required className={fieldClass} placeholder="SO-2026-0001" />
        </div>
        <div>
          <label htmlFor="so-customer" className={labelClass}>Customer</label>
          <select
            id="so-customer"
            name="customerId"
            required
            className={fieldClass}
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="" disabled>Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="so-location" className={labelClass}>Delivery location (optional)</label>
          <select id="so-location" name="customerLocationId" className={fieldClass} defaultValue="">
            <option value="">Not specified</option>
            {locationsForCustomer.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="so-source" className={labelClass}>Order source</label>
          <select id="so-source" name="orderSource" className={fieldClass} defaultValue="phone">
            <option value="sales_representative">Sales representative</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="so-payment" className={labelClass}>Payment arrangement</label>
          <select id="so-payment" name="paymentArrangement" className={fieldClass} defaultValue="credit">
            <option value="full_prepayment">Full prepayment</option>
            <option value="deposit_balance">Deposit / balance</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div>
          <label htmlFor="so-terms" className={labelClass}>Payment terms</label>
          <input id="so-terms" name="paymentTerms" className={fieldClass} placeholder="30 days" />
        </div>
        <div>
          <label htmlFor="so-delivery-date" className={labelClass}>Requested delivery date</label>
          <input id="so-delivery-date" name="requestedDeliveryDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="so-notes" className={labelClass}>Notes</label>
          <input id="so-notes" name="notes" className={fieldClass} />
        </div>
      </div>
      <Feedback state={state} />
      <ToastOnState state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : "Save sales order"}
      </button>
    </form>
  );
}

export function SalesOrderItemForm({
  orders,
  products,
}: {
  orders: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState(addSalesOrderItem, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="soi-order" className={labelClass}>Sales order</label>
          <select id="soi-order" name="salesOrderId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select an order</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>{order.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="soi-product" className={labelClass}>Product</label>
          <select id="soi-product" name="productId" required className={fieldClass} defaultValue="">
            <option value="" disabled>Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="soi-quantity" className={labelClass}>Quantity</label>
          <input id="soi-quantity" name="quantity" type="number" step="0.001" min="0.001" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="soi-price" className={labelClass}>Selling price</label>
          <input id="soi-price" name="sellingPrice" type="number" step="0.0001" min="0" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="soi-discount" className={labelClass}>Discount (optional)</label>
          <input id="soi-discount" name="discountAmount" type="number" step="0.01" min="0" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="soi-delivery" className={labelClass}>Delivery fee (optional)</label>
          <input id="soi-delivery" name="deliveryFee" type="number" step="0.01" min="0" className={fieldClass} />
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
