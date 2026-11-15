export default function WorkspaceLoading() {
  return (
    <main className="min-h-screen px-5 py-12" aria-busy="true">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">P</div>
            <div>
              <p className="text-sm font-bold tracking-tight">PETROCORE SUPPLY</p>
              <p className="text-xs text-[var(--muted)]">Secure workspace</p>
            </div>
          </div>
        </header>

        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Verifying access</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Confirming your session and workspace access. This should only take a moment.
          </p>
          <div className="mt-6 space-y-3" aria-hidden="true">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </section>
      </div>
    </main>
  );
}
