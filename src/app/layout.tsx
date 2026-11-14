import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PetroCore Supply",
    template: "%s | PetroCore Supply",
  },
  description:
    "Petroleum procurement, sales, dispatch, haulage and delivery operations platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
