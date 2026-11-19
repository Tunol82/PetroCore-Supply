import type { Metadata } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

export const metadata: Metadata = {
  title: {
    default: "PetroCore Supply",
    template: "%s | PetroCore Supply",
  },
  description:
    "Petroleum procurement, sales, dispatch, haulage and delivery operations platform.",
  applicationName: "PetroCore Supply",
};

export const viewport = {
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
