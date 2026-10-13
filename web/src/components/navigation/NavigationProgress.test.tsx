import { beforeEach, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
const mock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), props: {} as Record<string, unknown> }))
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useEffect: (fn: () => unknown) => fn(),
  useTransition: () => [false, (fn: () => void) => fn()],
}))
vi.mock("next/navigation", () => ({ useRouter: () => mock }))
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => { mock.props = props; return null } }))
import { NavigationProgress, ResponsiveLink } from "./NavigationProgress"
beforeEach(() => { vi.clearAllMocks(); renderToStaticMarkup(<NavigationProgress />) })
function navigate() {
  const preventDefault = vi.fn()
  ;(mock.props.onNavigate as (event: { preventDefault: () => void }) => void)({ preventDefault })
  return preventDefault
}
it("uses automatic partial prefetch and tracks query-only navigation in the router transition", () => {
  vi.stubGlobal("window", { location: { href: "https://example.com/contratos", pathname: "/contratos", search: "" } })
  renderToStaticMarkup(<ResponsiveLink href="/contratos?page=2" scroll={false}>Siguiente</ResponsiveLink>)
  expect(mock.props.prefetch).toBeNull()
  expect(navigate()).toHaveBeenCalledOnce()
  expect(mock.push).toHaveBeenCalledWith("/contratos?page=2", { scroll: false })
  vi.unstubAllGlobals()
})
it("preserves a caller's navigation veto", () => {
  renderToStaticMarkup(<ResponsiveLink href="/economia" onNavigate={(event) => event.preventDefault()}>Economía</ResponsiveLink>)
  expect(navigate()).toHaveBeenCalledOnce()
  expect(mock.push).not.toHaveBeenCalled()
})
it("leaves fragment-only and same-URL navigation to Link", () => {
  vi.stubGlobal("window", { location: { href: "https://example.com/contratos", pathname: "/contratos", search: "" } })
  renderToStaticMarkup(<ResponsiveLink href="/contratos#fuente">Fuente</ResponsiveLink>)
  expect(navigate()).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
