import {PageHeader} from '@/components/domain/PageHeader'
import {TerritorialFinancing} from '@/components/chain/TerritorialFinancing'
import {getTerritorialFinancing} from '@/lib/data/territorial-financing'
export const revalidate=3600
export const metadata={title:'¿Qué ajuste de financiación corresponde a tu administración?',description:'Liquidación del sistema de financiación de 2024: saldos, entregas a cuenta y límites por territorio.'}
export default async function Page({searchParams}:{searchParams:Promise<{year?:string|string[];territory?:string|string[]}>}){
 const p=await searchParams
 return <div className="ui-page space-y-6"><PageHeader title="¿Qué ajuste de financiación corresponde a tu administración?" description="Sigue el saldo de liquidación y distingue recursos anuales, ajustes y pagos."/><TerritorialFinancing result={await getTerritorialFinancing()} year={p.year} territory={p.territory}/></div>
}
