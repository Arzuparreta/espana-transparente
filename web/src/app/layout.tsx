import type { Metadata } from "next"
import localFont from "next/font/local"
import { cn } from "@/lib/utils"
import { ClientProviders } from "@/components/layout/ClientProviders"
import { ContextBreadcrumb } from "@/components/layout/ContextBreadcrumb"
import { Footer } from "@/components/layout/Footer"
import { Header } from "@/components/layout/Header"
import { NavigationProgress } from "@/components/navigation/NavigationProgress"
import {
  BRAND_DESCRIPTION,
  BRAND_LONG_DESCRIPTION,
  BRAND_NAME,
  BRAND_URL,
} from "@/lib/brand"
import "./globals.css"

// Data pages use their own bounded caches. Rendering at request time keeps
// deployments independent from the availability of the production database.
export const dynamic = "force-dynamic"

export const viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_URL),
  applicationName: BRAND_NAME,
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_LONG_DESCRIPTION,
  keywords: [
    "transparencia",
    "política",
    "España",
    "diputados",
    "congreso",
    "datos abiertos",
    "subvenciones",
    "contratos públicos",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/brand/espana-transparente-mark.svg", color: "#1A1612" }],
  },
  openGraph: {
    title: BRAND_NAME,
    description: BRAND_LONG_DESCRIPTION,
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: "/brand/og-image-v2.png",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - datos públicos de la política española`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: ["/brand/og-image-v2.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={cn("dark font-sans", geistSans.variable, geistMono.variable)}>
      <body
        className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased"
      >
        <ClientProviders>
          <NavigationProgress />
          <Header />
          <main className="ui-shell overflow-x-hidden py-5 sm:py-8">
            <ContextBreadcrumb />
            {children}
          </main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  )
}
