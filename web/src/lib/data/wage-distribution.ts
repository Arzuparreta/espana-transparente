import { supabase } from '@/lib/supabase/public'
import { unstable_cache,HOUR,dataQuerySignal,dataErrorMessage } from './shared'
import { wageSnapshot } from '@/lib/wage-distribution'
export const getWageDistribution=unstable_cache(async()=>{
  try {
    const result=await supabase.from('wage_distribution_snapshot').select('metadata').eq('scope','epa-national').abortSignal(dataQuerySignal()).maybeSingle()
    if(result.error) throw result.error
    if(!result.data) return {data:null,error:false}
    const data=wageSnapshot(result.data.metadata)
    if(!data) throw new Error('Wage distribution snapshot is inconsistent')
    return {data,error:false}
  } catch(error){ console.error('Wage distribution',dataErrorMessage(error));return {data:null,error:true} }
},['wage-distribution-v1'],{revalidate:HOUR})
