import Link from "next/link";

export type TabItem = { href: string; label: string; count?: number };

export function Tabs({ items, active }: { items: TabItem[]; active: string }) {
  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-[var(--line)]">
      {items.map((item) => {
        const isActive = item.href === active;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              isActive
                ? "border-[var(--brand-mid)] text-[var(--brand)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular ${
                  isActive
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "bg-[var(--surface-3)] text-[var(--muted)]"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
