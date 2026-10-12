import {PageHeader} from '@/components/domain/PageHeader'
import {HousingPrices} from '@/components/domain/HousingPrices'
import {getHousingPrices} from '@/lib/data/housing-prices'
export const revalidate=3600
export const metadata={title:'Precios de vivienda: evolución de compraventa',description:'Variación anual y trimestral de los precios de compraventa IPV, con territorio, periodo y límites.'}
export default async function Page({searchParams}:{searchParams:Promise<{period?:string|string[];territory?:string|string[]}>}){
 const p=await searchParams
 return <div className="ui-page space-y-6"><PageHeader title="¿Cuánto cambia el precio de comprar vivienda?" description="Compara la evolución de compraventa en tu territorio con la fuente oficial, conservando sus periodos y límites."/><HousingPrices result={await getHousingPrices()} period={p.period} territory={p.territory}/></div>
}
