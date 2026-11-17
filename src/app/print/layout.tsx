import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--surface-2)] print:bg-white">{children}</div>;
}
