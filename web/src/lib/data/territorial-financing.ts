import {supabase} from '@/lib/supabase/client'
import {unstable_cache,HOUR,dataQuerySignal,dataErrorMessage} from './shared'
import {financingSnapshot} from '@/lib/territorial-financing'
export const getTerritorialFinancing=unstable_cache(async()=>{
 try{
  const r=await supabase.from('territorial_financing_snapshot').select('metadata').eq('scope','settlement-2024').abortSignal(dataQuerySignal()).maybeSingle()
  if(r.error)throw r.error
  if(!r.data)return {data:null,error:false}
  const data=financingSnapshot(r.data.metadata)
  if(!data)throw new Error('Territorial financing coverage is inconsistent')
  return {data,error:false}
 }catch(e){console.error('Territorial financing',dataErrorMessage(e));return {data:null,error:true}}
},['territorial-financing-v1'],{revalidate:HOUR})
