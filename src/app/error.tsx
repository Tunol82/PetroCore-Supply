"use client";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">This page could not be loaded.</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          The action was not completed. No financial, inventory or access change has been recorded. Try again, or
          contact your administrator if the problem continues.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
