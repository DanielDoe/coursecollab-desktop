#!/usr/bin/env node
/**
 * Upload electron-builder OTA artifacts to the public Vercel Blob feed.
 *
 * Prerequisites:
 *   1. npm run build:desktop:mac   (or build:desktop:win / build:desktop:all)
 *   2. BLOB_READ_WRITE_TOKEN in .env.local (same token as production uploads)
 *
 * Usage:
 *   npm run publish:desktop-ota
 *   npm run publish:desktop-ota -- --dry-run
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { put } from "@vercel/blob"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const RELEASE_DIR = path.join(ROOT, "release")

const DEFAULT_PREFIX = "public/downloads/desktop/updates"
const DEFAULT_FEED_BASE =
  "https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/updates"

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(ROOT, name)
    if (!fs.existsSync(filePath)) continue
    const text = fs.readFileSync(filePath, "utf8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value
      }
    }
  }
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
  return String(pkg.version ?? "").trim()
}

function contentType(fileName) {
  if (fileName.endsWith(".yml")) return "text/yaml; charset=utf-8"
  if (fileName.endsWith(".zip")) return "application/zip"
  if (fileName.endsWith(".exe")) return "application/vnd.microsoft.portable-executable"
  if (fileName.endsWith(".blockmap")) return "application/octet-stream"
  return "application/octet-stream"
}

/** Files electron-updater generic provider expects beside latest*.yml manifests. */
function collectOtaUploadFiles(version) {
  if (!fs.existsSync(RELEASE_DIR)) {
    throw new Error(`Missing release folder: ${RELEASE_DIR}. Run npm run build:desktop:mac first.`)
  }

  const names = fs.readdirSync(RELEASE_DIR)
  const manifestCandidates = names.filter((n) =>
    /^latest(-mac|-mac-arm64|-linux|-win)?\.yml$/i.test(n),
  )
  const manifests = manifestCandidates.filter((n) => {
    const text = fs.readFileSync(path.join(RELEASE_DIR, n), "utf8")
    const match = text.match(/^version:\s*([^\s#]+)/m)
    if (!match) {
      console.warn(`Skipping ${n}: no version field`)
      return false
    }
    if (match[1].trim() !== version) {
      console.warn(`Skipping stale manifest ${n} (version ${match[1].trim()}, expected ${version})`)
      return false
    }
    return true
  })
  const binaries = names.filter((n) => {
    if (!n.startsWith(`CourseCollab-${version}-`)) return false
    if (n.endsWith(".blockmap")) return false
    // Fat dual-arch NSIS is not used by electron-updater; arch-specific .exe are.
    if (/^CourseCollab-.+-win\.exe$/i.test(n)) return false
    return /\.(zip|exe)$/i.test(n)
  })

  const files = [...new Set([...manifests, ...binaries])].sort()
  if (!manifests.length) {
    throw new Error(
      `No latest*.yml manifests in release/. Build with electron-builder before publishing.`,
    )
  }
  if (!binaries.length) {
    throw new Error(
      `No CourseCollab-${version}-*.zip/.exe in release/. Version in package.json must match built artifacts.`,
    )
  }
  return files.map((name) => ({
    name,
    absolutePath: path.join(RELEASE_DIR, name),
  }))
}

async function main() {
  loadEnvFiles()
  const dryRun = process.argv.includes("--dry-run")
  const version = readVersion()
  const prefix = (process.env.DESKTOP_OTA_BLOB_PREFIX || DEFAULT_PREFIX).replace(/\/+$/, "")
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()

  if (!dryRun && !token) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is required. Add it to .env.local (Vercel Blob read/write token).",
    )
    process.exit(1)
  }

  const uploads = collectOtaUploadFiles(version)
  console.log(`CourseCollab OTA publish v${version}`)
  console.log(`Blob prefix: ${prefix}`)
  console.log(`Feed URL:    ${process.env.DESKTOP_UPDATE_FEED_URL?.trim() || DEFAULT_FEED_BASE}`)
  console.log(`Files (${uploads.length}):`)
  for (const item of uploads) {
    const stat = fs.statSync(item.absolutePath)
    console.log(`  - ${item.name} (${(stat.size / (1024 * 1024)).toFixed(1)} MiB)`)
  }

  if (dryRun) {
    console.log("\nDry run — no uploads performed.")
    return
  }

  for (const item of uploads) {
    const bytes = fs.readFileSync(item.absolutePath)
    const blobKey = `${prefix}/${item.name}`
    process.stdout.write(`Uploading ${item.name}… `)
    const result = await put(blobKey, bytes, {
      access: "public",
      token,
      contentType: contentType(item.name),
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log("ok")
    console.log(`  ${result.url}`)
  }

  console.log("\nOTA feed updated. Packaged apps will see the new version on the next update check.")
  console.log("Verify: curl -sS \\")
  console.log(
    `  "${(process.env.DESKTOP_UPDATE_FEED_URL || DEFAULT_FEED_BASE).replace(/\/+$/, "")}/latest-mac.yml" | head`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
