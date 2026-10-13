import {supabase} from '@/lib/supabase/public'
import {unstable_cache,HOUR,dataQuerySignal,dataErrorMessage} from './shared'
import {localSnapshot} from '@/lib/local-liquidation'
export const getLocalLiquidation=unstable_cache(async()=>{
 try{
  const r=await supabase.from('local_liquidation_snapshot').select('metadata').eq('scope','canarias-2024').abortSignal(dataQuerySignal()).maybeSingle()
  if(r.error)throw r.error
  if(!r.data)return {data:null,error:false}
  const data=localSnapshot(r.data.metadata)
  if(!data)throw new Error('Local liquidation coverage is inconsistent')
  return {data,error:false}
 }catch(e){console.error('Local liquidation',dataErrorMessage(e));return {data:null,error:true}}
},['local-liquidation-v1'],{revalidate:HOUR})
