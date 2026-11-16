import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "brand" | "accent" | "danger";
}) {
  const accent =
    tone === "brand"
      ? "text-[var(--brand)]"
      : tone === "accent"
        ? "text-[var(--accent)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--ink)]";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular ${accent}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
