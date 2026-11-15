import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { CustomerForm, CustomerLocationForm, SalesOrderForm, SalesOrderItemForm } from "./sales-forms";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  customer_code: string;
  name: string;
  customer_category: string;
  credit_status: string;
  status: string;
};

type CustomerLocation = {
  id: string;
  customer_id: string;
  location_name: string;
  address: string;
};

type SalesOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  order_source: string;
  payment_arrangement: string;
  status: string;
  order_date: string;
};

type SalesOrderItem = {
  id: string;
  sales_order_id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  discount_amount: number;
  delivery_fee: number;
  line_total: number;
};

type Product = { id: string; product_code: string; product_name: string };

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function SalesPage() {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { tenant } = await getCurrentTenant(supabase, userData.user.id);

  if (!tenant) {
    redirect("/workspace");
  }

  const [{ data: canView }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_permission", { p_permission_key: "sales.view" }),
    supabase.rpc("has_permission", { p_permission_key: "sales.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view sales for this workspace.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Sales requires the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">sales.view</code> or{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">sales.manage</code> permission.
            </p>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [customersResult, locationsResult, ordersResult, itemsResult, productsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_code, name, customer_category, credit_status, status")
      .order("name"),
    supabase
      .from("customer_locations")
      .select("id, customer_id, location_name, address")
      .order("location_name"),
    supabase
      .from("sales_orders")
      .select("id, order_number, customer_id, order_source, payment_arrangement, status, order_date")
      .order("order_date", { ascending: false })
      .limit(20),
    supabase
      .from("sales_order_items")
      .select("id, sales_order_id, product_id, quantity, selling_price, discount_amount, delivery_fee, line_total"),
    supabase.from("products").select("id, product_code, product_name").order("product_name"),
  ]);

  const queryError =
    customersResult.error ??
    locationsResult.error ??
    ordersResult.error ??
    itemsResult.error ??
    productsResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sales data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed.</p>
          </section>
        </div>
      </main>
    );
  }

  const customers = (customersResult.data ?? []) as Customer[];
  const locations = (locationsResult.data ?? []) as CustomerLocation[];
  const orders = (ordersResult.data ?? []) as SalesOrder[];
  const items = (itemsResult.data ?? []) as SalesOrderItem[];
  const products = (productsResult.data ?? []) as Product[];

  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  const itemsByOrder = new Map<string, SalesOrderItem[]>();
  for (const item of items) {
    const current = itemsByOrder.get(item.sales_order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.sales_order_id, current);
  }

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    label: `${customer.name} (${customer.customer_code})`,
  }));

  const locationOptions = locations.map((location) => ({
    id: location.id,
    customerId: location.customer_id,
    label: `${location.location_name} · ${customerById.get(location.customer_id)?.name ?? "customer"}`,
  }));

  const orderOptions = orders.map((order) => ({
    id: order.id,
    label: `${order.order_number} · ${customerById.get(order.customer_id)?.name ?? "customer"}`,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    label: `${product.product_name} (${product.product_code})`,
  }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Sales</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Customers, delivery locations and confirmed sales orders. Orders are commitments; they do not create
            invoices or revenue.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sales orders</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Latest 20. Append-only.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Lines</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {orders.map((order) => {
                  const lines = itemsByOrder.get(order.id) ?? [];
                  const total = lines.reduce((sum, line) => sum + Number(line.line_total), 0);

                  return (
                    <tr key={order.id}>
                      <td className="py-2 pr-3 font-medium">{order.order_number}</td>
                      <td className="py-2 pr-3">{customerById.get(order.customer_id)?.name ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">{order.order_source.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-xs">{order.payment_arrangement.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-xs">{order.status}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{lines.length}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No sales orders yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 grid gap-6 border-t border-[var(--line)] pt-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Create sales order</h3>
                <div className="mt-3">
                  <SalesOrderForm customers={customerOptions} locations={locationOptions} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Add order line</h3>
                <div className="mt-3">
                  <SalesOrderItemForm orders={orderOptions} products={productOptions} />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Customers</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {customers.map((customer) => (
                <div key={customer.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {customer.customer_code} · {customer.customer_category.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    Credit {customer.credit_status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
              {customers.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No customers.</p> : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <CustomerForm />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Delivery locations</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {locations.map((location) => (
                <div key={location.id} className="py-2">
                  <p className="text-sm font-medium">{location.location_name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {customerById.get(location.customer_id)?.name ?? "Unknown customer"} · {location.address}
                  </p>
                </div>
              ))}
              {locations.length === 0 ? (
                <p className="py-2 text-sm text-[var(--muted)]">No delivery locations.</p>
              ) : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <CustomerLocationForm customers={customerOptions} />
              </div>
            ) : null}
          </section>
        </div>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Credit limits are configured limits, not available balances. Price-override approval, invoicing, receivables
          and revenue recognition remain pending decisions.
        </p>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">
          P
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
          <p className="text-xs text-[var(--muted)]">Sales</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/procurement"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Procurement
        </Link>
        <Link
          href="/workspace"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Workspace
        </Link>
        <form action={signOut}>
          <button className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
