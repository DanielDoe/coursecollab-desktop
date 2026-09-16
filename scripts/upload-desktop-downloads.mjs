#!/usr/bin/env node
/**
 * Upload full installers (DMG, EXE, AppImage) to Vercel Blob for the landing page.
 *
 * Prerequisites: npm run build:desktop:mac (and win/linux as needed)
 * Usage: node scripts/upload-desktop-downloads.mjs [--dry-run]
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { put } from "@vercel/blob"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const RELEASE_DIR = path.join(ROOT, "release")

const BLOB_HOST =
  process.env.DESKTOP_DOWNLOAD_BLOB_HOST ||
  "https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com"

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
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version.trim()
}

function contentType(name) {
  if (name.endsWith(".dmg")) return "application/x-apple-diskimage"
  if (name.endsWith(".exe")) return "application/vnd.microsoft.portable-executable"
  if (name.endsWith(".AppImage")) return "application/x-executable"
  return "application/octet-stream"
}

function collectInstallerFiles(version) {
  if (!fs.existsSync(RELEASE_DIR)) {
    throw new Error(`Missing ${RELEASE_DIR}. Run electron-builder first.`)
  }
  const names = fs.readdirSync(RELEASE_DIR)
  const installers = names.filter((n) => {
    if (!n.startsWith(`CourseCollab-${version}-`)) return false
    return /\.(dmg|exe|AppImage)$/i.test(n)
  })
  if (!installers.length) {
    throw new Error(`No CourseCollab-${version}-* installers in release/`)
  }
  return installers.sort()
}

async function main() {
  loadEnvFiles()
  const dryRun = process.argv.includes("--dry-run")
  const version = readVersion()
  const prefix = `public/downloads/desktop/v${version}`
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()

  if (!dryRun && !token) {
    console.error("BLOB_READ_WRITE_TOKEN required in .env.local")
    process.exit(1)
  }

  const files = collectInstallerFiles(version)
  console.log(`Upload installers v${version} → ${prefix}/`)
  for (const name of files) {
    const stat = fs.statSync(path.join(RELEASE_DIR, name))
    console.log(`  ${name} (${(stat.size / (1024 * 1024)).toFixed(1)} MiB)`)
  }

  if (dryRun) return

  for (const name of files) {
    const bytes = fs.readFileSync(path.join(RELEASE_DIR, name))
    const blobKey = `${prefix}/${name}`
    process.stdout.write(`Uploading ${name}… `)
    const result = await put(blobKey, bytes, {
      access: "public",
      token,
      contentType: contentType(name),
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log("ok")
    console.log(`  ${result.url}`)
  }

  console.log("\nPublic URLs (update lib/desktop-downloads.ts if needed):")
  for (const name of files) {
    console.log(`  ${BLOB_HOST}/${prefix}/${name}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
