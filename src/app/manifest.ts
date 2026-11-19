import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetroCore Supply",
    short_name: "PetroCore",
    description: "Petroleum procurement, dispatch, delivery and operational finance.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e40af",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
