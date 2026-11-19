import type { Metadata } from "next";
import { BrandMark } from "@/components/shell/brand-mark";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--page)] px-5 py-12">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-center">
          <BrandMark size={44} />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--warning)]">Offline</p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">You are not connected</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          PetroCore Supply needs a connection to load live records. Nothing has been saved or posted while offline.
        </p>
        <a
          href="/workspace"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
