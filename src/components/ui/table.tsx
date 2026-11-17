import type { ReactNode } from "react";

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-thin -mx-5 overflow-x-auto px-5">
      {children}
    </div>
  );
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--line)]">{children}</tbody>;
}

export function TFoot({ children }: { children: ReactNode }) {
  return (
    <tfoot className="border-t border-[var(--line)] bg-[var(--surface-2)] font-semibold">{children}</tfoot>
  );
}

export function TR({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <tr className={`align-top ${className}`} data-testid={testId}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap py-2.5 pr-4 font-semibold ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`py-2.5 pr-4 text-[13px] ${align === "right" ? "text-right tabular" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
