import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { BatchForm, DepotForm, ProductForm, SupplierForm } from "./procurement-forms";

export const dynamic = "force-dynamic";

type Supplier = { id: string; supplier_code: string; name: string; status: string };
type Depot = { id: string; supplier_id: string; depot_code: string; name: string };
type Product = { id: string; product_code: string; product_name: string; unit_of_measure: string };
type Location = { id: string; location_name: string; location_code: string; status: string };
type Batch = {
  id: string;
  batch_number: string;
  supplier_id: string;
  supplier_depot_id: string;
  product_id: string;
  supplier_quantity: number;
  loaded_quantity: number | null;
  received_quantity: number | null;
  total_quantity_variance: number | null;
  fulfilment_type: string;
  variance_status: string;
  created_at: string;
};

function formatQuantity(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

export default async function ProcurementPage() {
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
    supabase.rpc("has_permission", { p_permission_key: "procurement.view" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view procurement for this workspace.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Procurement requires the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">procurement.view</code> or{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">procurement.manage</code> permission.
            </p>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [suppliersResult, depotsResult, productsResult, locationsResult, batchesResult] = await Promise.all([
    supabase.from("suppliers").select("id, supplier_code, name, status").order("name"),
    supabase.from("supplier_depots").select("id, supplier_id, depot_code, name").order("name"),
    supabase.from("products").select("id, product_code, product_name, unit_of_measure").order("product_name"),
    supabase
      .from("business_locations")
      .select("id, location_name, location_code, status")
      .eq("status", "active")
      .order("location_name"),
    supabase
      .from("procurement_batches")
      .select(
        "id, batch_number, supplier_id, supplier_depot_id, product_id, supplier_quantity, loaded_quantity, received_quantity, total_quantity_variance, fulfilment_type, variance_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const queryError =
    suppliersResult.error ??
    depotsResult.error ??
    productsResult.error ??
    locationsResult.error ??
    batchesResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Procurement data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed. Try again.</p>
          </section>
        </div>
      </main>
    );
  }

  const suppliers = (suppliersResult.data ?? []) as Supplier[];
  const depots = (depotsResult.data ?? []) as Depot[];
  const products = (productsResult.data ?? []) as Product[];
  const locations = (locationsResult.data ?? []) as Location[];
  const batches = (batchesResult.data ?? []) as Batch[];

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const depotById = new Map(depots.map((depot) => [depot.id, depot]));
  const productById = new Map(products.map((product) => [product.id, product]));

  const supplierOptions = suppliers.map((supplier) => ({
    id: supplier.id,
    label: `${supplier.name} (${supplier.supplier_code})`,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    label: `${product.product_name} (${product.product_code})`,
  }));

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.location_name} (${location.location_code})`,
  }));

  const depotOptions = depots.map((depot) => ({
    id: depot.id,
    supplierId: depot.supplier_id,
    label: `${depot.name} (${depot.depot_code})`,
  }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Procurement</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Suppliers, products, depots and procurement batches. Quantities are recorded as measured; measurement
            policy is pending.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Procurement batches</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Latest 20. Batches are append-only; corrections will use a separate adjustment workflow.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Supplier / depot</th>
                  <th className="py-2 pr-3 text-right">Supplier</th>
                  <th className="py-2 pr-3 text-right">Loaded</th>
                  <th className="py-2 pr-3 text-right">Received</th>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-2 pr-3 font-medium">{batch.batch_number}</td>
                    <td className="py-2 pr-3">{productById.get(batch.product_id)?.product_name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {supplierById.get(batch.supplier_id)?.name ?? "—"}
                      <span className="block text-xs text-[var(--muted)]">
                        {depotById.get(batch.supplier_depot_id)?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(batch.supplier_quantity)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(batch.loaded_quantity)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(batch.received_quantity)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {batch.fulfilment_type === "storage_receipt" ? "Storage" : "Direct"}
                    </td>
                    <td className="py-2 text-xs">
                      {batch.variance_status.replaceAll("_", " ")}
                      {batch.total_quantity_variance !== null ? (
                        <span className="block text-[var(--muted)]">
                          {formatQuantity(batch.total_quantity_variance)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {batches.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No procurement batches recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record a batch</h3>
              <div className="mt-3">
                <BatchForm
                  suppliers={supplierOptions}
                  depots={depotOptions}
                  products={productOptions}
                  locations={locationOptions}
                />
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Suppliers</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{supplier.name}</p>
                    <p className="text-xs text-[var(--muted)]">{supplier.supplier_code}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{supplier.status}</span>
                </div>
              ))}
              {suppliers.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No suppliers.</p> : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <SupplierForm />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Products</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{product.product_name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {product.product_code} · {product.unit_of_measure}
                    </p>
                  </div>
                </div>
              ))}
              {products.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No products.</p> : null}
            </div>
            {canManage ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <ProductForm />
              </div>
            ) : null}
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Supplier depots</h2>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {depots.map((depot) => (
              <div key={depot.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{depot.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {depot.depot_code} · {supplierById.get(depot.supplier_id)?.name ?? "Unknown supplier"}
                  </p>
                </div>
              </div>
            ))}
            {depots.length === 0 ? <p className="py-2 text-sm text-[var(--muted)]">No depots.</p> : null}
          </div>
          {canManage ? (
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <DepotForm suppliers={supplierOptions} />
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Every record is tenant-scoped and enforced by Row Level Security. Procurement batches are append-only and
          audited. Tolerances, temperature correction and variance assessment remain pending business decisions.
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
          <p className="text-xs text-[var(--muted)]">Procurement</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Workspace
        </Link>
        <Link
          href="/account/security"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Security
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
