import { parsePage } from "@/lib/data";
import Link from "next/link";
import { PageHeader } from "@/components/domain/PageHeader";
import { ParliamentActivity } from "@/components/domain/ParliamentActivity";
import { getParliamentActivity } from "@/lib/data/parliament-activity";
export const revalidate = 3600;
export const metadata = {
  title: "Vivienda: decisiones, dinero y precios",
  description:
    "Actividad parlamentaria documentada, gasto por funciones y precios: periodos y ámbitos propios, sin atribuir causalidad ni sumar importes.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[]; page?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="Vivienda: ¿qué se hizo y dónde se comprueba?"
        description="Sigue las actuaciones registradas y sus documentos; conecta con dinero y economía conservando el ámbito de cada fuente."
      />
      <ParliamentActivity
        data={await getParliamentActivity(params.year)}
        page={parsePage(params.page)}
      />
      <section className="space-y-3 text-sm leading-6">
        <h2 className="text-lg font-semibold">
          Dinero y economía del mismo tema
        </h2>
        <p>
          Estos recorridos conservan sus ejercicios y perímetros propios. El año
          de sesiones de arriba no filtra sus cifras. Una coincidencia temática
          no acredita que un contrato o una ayuda financie una iniciativa.
        </p>
        <ul className="space-y-2">
          <li><Link href="/distribucion-salarial" className="underline underline-offset-4">Ingresos: distribución salarial, media y tramos con su propio año →</Link></li>
          <li><Link href="/actividad-senado" className="underline underline-offset-4">Control en el Senado: mociones e interpelaciones por año de presentación →</Link></li>
          <li>
            <Link
              href="/gasto-por-funciones"
              className="underline underline-offset-4"
            >
              Gasto realizado: vivienda y servicios comunitarios en COFOG →
            </Link>
          </li>
          <li>
            <Link
              href="/ayudas-por-finalidad"
              className="underline underline-offset-4"
            >
              Ayudas concedidas por finalidad, con su cobertura y sin inferir
              pago →
            </Link>
          </li>
          <li>
            <Link
              href="/liquidacion-autonomica?year=2024&territory=all"
              className="underline underline-offset-4"
            >
              Qué registra tu administración autonómica en 2024 →
            </Link>
          </li>
          <li>
            <Link href="/indicadores" className="underline underline-offset-4">
              Precios y economía cotidiana: cesta del IPC y límites de las
              medias →
            </Link>
          </li>
        </ul>
        <p className="text-muted-foreground">
          COFOG vivienda no es exclusivamente acceso a la vivienda de familias.
          El IPC de vivienda incluye suministros y alquileres efectivos; no mide
          el precio de compraventa de una vivienda. Gasto, actividad
          parlamentaria y resultados son dimensiones distintas.
        </p>
      </section>
    </div>
  );
}
