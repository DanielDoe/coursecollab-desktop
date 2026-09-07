import { cpSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const destDir = join(root, "dist-electron", "setup")
mkdirSync(destDir, { recursive: true })
cpSync(join(root, "electron", "setup"), destDir, { recursive: true })
