import { afterEach, describe, expect, it } from "vitest"

import {
  createAdminSessionToken,
  isAdminPasswordConfigured,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "./admin-auth"

const originalAdminPassword = process.env.ADMIN_PASSWORD

afterEach(() => {
  process.env.ADMIN_PASSWORD = originalAdminPassword
})

describe("admin auth", () => {
  it("requires ADMIN_PASSWORD", () => {
    delete process.env.ADMIN_PASSWORD

    expect(isAdminPasswordConfigured()).toBe(false)
    expect(verifyAdminPassword("anything")).toBe(false)
    expect(createAdminSessionToken()).toBeNull()
  })

  it("verifies the configured password without storing it in the session cookie", () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple"

    expect(verifyAdminPassword("wrong")).toBe(false)
    expect(verifyAdminPassword("correct horse battery staple")).toBe(true)

    const token = createAdminSessionToken(1_000)
    expect(token).not.toContain(process.env.ADMIN_PASSWORD)
    expect(verifyAdminSessionToken(token ?? undefined, 1_000)).toBe(true)
  })

  it("rejects forged, expired, and future-dated sessions", () => {
    process.env.ADMIN_PASSWORD = "admin-password"

    const token = createAdminSessionToken(1_000)
    expect(verifyAdminSessionToken(`${token}x`, 1_000)).toBe(false)
    expect(verifyAdminSessionToken(token ?? undefined, 31 * 24 * 60 * 60 * 1000)).toBe(false)
    expect(verifyAdminSessionToken(createAdminSessionToken(10_000) ?? undefined, 1_000)).toBe(false)
  })
})
