#!/usr/bin/env node
/** Merge win x64 + arm64 NSIS artifacts into latest.yml for electron-updater. */

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

function findExe(version, arch) {
  const suffix = arch === "x64" ? "win-x64.exe" : "win-arm64.exe"
  const direct = path.join(RELEASE_DIR, `CourseCollab-${version}-${suffix}`)
  if (fs.existsSync(direct)) return direct
  const alt = path.join(RELEASE_DIR, `CourseCollab-${version}-win-${arch}.exe`)
  if (fs.existsSync(alt)) return alt
  return null
}

function main() {
  const version = readVersion()
  const x64 = findExe(version, "x64")
  const arm64 = findExe(version, "arm64")
  const paths = [x64, arm64].filter(Boolean)
  if (!paths.length) {
    throw new Error(
      `No Windows installers for ${version} in release/. Run npm run build:desktop:win (and arm64 if needed).`,
    )
  }

  const files = paths.map((filePath) => ({
    url: path.basename(filePath),
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

  fs.writeFileSync(path.join(RELEASE_DIR, "latest.yml"), yaml, "utf8")
  console.log(`Wrote latest.yml (${files.length} Windows installer(s))`)
}

main()
