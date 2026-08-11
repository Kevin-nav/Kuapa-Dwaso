import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kuapa Dwaso",
    short_name: "Kuapa Dwaso",
    description: "Farmer, buyer, and transporter access to the Kuapa Dwaso warehouse network.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8f4",
    theme_color: "#173d2b",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
