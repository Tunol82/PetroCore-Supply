import { ArrowUpRight, Boxes, ClipboardList, Fuel, Route, ShieldCheck } from "lucide-react";

const areas = [
  { title: "Procurement", detail: "Suppliers, depots, purchase orders and procurement batches", icon: ClipboardList },
  { title: "Inventory", detail: "Controlled stock, batch traceability and warehouse movements", icon: Boxes },
  { title: "Sales", detail: "Customers, orders, pricing, invoices and receivables", icon: Fuel },
  { title: "Dispatch & haulage", detail: "Transporters, trips, loading and delivery confirmation", icon: Route },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">P</div>
            <div>
              <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-xs text-[var(--muted)]">Supply · Haulage · Delivery</p>
            </div>
          </div>
          <a href="/login" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">Sign in</a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Operations platform</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A clearer view of every supply movement.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            One connected workspace for petroleum procurement, customer orders, dispatch, delivery evidence and operational profitability.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[var(--brand-soft)] p-2.5 text-[var(--brand)]"><ShieldCheck size={20} /></div>
              <div>
                <h2 className="font-semibold">Project foundation is ready for setup</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">This is a starter shell. No live business data or transactions are connected.</p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Configuration pending</span>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold">Business areas</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Modules will be enabled in controlled implementation phases.</p>
            </div>
            <span className="text-xs text-[var(--muted)]">Not yet active</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {areas.map(({ title, detail, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-[var(--brand-soft)] p-2.5 text-[var(--brand)]"><Icon size={20} /></div>
                  <ArrowUpRight size={17} className="text-slate-400" />
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p>
                <p className="mt-4 text-xs font-medium text-slate-400">Planned module</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
          PetroCore Supply · Initial application scaffold · No production database connected
        </footer>
      </div>
    </main>
  );
}
