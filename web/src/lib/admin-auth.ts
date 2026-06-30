import { createHash, createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

export const ADMIN_SESSION_COOKIE = "et_admin_session"

const LEGACY_ADMIN_COOKIE = "admin_token"
const SESSION_VERSION = "v1"
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000

function configuredAdminPassword() {
  const password = process.env.ADMIN_PASSWORD
  return password && password.length > 0 ? password : null
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest()
}

function safeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
}

function signSessionPayload(payload: string, password: string) {
  return createHmac("sha256", password).update(payload).digest("hex")
}

export function isAdminPasswordConfigured() {
  return configuredAdminPassword() !== null
}

export function verifyAdminPassword(input: string) {
  const password = configuredAdminPassword()
  if (!password) return false

  return timingSafeEqual(sha256(input), sha256(password))
}

export function createAdminSessionToken(now = Date.now()) {
  const password = configuredAdminPassword()
  if (!password) return null

  const payload = `${SESSION_VERSION}.${now}`
  const signature = signSessionPayload(payload, password)
  return `${payload}.${signature}`
}

export function verifyAdminSessionToken(token: string | undefined, now = Date.now()) {
  const password = configuredAdminPassword()
  if (!password || !token) return false

  const [version, issuedAtRaw, signature, extra] = token.split(".")
  if (extra !== undefined || version !== SESSION_VERSION || !issuedAtRaw || !signature) {
    return false
  }

  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt > SESSION_MAX_AGE_MS) {
    return false
  }

  return safeEqualHex(signature, signSessionPayload(`${version}.${issuedAtRaw}`, password))
}

export async function setAdminSessionCookie() {
  const token = createAdminSessionToken()
  if (!token) return false

  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === "production"

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  cookieStore.set(LEGACY_ADMIN_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  })

  return true
}

export async function isAdminRequestAuthorized() {
  const cookieStore = await cookies()
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}
