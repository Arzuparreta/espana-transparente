import type { Metadata } from "next"
import localFont from "next/font/local"
import { cn } from "@/lib/utils"
import { Header } from "@/components/layout/Header"
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
  title: {
    default: "Acción Humana",
    template: "%s | Acción Humana",
  },
  description:
    "Transparencia radical sobre la política española. Datos objetivos, sin filtros ideológicos.",
  keywords: [
    "transparencia",
    "política",
    "España",
    "diputados",
    "congreso",
    "datos abiertos",
  ],
  openGraph: {
    title: "Acción Humana",
    description:
      "Transparencia radical sobre la política española. Datos objetivos, sin filtros ideológicos.",
    type: "website",
    locale: "es_ES",
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
        <Header />
        <main className="ui-shell overflow-x-hidden py-5 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
