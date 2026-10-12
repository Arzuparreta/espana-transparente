import {PageHeader} from '@/components/domain/PageHeader'
import {LocalLiquidation} from '@/components/chain/LocalLiquidation'
import {getLocalLiquidation} from '@/lib/data/local-liquidation'
export const revalidate=3600
export const metadata={title:'¿Qué autorizó, reconoció y pagó tu ayuntamiento?',description:'Piloto de liquidación municipal consolidada de Canarias en 2024, con fases y valores no disponibles.'}
export default async function Page({searchParams}:{searchParams:Promise<{year?:string|string[];municipality?:string|string[]}>}){
 const p=await searchParams
 return <div className="ui-page space-y-6"><PageHeader title="¿Qué autorizó, reconoció y pagó tu ayuntamiento?" description="Compara las fases del presupuesto municipal. Primer piloto: Canarias, ejercicio 2024."/><LocalLiquidation result={await getLocalLiquidation()} year={p.year} municipality={p.municipality}/></div>
}
