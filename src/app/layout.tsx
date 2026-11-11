import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deuces Supply | Operations",
  description: "Petroleum supply, haulage and delivery operations workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
