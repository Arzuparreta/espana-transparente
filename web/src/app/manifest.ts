import type { MetadataRoute } from "next"
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#1A1612",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
