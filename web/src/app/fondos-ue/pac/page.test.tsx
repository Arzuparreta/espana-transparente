import {expect,it,vi} from "vitest"
import {renderToStaticMarkup} from "react-dom/server"
import fixture from "@/lib/pac-payment-fixture.json"
import {pacSnapshot} from "@/lib/pac-payments"
const mock=vi.hoisted(()=>({result:{} as unknown}))
vi.mock("@/lib/data/pac-payments",()=>({getPacPayments:async()=>mock.result}))
vi.mock("next/link",()=>({default:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}))
vi.mock("@/components/navigation/NavigationProgress",()=>({ResponsiveLink:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}))
import Page from "./page"
it("explains payments, exercise, denominators and campaign comparability",async()=>{
 mock.result={snapshot:pacSnapshot(fixture),error:false}
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({fund:"feaga"})}))
 for(const text of ["16 de octubre de 2024","15 de octubre de 2025","5.719.032.075,75","cambio de clasificación","No se suman recuentos","name=\"year\"","name=\"fund\"","name=\"body\""])expect(html).toContain(text)
 expect(html).toContain("#page=8")
})
it("retains national versus regional scope and published correction notes",async()=>{
 mock.result={snapshot:pacSnapshot(fixture),error:false}
 const national=renderToStaticMarkup(await Page({searchParams:Promise.resolve({fund:"feader-2023-2027"})}))
 expect(national).toContain("gasto público cero")
 const regional=renderToStaticMarkup(await Page({searchParams:Promise.resolve({fund:"feader-2014-2022",body:"01"})}))
 expect(regional).toContain("ANDALUCÍA")
 expect(regional).toContain("467.908.857,19")
 expect(regional).toContain("El desglose de ayudas disponible es nacional")
 expect(regional).not.toContain("01 - Transferencia")
})
it("keeps query failure, absent edition and invalid URL distinct",async()=>{
 mock.result={snapshot:null,error:true};expect(renderToStaticMarkup(await Page({}))).toContain('role="alert"')
 mock.result={snapshot:null,error:false};expect(renderToStaticMarkup(await Page({}))).toContain("Todavía no hay")
 mock.result={snapshot:pacSnapshot(fixture),error:false};expect(renderToStaticMarkup(await Page({searchParams:Promise.resolve({year:"2024"})}))).toContain("No se sustituye")
})
