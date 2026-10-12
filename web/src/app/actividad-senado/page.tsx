import { PageHeader } from "@/components/domain/PageHeader";
import { SenateControl } from "@/components/domain/SenateControl";
import { getSenateControl } from "@/lib/data/senate-control";
import { parsePage } from "@/lib/data";
export const revalidate = 3600;
export const metadata = {
  title: "Senado: vivienda y control parlamentario",
  description:
    "Mociones e interpelaciones, autores, trámites, sesiones e intervinientes con sus documentos oficiales y cobertura.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[]; page?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="Senado: ¿qué iniciativas de vivienda constan?"
        description="Propuestas de actuación y control, con autores, personas que intervinieron y documentos oficiales."
      />
      <SenateControl
        result={await getSenateControl()}
        year={p.year}
        page={parsePage(p.page)}
      />
    </div>
  );
}
