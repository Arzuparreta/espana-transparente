#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL")
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY")
const SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY")
const APP_URL = process.env.AUTH_SMOKE_APP_URL ?? "https://xn--espaatransparente-ixb.site"
const EMAIL_DOMAIN = process.env.AUTH_SMOKE_EMAIL_DOMAIN ?? "gmail.com"
const RUN_BROWSER = process.argv.includes("--browser")
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0]

const email = `auth-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}@${EMAIL_DOMAIN}`
const password = `AuthSmoke-${Date.now()}!`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

try {
  await deleteUsersByEmail(email)
  if (RUN_BROWSER) {
    await runBrowserSmoke()
  } else {
    await runApiSmoke()
  }
  console.log("Auth smoke OK")
} finally {
  await deleteUsersByEmail(email)
}

async function runApiSmoke() {
  const storage = createMemoryStorage()
  const client = createPublicClient(storage)

  const {
    data: { session, user },
    error: signUpError,
  } = await client.auth.signUp({ email, password })

  if (signUpError) throw new Error(`signUp failed: ${signUpError.message}`)
  if (!session || !user) {
    throw new Error("signUp did not return a session. Email confirmation is probably enabled remotely.")
  }

  await assertProfileRows(client, user.id)

  const reopenedClient = createPublicClient(createMemoryStorage(storage.dump()))
  const {
    data: { session: reopenedSession },
    error: reopenedError,
  } = await reopenedClient.auth.getSession()
  if (reopenedError) throw new Error(`getSession after reopen failed: ${reopenedError.message}`)
  if (!reopenedSession?.user?.id) throw new Error("Persisted session was not restored after reopening client context")

  await client.auth.signOut()

  const {
    data: { session: loginSession },
    error: loginError,
  } = await client.auth.signInWithPassword({ email, password })
  if (loginError) throw new Error(`signInWithPassword failed: ${loginError.message}`)
  if (!loginSession?.user?.id) throw new Error("signInWithPassword did not return a session")
}

async function runBrowserSmoke() {
  const { chromium } = await import("playwright")
  const browser = await chromium.launch({ headless: process.env.AUTH_SMOKE_HEADLESS !== "false" })
  let context = await browser.newContext()
  let page = await context.newPage()

  try {
    await page.goto(`${APP_URL}/perfil`, { waitUntil: "networkidle" })
    await page.getByTestId("profile-login-open").click()
    await page.getByTestId("auth-switch-signup").click()
    await page.getByTestId("auth-email").fill(email)
    await page.getByTestId("auth-password").fill(password)
    await page.getByTestId("auth-submit").click()

    await page.waitForFunction(() => !document.querySelector("[data-testid='auth-submit']"), null, {
      timeout: 15000,
    })

    await page.goto(`${APP_URL}/perfil`, { waitUntil: "networkidle" })
    await page.getByTestId("profile-editor").waitFor({ timeout: 15000 })

    const state = await context.storageState()
    await context.close()

    context = await browser.newContext({ storageState: state })
    page = await context.newPage()
    await page.goto(`${APP_URL}/perfil`, { waitUntil: "networkidle" })
    await page.getByTestId("profile-editor").waitFor({ timeout: 15000 })
  } catch (error) {
    const modalText = await page.locator("[role='dialog']").textContent().catch(() => "")
    throw new Error(`${error.message}${modalText ? `\nDialog: ${modalText}` : ""}`)
  } finally {
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

async function assertProfileRows(client, userId) {
  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()
  if (profileError) throw new Error(`user_profiles check failed: ${profileError.message}`)
  if (!profile?.id) throw new Error("Profile trigger did not create user_profiles row")

  const { data: settings, error: settingsError } = await client
    .from("user_profile_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (settingsError) throw new Error(`user_profile_settings check failed: ${settingsError.message}`)
  if (!settings?.user_id) throw new Error("Profile trigger did not create user_profile_settings row")
}

function createPublicClient(storage) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage,
      storageKey: `sb-${PROJECT_REF}-auth-token`,
    },
  })
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
    dump() {
      return Object.fromEntries(values.entries())
    },
  }
}

async function deleteUsersByEmail(targetEmail) {
  let page = 1
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed during cleanup: ${error.message}`)

    for (const user of data.users) {
      if (user.email === targetEmail) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
        if (deleteError) throw new Error(`deleteUser failed during cleanup: ${deleteError.message}`)
      }
    }

    if (data.users.length < 1000) return
    page += 1
  }
}

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
