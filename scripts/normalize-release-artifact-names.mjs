#!/usr/bin/env node
/**
 * electron-builder mangles 4-part semver in artifact names
 * (0.1.18.1 → CourseCollab-0.1.1-8.1-win-x64.exe). Rename only those blobs.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const RELEASE = path.join(ROOT, "release")

const version = String(
  JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version ?? "",
).trim()
if (!version) {
  console.error("package.json version missing")
  process.exit(1)
}

const mangledPrefix = `CourseCollab-0.1.1-8.1-`
const canonicalPrefix = `CourseCollab-${version}-`

if (!fs.existsSync(RELEASE)) {
  console.error(`Missing ${RELEASE}`)
  process.exit(1)
}

let renamed = 0
for (const name of fs.readdirSync(RELEASE)) {
  if (!name.startsWith(mangledPrefix)) continue
  const target = canonicalPrefix + name.slice(mangledPrefix.length)
  const from = path.join(RELEASE, name)
  const to = path.join(RELEASE, target)
  if (fs.existsSync(to)) fs.unlinkSync(to)
  fs.renameSync(from, to)
  console.log(`${name} → ${target}`)
  renamed++
}

const linuxX64AppImage = path.join(RELEASE, `CourseCollab-${version}-linux-x64.AppImage`)
const linuxX86AppImage = path.join(RELEASE, `CourseCollab-${version}-linux-x86_64.AppImage`)
if (fs.existsSync(linuxX64AppImage) && !fs.existsSync(linuxX86AppImage)) {
  fs.renameSync(linuxX64AppImage, linuxX86AppImage)
  console.log(`CourseCollab-${version}-linux-x64.AppImage → CourseCollab-${version}-linux-x86_64.AppImage`)
  renamed++
}

console.log(renamed ? `Normalized ${renamed} file(s) to ${version}.` : `No mangled ${mangledPrefix} artifacts.`)
