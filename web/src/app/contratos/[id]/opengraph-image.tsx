import { ImageResponse } from "@vercel/og"
import { getContractDetail } from "@/lib/data"
import { BRAND_NAME, BRAND_URL } from "@/lib/brand"

export const contentType = "image/png"
export const size = { width: 1200, height: 630 }

interface Props {
  params: Promise<{ id: string }>
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—"
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M €`
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount)
}

export default async function Image({ params }: Props) {
  const { id } = await params

  let contract = null
  try {
    const result = await getContractDetail(id)
    contract = result.contract
  } catch {
    // DB error or timeout — render brand fallback below
  }

  // Contract not found or DB error: redirect to static brand og-image
  if (!contract) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${BRAND_URL}/brand/og-image.png` },
    })
  }

  const title = contract.title ?? "Contrato público"
  const amount = contract.amount ? formatAmount(contract.amount) : null
  const body = contract.awarding_body ?? null

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f0e0d",
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top label */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "#b45309",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 12px",
              borderRadius: 4,
            }}
          >
            Contrato público
          </div>
          <span style={{ color: "#6b7280", fontSize: 13 }}>PCSP · Ministerio de Hacienda</span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {amount && (
            <div style={{ color: "#f59e0b", fontSize: 72, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {amount}
            </div>
          )}
          <div
            style={{
              color: "#f3f4f6",
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.25,
              maxWidth: 900,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {body && (
            <div style={{ color: "#9ca3af", fontSize: 22 }}>
              {body}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280", fontSize: 16 }}>{BRAND_URL.replace("https://", "")}</span>
          <span style={{ color: "#374151", fontSize: 16 }}>{BRAND_NAME}</span>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  )
}
