import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The Playwright suite drives the development server over 127.0.0.1,
  // which Next.js blocks for internal dev resources unless declared here.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
