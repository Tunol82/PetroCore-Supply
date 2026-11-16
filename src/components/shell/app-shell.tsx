"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/workspace/actions";
import { BrandMark } from "./brand-mark";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

function isActive(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  // Mark only the most specific matching link, so a parent does not light up
  // while a child page is open.
  return !allHrefs.some(
    (other) => other !== href && other.startsWith(`${href}/`) && pathname.startsWith(other),
  );
}

export function AppShell({
  organisationName,
  organisationCode,
  userEmail,
  groups,
  children,
}: {
  organisationName: string;
  organisationCode: string;
  userEmail: string;
  groups: NavGroup[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allHrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, allHrefs);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "bg-white/10 font-semibold text-white"
                        : "text-white/85 hover:bg-white/5 hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-[var(--sidebar-w)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col bg-[var(--sidebar)] lg:flex">
        <div className="flex items-center gap-3 px-4 py-4">
          <BrandMark size={36} />
          <div>
            <p className="text-[13px] font-bold tracking-tight text-white">PETROCORE SUPPLY</p>
            <p className="text-[11px] text-white/50">Operations</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-[11px] font-semibold text-white/90">{organisationName}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/50">{organisationCode}</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-[var(--sidebar)]">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <BrandMark size={36} />
                <div>
                  <p className="text-[13px] font-bold tracking-tight text-white">PETROCORE SUPPLY</p>
                  <p className="text-[11px] text-white/50">Operations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav}
            <div className="border-t border-white/10 px-4 py-3">
              <p className="truncate text-[11px] font-semibold text-white/90">{organisationName}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/50">{organisationCode}</p>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] p-2 text-[var(--ink-2)] lg:hidden"
                aria-label="Open navigation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand)]">
                  {organisationCode}
                </span>
                <span className="hidden text-sm font-medium text-[var(--ink-2)] sm:inline">{organisationName}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/account/security"
                className="hidden text-xs text-[var(--muted)] hover:text-[var(--ink)] sm:block"
              >
                {userEmail}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
