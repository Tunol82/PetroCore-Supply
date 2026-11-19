import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The dev overlay badge overlaps the sidebar footer in screenshots.
  devIndicators: false,
  experimental: {
    // Delivery evidence uploads are capped at 5 MB by the bucket; allow a little
    // headroom for multipart overhead.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // The Playwright suite drives the development server over 127.0.0.1,
  // which Next.js blocks for internal dev resources unless declared here.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
