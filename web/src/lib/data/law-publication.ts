import {supabase} from '@/lib/supabase/client'
import {unstable_cache,HOUR,dataQuerySignal,dataErrorMessage} from './shared'
import {lawSnapshot,publishedBill} from '@/lib/law-publication'
export const getLawPublication=unstable_cache(async(number:string,legislatureId:string)=>{
 try{
  const [snapshot,legislature]=await Promise.all([
   supabase.from('law_publication_snapshot').select('metadata').eq('scope','congress-xv-bills').abortSignal(dataQuerySignal()).maybeSingle(),
   supabase.from('legislatures').select('number').eq('id',legislatureId).abortSignal(dataQuerySignal()).maybeSingle(),
  ])
  if(snapshot.error)throw snapshot.error
  if(legislature.error)throw legislature.error
  if(!legislature.data)throw new Error('Initiative legislature is missing')
  if(!snapshot.data)return {bill:null,checkedAt:null,error:false}
  const s=lawSnapshot(snapshot.data.metadata)
  if(!s)throw new Error('Law publication snapshot is inconsistent')
  return {bill:publishedBill(s,number,Number(legislature.data.number)),checkedAt:s.retrieved_at,error:false}
 }catch(e){console.error('Law publication',dataErrorMessage(e));return {bill:null,checkedAt:null,error:true}}
},['law-publication-v1'],{revalidate:HOUR})
