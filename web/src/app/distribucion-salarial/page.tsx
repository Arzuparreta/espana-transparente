import { PageHeader } from '@/components/domain/PageHeader'
import { WageDistribution } from '@/components/domain/WageDistribution'
import { getWageDistribution } from '@/lib/data/wage-distribution'
export const revalidate=3600
export const metadata={title:'Distribución salarial: media y tramos',description:'Salario bruto mensual del empleo principal: media y distribución EPA, con año, población y límites.'}
export default async function Page({searchParams}:{searchParams:Promise<{year?:string|string[]}>}){
  const params=await searchParams
  return <div className="ui-page space-y-6"><PageHeader title="¿Qué oculta el salario medio?" description="Compara la media con los tramos salariales de las personas asalariadas, conservando año y población de referencia."/><WageDistribution result={await getWageDistribution()} year={params.year}/></div>
}
