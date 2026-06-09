import { cn } from "@/lib/utils"

export type SectionIconName =
  | "personas"
  | "dinero-publico"
  | "decisiones"
  | "fuentes"
  | "diputados"
  | "senado"
  | "partidos"
  | "gobierno"
  | "instituciones"
  | "presupuestos"
  | "contratos"
  | "subvenciones"
  | "fondos-ue"
  | "organizaciones"
  | "ccaa"
  | "municipios"
  | "votaciones"
  | "iniciativas"
  | "distorsion"
  | "declaraciones"
  | "indicadores"
  | "puertas-giratorias"
  | "procesos-judiciales"
  | "grupos-interes"
  | "gasto-territorios"
  | "calculadoras"
  | "estado-datos"
  | "buscar"
  | "dinero-publico-trazabilidad"

interface SectionIconProps {
  name: SectionIconName
  size?: number
  className?: string
  strokeWidth?: number
}

const ACCENT = "hsl(var(--accent))"

export function SectionIcon({ name, size = 24, className, strokeWidth = 1.6 }: SectionIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: cn("shrink-0", className),
  }

  switch (name) {
    case "personas":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20.5 v-0.5 a5 5 0 0 1 5 -5 h4 a5 5 0 0 1 5 5 v0.5" />
        </svg>
      )
    case "dinero-publico":
    case "dinero-publico-trazabilidad":
      return (
        <svg {...common}>
          <path d="M19 6a7.7 7.7 0 0 0 -5.2 -2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8 -.8 5.2 -2" />
          <line x1="4" y1="10" x2="16" y2="10" />
          <line x1="4" y1="14" x2="13" y2="14" stroke={ACCENT} />
        </svg>
      )
    case "decisiones":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <path d="M8 12 l3 3 l5.5 -6.5" stroke={ACCENT} strokeWidth={2} />
        </svg>
      )
    case "fuentes":
      return (
        <svg {...common}>
          <path d="M6 3.5 h8.5 L19 8 v11 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 V5.5 a2 2 0 0 1 2 -2 z" />
          <path d="M14.5 3.5 V8 H19" />
          <line x1="8" y1="13" x2="15" y2="13" />
          <line x1="8" y1="16.5" x2="15" y2="16.5" stroke={ACCENT} />
        </svg>
      )
    case "diputados":
      return (
        <svg {...common}>
          <circle cx="12" cy="6" r="2.3" />
          <path d="M 8 12.5 v-0.3 a4 4 0 0 1 4 -3.5 a4 4 0 0 1 4 3.5 v0.3" />
          <rect x="4" y="14" width="16" height="6" rx="1" />
          <line x1="8" y1="17" x2="16" y2="17" stroke={ACCENT} />
        </svg>
      )
    case "senado":
      return (
        <svg {...common}>
          <path d="M3 20 V11 L12 5 L21 11 V20" />
          <line x1="3" y1="20.5" x2="21" y2="20.5" />
          <line x1="7" y1="20" x2="7" y2="13" />
          <line x1="12" y1="20" x2="12" y2="13" stroke={ACCENT} />
          <line x1="17" y1="20" x2="17" y2="13" />
        </svg>
      )
    case "partidos":
      return (
        <svg {...common}>
          <line x1="5" y1="3" x2="5" y2="21" />
          <rect x="5" y="4" width="13" height="9" rx="0.5" />
          <line x1="5" y1="8.5" x2="18" y2="8.5" stroke={ACCENT} />
        </svg>
      )
    case "gobierno":
      return (
        <svg {...common}>
          <polygon points="12,3 21,7 3,7" />
          <line x1="6" y1="8" x2="6" y2="19" />
          <line x1="10" y1="8" x2="10" y2="19" />
          <line x1="14" y1="8" x2="14" y2="19" />
          <line x1="18" y1="8" x2="18" y2="19" />
          <line x1="3" y1="20" x2="21" y2="20" stroke={ACCENT} strokeWidth={2} />
        </svg>
      )
    case "instituciones":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <rect x="7" y="6" width="3" height="3" />
          <rect x="14" y="6" width="3" height="3" />
          <rect x="7" y="11" width="3" height="3" fill={ACCENT} stroke={ACCENT} />
          <rect x="14" y="11" width="3" height="3" />
          <rect x="10.5" y="15" width="3" height="6" />
        </svg>
      )
    case "presupuestos":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M 12 12 L 12 4 A 8 8 0 0 1 18.93 16 Z" fill={ACCENT} stroke={ACCENT} />
        </svg>
      )
    case "contratos":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="11" x2="17" y2="11" />
          <line x1="7" y1="14" x2="14" y2="14" />
          <circle cx="15" cy="17.5" r="2.2" stroke={ACCENT} />
        </svg>
      )
    case "subvenciones":
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="11" rx="1" />
          <line x1="12" y1="10" x2="12" y2="21" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <path d="M 8 10 L 12 5 L 16 10" stroke={ACCENT} />
        </svg>
      )
    case "fondos-ue":
      return (
        <svg {...common}>
          <circle cx="12" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="17.3" cy="6.7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="17.3" cy="17.3" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="6.7" cy="17.3" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="6.7" cy="6.7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="2" fill={ACCENT} stroke="none" />
        </svg>
      )
    case "organizaciones":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="5" rx="0.5" />
          <line x1="12" y1="8" x2="12" y2="11" />
          <path d="M 6 14 V 11 H 18 V 14" />
          <rect x="3" y="14" width="6" height="5" rx="0.5" />
          <rect x="15" y="14" width="6" height="5" rx="0.5" stroke={ACCENT} />
        </svg>
      )
    case "ccaa":
      return (
        <svg {...common}>
          <path d="M4 6 L9 4 L15 7 L20 5 V18 L15 20 L9 17 L4 19 Z" />
          <line x1="9" y1="4" x2="9" y2="17" />
          <line x1="15" y1="7" x2="15" y2="20" stroke={ACCENT} />
        </svg>
      )
    case "municipios":
      return (
        <svg {...common}>
          <path d="M3 20 V11 L8 7 L13 11 V20" />
          <path d="M13 20 V13 L18 10 L21 12 V20" />
          <line x1="3" y1="20.5" x2="21" y2="20.5" />
          <rect x="6" y="14" width="2.5" height="2.5" stroke={ACCENT} />
        </svg>
      )
    case "votaciones":
      return (
        <svg {...common}>
          <path d="M 9 12 H 4 a 1 1 0 0 0 -1 1 V 20 a 1 1 0 0 0 1 1 H 20 a 1 1 0 0 0 1 -1 V 13 a 1 1 0 0 0 -1 -1 H 15" />
          <rect x="9" y="3" width="6" height="9" rx="0.5" />
          <path d="M 10.5 7 l 1 1 l 1.8 -2.5" stroke={ACCENT} strokeWidth={1.8} />
        </svg>
      )
    case "iniciativas":
      return (
        <svg {...common}>
          <path d="M6 3 h9 l3 3 v15 H6 z" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="9" y1="12.5" x2="15" y2="12.5" />
          <line x1="9" y1="16" x2="13" y2="16" stroke={ACCENT} />
        </svg>
      )
    case "distorsion":
      return (
        <svg {...common}>
          <line x1="3" y1="20.5" x2="21" y2="20.5" />
          <rect x="5" y="10" width="3.5" height="10" />
          <rect x="10.25" y="14" width="3.5" height="6" />
          <rect x="15.5" y="6" width="3.5" height="14" stroke={ACCENT} />
        </svg>
      )
    case "declaraciones":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="13" y2="16" stroke={ACCENT} />
        </svg>
      )
    case "indicadores":
      return (
        <svg {...common}>
          <line x1="3" y1="20.5" x2="21" y2="20.5" />
          <rect x="5" y="14" width="3.5" height="6" />
          <rect x="10.25" y="10" width="3.5" height="10" />
          <rect x="15.5" y="5" width="3.5" height="15" fill={ACCENT} stroke={ACCENT} />
        </svg>
      )
    case "puertas-giratorias":
      return (
        <svg {...common}>
          <path d="M 4.5 11 a 7.5 7.5 0 0 1 13.5 -3.5" />
          <polyline points="18 4 18 8.5 13.5 8.5" />
          <path d="M 19.5 13 a 7.5 7.5 0 0 1 -13.5 3.5" stroke={ACCENT} />
          <polyline points="6 20 6 15.5 10.5 15.5" stroke={ACCENT} />
        </svg>
      )
    case "procesos-judiciales":
      return (
        <svg {...common}>
          <line x1="12" y1="4.5" x2="12" y2="18" />
          <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
          <line x1="6" y1="7.5" x2="18" y2="7.5" />
          <path d="M4 7.5 L6 11.5 L8 7.5" />
          <path d="M16 7.5 L18 11.5 L20 7.5" stroke={ACCENT} />
          <line x1="8" y1="18.5" x2="16" y2="18.5" />
        </svg>
      )
    case "grupos-interes":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="3.2" />
          <circle cx="4.8" cy="6" r="1.8" />
          <circle cx="19.2" cy="6" r="1.8" />
          <path d="M6.2 7.2 L9.4 10.6" />
          <path d="M17.8 7.2 L14.6 10.6" stroke={ACCENT} />
        </svg>
      )
    case "gasto-territorios":
      return (
        <svg {...common}>
          <path d="M12 21 C12 21 18.5 14.5 18.5 9 A6.5 6.5 0 0 0 5.5 9 C5.5 14.5 12 21 12 21 Z" />
          <circle cx="12" cy="9" r="3" stroke={ACCENT} />
          <line x1="10.4" y1="8.2" x2="13.3" y2="8.2" stroke={ACCENT} />
          <line x1="10.4" y1="9.8" x2="13.3" y2="9.8" stroke={ACCENT} />
        </svg>
      )
    case "calculadoras":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <rect x="7.5" y="5.5" width="9" height="3.5" rx="0.5" />
          <circle cx="8.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="16" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="16" r="1.1" fill={ACCENT} stroke="none" />
        </svg>
      )
    case "estado-datos":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="2.5" />
          <path d="M5 6 V12 a7 2.5 0 0 0 14 0 V6" />
          <path d="M5 12 V18 a7 2.5 0 0 0 14 0 V12" />
          <circle cx="17" cy="6" r="1.2" fill={ACCENT} stroke="none" />
        </svg>
      )
    case "buscar":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <line x1="16" y1="16" x2="20.5" y2="20.5" stroke={ACCENT} strokeWidth={2} />
        </svg>
      )
  }
}

