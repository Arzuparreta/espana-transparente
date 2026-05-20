import type { Metadata } from "next"
import localFont from "next/font/local"
import { cn } from "@/lib/utils"
import "../globals.css"

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
})

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("dark font-sans", geistSans.variable, geistMono.variable)}>
      <body className="min-h-screen bg-[#0B0B0A] text-[#EEEDE9] antialiased">
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
