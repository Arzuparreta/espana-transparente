import { describe, expect, it } from "vitest"

import { PUBLIC_DATA_CACHE_VERSION } from "./shared"

describe("public data cache policy", () => {
  it("uses a global version to invalidate cached outage results", () => {
    expect(PUBLIC_DATA_CACHE_VERSION).toBe("public-data-v4")
  })
})
