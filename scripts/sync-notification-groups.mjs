#!/usr/bin/env node
/**
 * Generate electron/notification-groups.ts from lib/desktop-notification-groups.ts.
 *
 * The main process cannot import from lib/ (tsconfig.electron.json roots at
 * electron/), so the module used to be hand-copied — and drifted: the renderer
 * grew six type labels the main process never got, so the same notification was
 * labelled differently depending on whether it arrived through the renderer or
 * through background sync. Copying at build time keeps the two identical.
 *
 * The source module is intentionally dependency-free so a plain copy compiles.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'lib/desktop-notification-groups.ts')
const TARGET = join(root, 'electron/notification-groups.ts')

const source = readFileSync(SOURCE, 'utf8')

if (/^\s*import\s/m.test(source)) {
  console.error(
    '[sync-notification-groups] lib/desktop-notification-groups.ts gained an import; ' +
      'the main process copy cannot resolve it. Keep that module dependency-free.',
  )
  process.exit(1)
}

const banner = `// GENERATED FILE — DO NOT EDIT.
// Source: lib/desktop-notification-groups.ts
// Regenerate: node scripts/sync-notification-groups.mjs
`

const next = `${banner}\n${source}`

let current = ''
try {
  current = readFileSync(TARGET, 'utf8')
} catch {
  /* first run */
}

if (current === next) {
  console.log('[sync-notification-groups] electron/notification-groups.ts already up to date')
} else {
  writeFileSync(TARGET, next, 'utf8')
  console.log('[sync-notification-groups] wrote electron/notification-groups.ts')
}
