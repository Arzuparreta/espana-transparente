import {supabase} from '@/lib/supabase/client'
import {unstable_cache,HOUR,dataQuerySignal,dataErrorMessage} from './shared'
import {housingSnapshot} from '@/lib/housing-prices'
export const getHousingPrices=unstable_cache(async()=>{
 try{
  const r=await supabase.from('housing_price_snapshot').select('metadata').eq('scope','ipv-national-regions').abortSignal(dataQuerySignal()).maybeSingle()
  if(r.error)throw r.error
  if(!r.data)return {data:null,error:false}
  const data=housingSnapshot(r.data.metadata)
  if(!data)throw new Error('Housing price coverage is inconsistent')
  return {data,error:false}
 }catch(e){console.error('Housing prices',dataErrorMessage(e));return {data:null,error:true}}
},['housing-prices-v1'],{revalidate:HOUR})
