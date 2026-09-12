#!/usr/bin/env node
/**
 * Load local .env (APPLE_* notarization secrets, etc.) then run electron-builder.
 * Usage: node scripts/run-electron-builder.mjs --mac --publish never
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = join(root, ".env")

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const args = process.argv.slice(2)
const buildingMac =
  args.includes("--mac") ||
  (!args.includes("--win") && !args.includes("--linux") && process.platform === "darwin")

if (buildingMac) {
  const hasApiKey =
    Boolean(process.env.APPLE_API_KEY?.trim()) &&
    Boolean(process.env.APPLE_API_KEY_ID?.trim()) &&
    Boolean(process.env.APPLE_API_ISSUER?.trim())
  const hasAppleId =
    Boolean(process.env.APPLE_ID?.trim()) &&
    Boolean(process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim()) &&
    Boolean(process.env.APPLE_TEAM_ID?.trim())
  if (!hasApiKey && !hasAppleId) {
    console.error(
      "macOS notarization requires APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER " +
        "(or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID) in .env — see .env.example",
    )
    process.exit(1)
  }
  if (!process.env.APPLE_TEAM_ID?.trim()) {
    process.env.APPLE_TEAM_ID = "5S94RUARQ4"
  }
  console.log(
    hasApiKey
      ? "Notarization: App Store Connect API key"
      : "Notarization: Apple ID + app-specific password",
  )
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron-builder", ...args],
  { cwd: root, env: process.env, stdio: "inherit" },
)
process.exit(result.status ?? 1)
