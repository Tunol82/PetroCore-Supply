import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/workspace/actions";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { ReceiptForm } from "./forms";

export const dynamic = "force-dynamic";

type Batch = {
  id: string;
  procurement_batch_id: string;
  product_id: string;
  location_id: string;
  original_quantity: number;
  remaining_quantity: number;
  landed_cost_per_unit: number;
  status: string;
  received_at: string;
};

type Movement = {
  id: string;
  inventory_batch_id: string;
  movement_type: string;
  quantity_in: number;
  quantity_out: number;
  reference_type: string;
  movement_date: string;
};

type ProcurementBatch = {
  id: string;
  batch_number: string;
  product_id: string;
  supplier_quantity: number;
  received_quantity: number | null;
  fulfilment_type: string;
};

type Product = { id: string; product_name: string };
type Location = { id: string; location_name: string; is_storage_location: boolean };

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 4,
  }).format(value);
}

export default async function InventoryPage() {
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
    supabase.rpc("has_permission", { p_permission_key: "inventory.view" }),
    supabase.rpc("has_permission", { p_permission_key: "inventory.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Not authorised</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">You cannot view inventory.</h1>
            <Link href="/workspace" className="mt-6 inline-block text-sm font-semibold text-[var(--brand)]">
              Return to workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [batchesResult, movementsResult, procurementResult, productsResult, locationsResult] = await Promise.all([
    supabase
      .from("inventory_batches")
      .select(
        "id, procurement_batch_id, product_id, location_id, original_quantity, remaining_quantity, landed_cost_per_unit, status, received_at",
      )
      .order("received_at", { ascending: false })
      .limit(30),
    supabase
      .from("inventory_movements")
      .select("id, inventory_batch_id, movement_type, quantity_in, quantity_out, reference_type, movement_date")
      .order("movement_date", { ascending: false })
      .limit(40),
    supabase
      .from("procurement_batches")
      .select("id, batch_number, product_id, supplier_quantity, received_quantity, fulfilment_type")
      .eq("fulfilment_type", "storage_receipt")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("products").select("id, product_name").order("product_name"),
    supabase
      .from("business_locations")
      .select("id, location_name, is_storage_location")
      .eq("status", "active")
      .order("location_name"),
  ]);

  const queryError =
    batchesResult.error ??
    movementsResult.error ??
    procurementResult.error ??
    productsResult.error ??
    locationsResult.error;

  if (queryError) {
    return (
      <main className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <Header />
          <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Inventory data could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No records were changed. Try again.</p>
          </section>
        </div>
      </main>
    );
  }

  const batches = (batchesResult.data ?? []) as Batch[];
  const movements = (movementsResult.data ?? []) as Movement[];
  const procurementBatches = (procurementResult.data ?? []) as ProcurementBatch[];
  const products = (productsResult.data ?? []) as Product[];
  const locations = (locationsResult.data ?? []) as Location[];

  const productById = new Map(products.map((product) => [product.id, product]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const procurementById = new Map(procurementBatches.map((batch) => [batch.id, batch]));
  const inventoryById = new Map(batches.map((batch) => [batch.id, batch]));

  const receivedByProcurement = new Map<string, number>();
  for (const batch of batches) {
    receivedByProcurement.set(
      batch.procurement_batch_id,
      (receivedByProcurement.get(batch.procurement_batch_id) ?? 0) + Number(batch.original_quantity),
    );
  }

  const receiptOptions = procurementBatches
    .map((batch) => {
      const verifiedQuantity = Number(batch.received_quantity ?? batch.supplier_quantity);
      const outstanding = verifiedQuantity - (receivedByProcurement.get(batch.id) ?? 0);
      return {
        id: batch.id,
        outstanding,
        label: `${batch.batch_number} · ${productById.get(batch.product_id)?.product_name ?? "product"} · ${formatQuantity(
          outstanding,
        )} outstanding of ${formatQuantity(verifiedQuantity)}`,
      };
    })
    .filter((batch) => batch.outstanding > 0);

  const locationOptions = locations
    .filter((location) => location.is_storage_location)
    .map((location) => ({ id: location.id, label: location.location_name }));

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <Header />

        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Inventory</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tenant.organisationName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Storage stock received from verified procurement, with an append-only movement ledger.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Stock batches</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Procurement batch</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3 text-right">Received</th>
                  <th className="py-2 pr-3 text-right">Remaining</th>
                  <th className="py-2 pr-3 text-right">Cost / unit</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-2 pr-3 font-medium">
                      {procurementById.get(batch.procurement_batch_id)?.batch_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{productById.get(batch.product_id)?.product_name ?? "—"}</td>
                    <td className="py-2 pr-3">{locationById.get(batch.location_id)?.location_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(batch.original_quantity))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(Number(batch.remaining_quantity))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(batch.landed_cost_per_unit))}</td>
                    <td className="py-2 pr-3 text-xs">{batch.status}</td>
                    <td className="py-2 text-xs">{new Date(batch.received_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {batches.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No stock has been received yet.</p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold">Receive storage procurement</h3>
              <div className="mt-3">
                <ReceiptForm batches={receiptOptions} locations={locationOptions} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Stock movements</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Append-only ledger. Movements are posted by trusted database functions, never edited directly.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">In</th>
                  <th className="py-2 pr-3 text-right">Out</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {movements.map((movement) => {
                  const batch = inventoryById.get(movement.inventory_batch_id);
                  return (
                    <tr key={movement.id}>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(movement.movement_date).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {batch ? procurementById.get(batch.procurement_batch_id)?.batch_number ?? "—" : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {batch ? productById.get(batch.product_id)?.product_name ?? "—" : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">{movement.movement_type}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {Number(movement.quantity_in) > 0 ? formatQuantity(Number(movement.quantity_in)) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {Number(movement.quantity_out) > 0 ? formatQuantity(Number(movement.quantity_out)) : "—"}
                      </td>
                      <td className="py-2 text-xs">{movement.reference_type.replaceAll("_", " ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {movements.length === 0 ? (
              <p className="py-3 text-sm text-[var(--muted)]">No stock movements yet.</p>
            ) : null}
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
          Reservations, issues, FIFO allocations and adjustments are not implemented yet. Until issues are posted,
          remaining quantity only changes through authorised corrections.
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
          <p className="text-xs text-[var(--muted)]">Inventory</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/workspace/inventory/fulfilment"
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Fulfilment
        </Link>
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
