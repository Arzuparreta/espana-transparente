import {supabase} from "@/lib/supabase/client"
import {unstable_cache,HOUR,dataErrorMessage,dataQuerySignal} from "./shared"
import {pacSnapshot} from "@/lib/pac-payments"
export const getPacPayments=unstable_cache(async()=>{
 try{
  const {data,error}=await supabase.from("pac_payment_snapshot").select("metadata").eq("scope","financial-2025").abortSignal(dataQuerySignal()).maybeSingle()
  if(error)throw error
  if(!data)return {snapshot:null,error:false}
  const snapshot=pacSnapshot(data.metadata);if(!snapshot)throw new Error("Invalid consolidated PAC edition")
  return {snapshot,error:false}
 }catch(error){console.error("PAC payments",dataErrorMessage(error));return {snapshot:null,error:true}}
},["pac-payments-2025-v1"],{revalidate:HOUR})
