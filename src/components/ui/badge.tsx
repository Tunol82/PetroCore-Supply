import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface-3)] text-[var(--ink-2)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

const aliases: Record<string, Tone> = {
  available: "success",
  exhausted: "neutral",
  held: "warning",
  closed: "neutral",
  active: "success",
  released: "neutral",
  fulfilled: "brand",
  partially_fulfilled: "warning",
  cancelled: "neutral",
  draft: "neutral",
  posted: "success",
  reversed: "danger",
  recorded: "brand",
  confirmed: "success",
  rejected: "danger",
  not_assessed: "warning",
  open: "warning",
  under_investigation: "warning",
  resolved: "success",
  approved_loss: "danger",
  flagged: "warning",
  within_tolerance: "success",
  investigated: "brand",
  pending: "warning",
  dispute: "danger",
  disputed: "danger",
  completed: "success",
  planned: "neutral",
  in_transit: "brand",
  delivered: "success",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
        tones[tone ?? "neutral"]
      }`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = aliases[status] ?? "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}
