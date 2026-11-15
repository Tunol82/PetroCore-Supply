import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { CostCategoryForm, CostComponentForm } from "./cost-forms";

export const dynamic = "force-dynamic";

type Category = {
  id: string;
  category_name: string;
  category_type: string;
  landed_cost_inclusion: boolean;
  allocation_method: string;
  status: string;
};

type Component = {
  id: string;
  procurement_batch_id: string;
  cost_category_id: string;
  amount: number;
  supplier_id: string | null;
  reference_number: string | null;
  approval_status: string;
  created_at: string;
};

type Batch = { id: string; batch_number: string };
type Supplier = { id: string; name: string };

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ProcurementCostsPage() {
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
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view procurement costs.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [categoriesResult, componentsResult, batchesResult, suppliersResult] = await Promise.all([
    supabase
      .from("cost_categories")
      .select("id, category_name, category_type, landed_cost_inclusion, allocation_method, status")
      .order("category_name"),
    supabase
      .from("procurement_cost_components")
      .select("id, procurement_batch_id, cost_category_id, amount, supplier_id, reference_number, approval_status, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("procurement_batches").select("id, batch_number").order("created_at", { ascending: false }).limit(30),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const queryError =
    categoriesResult.error ?? componentsResult.error ?? batchesResult.error ?? suppliersResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Cost data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed.</p>
          </section>
        </div>
      </main>
    );
  }

  const categories = (categoriesResult.data ?? []) as Category[];
  const components = (componentsResult.data ?? []) as Component[];
  const batches = (batchesResult.data ?? []) as Batch[];
  const suppliers = (suppliersResult.data ?? []) as Supplier[];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    label: category.category_name,
  }));

  const batchOptions = batches.map((batch) => ({
    id: batch.id,
    label: batch.batch_number,
  }));

  const supplierOptions = suppliers.map((supplier) => ({
    id: supplier.id,
    label: supplier.name,
  }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Procurement</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Costs — {tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Cost categories and procurement cost components. Allocation and approval remain pending decisions.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Cost components</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Latest 30. Append-only evidence; approval status starts as pending.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {components.map((component) => (
                  <tr key={component.id}>
                    <td className="py-2 pr-3 font-medium">
                      {batchById.get(component.procurement_batch_id)?.batch_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {categoryById.get(component.cost_category_id)?.category_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{component.reference_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatAmount(component.amount)}</td>
                    <td className="py-2 text-xs">{component.approval_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {components.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No cost components recorded yet.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Record a cost component</h3>
              <div className="mt-3">
                <CostComponentForm
                  batches={batchOptions}
                  categories={categoryOptions}
                  suppliers={supplierOptions}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Cost categories</h2>
          <div className="mt-3 divide-y divide-[var(--line)]">
            {categories.map((category) => (
              <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{category.category_name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {category.category_type.replaceAll("_", " ")} · {category.allocation_method.replaceAll("_", " ")}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {category.landed_cost_inclusion ? "Landed cost" : "Not landed"} · {category.status}
                </span>
              </div>
            ))}
            {categories.length === 0 ? (
              <p className="py-2 text-sm text-[var(--muted)]">No cost categories.</p>
            ) : null}
          </div>

          {canManage ? (
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <h3 className="text-sm font-semibold">Create cost category</h3>
              <div className="mt-3">
                <CostCategoryForm />
              </div>
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Inbound procurement costs belong here only when the category is configured as landed cost. Outbound customer
          delivery haulage must be recorded separately. No allocation is applied in this release.
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
          <p className="text-xs text-[var(--muted)]">Procurement costs</p>
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
