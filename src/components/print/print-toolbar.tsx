"use client";

import Link from "next/link";

export function PrintToolbar({
  title,
  backHref,
  backLabel,
}: {
  title: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="no-print sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-6 py-3">
        <p className="text-[13px] font-semibold text-[var(--ink)]">{title}</p>
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--surface-3)]"
          >
            {backLabel}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[var(--brand)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[var(--brand-hover)]"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
