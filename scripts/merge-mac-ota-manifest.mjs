#!/usr/bin/env node
/**
 * Merge arm64 + x64 mac zip artifacts into a single latest-mac.yml for electron-updater.
 * Run after separate `build:desktop:mac` and `build:desktop:mac:x64` when needed.
 */

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const RELEASE_DIR = path.join(ROOT, "release")

function readVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version
}

function sha512Base64(filePath) {
  const hash = crypto.createHash("sha512")
  hash.update(fs.readFileSync(filePath))
  return hash.digest("base64")
}

function readReleaseNotes() {
  const notesPath = path.join(ROOT, "scripts/desktop-ota-release-notes.txt")
  if (!fs.existsSync(notesPath)) return ""
  return fs.readFileSync(notesPath, "utf8").trimEnd()
}

function main() {
  const version = readVersion()
  const armZip = path.join(RELEASE_DIR, `CourseCollab-${version}-mac-arm64.zip`)
  const x64Zip = path.join(RELEASE_DIR, `CourseCollab-${version}-mac-x64.zip`)
  const missing = [armZip, x64Zip].filter((p) => !fs.existsSync(p))
  if (missing.length) {
    throw new Error(
      `Missing mac zip(s): ${missing.map((p) => path.basename(p)).join(", ")}. Build both architectures first.`,
    )
  }

  const files = [
    { url: path.basename(armZip), path: armZip },
    { url: path.basename(x64Zip), path: x64Zip },
  ].map(({ url, path: filePath }) => ({
    url,
    sha512: sha512Base64(filePath),
    size: fs.statSync(filePath).size,
  }))

  const notes = readReleaseNotes()
  const releaseNotesBlock = notes
    ? `releaseNotes: |\n${notes
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}\n`
    : ""

  const primary = files[0]
  const yaml = `version: ${version}
files:
${files
  .map(
    (f) => `  - url: ${f.url}
    sha512: ${f.sha512}
    size: ${f.size}`,
  )
  .join("\n")}
path: ${primary.url}
sha512: ${primary.sha512}
${releaseNotesBlock}releaseDate: '${new Date().toISOString()}'
`

  const outPath = path.join(RELEASE_DIR, "latest-mac.yml")
  fs.writeFileSync(outPath, yaml, "utf8")
  console.log(`Wrote ${outPath} (${files.length} architectures)`)
}

main()
