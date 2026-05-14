import type { Metadata } from "next"
import localFont from "next/font/local"
import { cn } from "@/lib/utils"
import { Header } from "@/components/layout/Header"
import { NavigationProgress } from "@/components/navigation/NavigationProgress"
import "./globals.css"

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://web-pi-two-62.vercel.app"),
  applicationName: "Acción Humana",
  title: {
    default: "Acción Humana",
    template: "%s | Acción Humana",
  },
  description:
    "Datos públicos para seguir quién decidió qué en la política española. Personas, poder y trazabilidad.",
  keywords: [
    "transparencia",
    "política",
    "España",
    "diputados",
    "congreso",
    "datos abiertos",
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
    other: [{ rel: "mask-icon", url: "/brand/accion-humana-mark.svg", color: "#0a2a53" }],
  },
  openGraph: {
    title: "Acción Humana",
    description:
      "Datos públicos para seguir quién decidió qué en la política española. Personas, poder y trazabilidad.",
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Acción Humana — personas, poder y trazabilidad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Acción Humana",
    description:
      "Datos públicos para seguir quién decidió qué en la política española.",
    images: ["/brand/og-image.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={cn("font-sans", geistSans.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground overflow-x-hidden`}
      >
        <NavigationProgress />
        <Header />
        <main className="ui-shell overflow-x-hidden py-5 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
