import type { BdnsCall } from "@/lib/subsidy-purpose"
export function CallPurpose({
  call,
  error,
}: {
  call: BdnsCall | null
  error: boolean
}) {
  if (error)
    return (
      <p role="alert">
        No se ha podido consultar la finalidad de la convocatoria.
      </p>
    )
  if (!call)
    return (
      <p>
        Convocatoria pendiente de verificación. No se infiere su finalidad del
        título.
      </p>
    )
  return (
    <div className="space-y-2 text-sm leading-6">
      <p>{call.finalidad ?? "La ficha consultada no publica finalidad."}</p>
      <p className="text-muted-foreground">
        Finalidad declarada en la convocatoria {call.numero_convocatoria}. No
        acredita pago ni resultados. {call.tipo_convocatoria}
      </p>
      <a href={call.source_url} className="underline underline-offset-4">
        Ver convocatoria BDNS →
      </a>
      <p className="text-xs text-muted-foreground">
        Verificada el{" "}
        {new Date(call.checked_at).toLocaleDateString("es-ES", {
          timeZone: "Europe/Madrid",
        })}
        .
      </p>
    </div>
  )
}
