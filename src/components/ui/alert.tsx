import type { ReactNode } from "react";

type Tone = "error" | "success" | "info" | "warning";

const tones: Record<Tone, string> = {
  error: "border-[var(--danger)]/25 bg-[var(--danger-soft)] text-[var(--danger)]",
  success: "border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success)]",
  info: "border-[var(--brand)]/20 bg-[var(--brand-soft)] text-[var(--brand)]",
  warning: "border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]",
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <p role={role} className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}