const GROUP_LABEL_TO_NAME: Record<string, SectionIconName> = {
  Personas: "personas",
  "Dinero público": "dinero-publico",
  Decisiones: "decisiones",
  "Fuentes y cobertura": "fuentes",
}

export function groupIconName(groupLabel: string): SectionIconName | null {
  return GROUP_LABEL_TO_NAME[groupLabel] ?? null
}

const COUNT_KEY_TO_NAME: Record<string, SectionIconName> = {
  diputados: "diputados",
  senado: "senado",
  gobierno: "gobierno",
  partidos: "partidos",
  instituciones: "instituciones",
  "dinero-publico": "dinero-publico-trazabilidad",
  presupuestos: "presupuestos",
  contratos: "contratos",
  subvenciones: "subvenciones",
  "fondos-ue": "fondos-ue",
  organizaciones: "organizaciones",
  ccaa: "ccaa",
  municipios: "municipios",
  votaciones: "votaciones",
  iniciativas: "iniciativas",
  distorsion: "distorsion",
  "puertas-giratorias": "puertas-giratorias",
  corrupcion: "procesos-judiciales",
  "grupos-de-interes": "grupos-interes",
  territorio: "gasto-territorios",
  calculadoras: "calculadoras",
  declaraciones: "declaraciones",
  indicadores: "indicadores",
  "estado-datos": "estado-datos",
  buscar: "buscar",
}

export function sectionIconForKey(key: string): SectionIconName | null {
  return COUNT_KEY_TO_NAME[key] ?? null
}
