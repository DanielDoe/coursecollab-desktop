#!/usr/bin/env node
/**
 * Copy CourseCollab web app into this desktop repo (read-only from v0-coursecollabv3).
 *
 * Usage: npm run sync:web
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = resolve(
  process.env.COURSECOLLAB_WEB_ROOT || join(desktopRoot, '../v0-coursecollabv3'),
)

const NEVER_TOUCH = [
  'electron',
  'build',
  'node_modules',
  '.git',
  '.next',
  'scripts',
  'release',
  'dist-electron',
  'dist',
  'src',
  'index.html',
  'vite.config.ts',
  'tsconfig.app.json',
]

const DESKTOP_SCRIPTS = {
  'sync:web': 'node scripts/sync-from-web-app.mjs',
  'predev:electron': 'node scripts/kill-desktop-electron.mjs',
  'dev:electron': 'tsc -p tsconfig.electron.json && electron .',
  'dev:vite': 'vite --host 127.0.0.1',
  'dev:api': 'node --max-old-space-size=4096 node_modules/next/dist/bin/next dev -p 3000',
  'dev:desktop': 'concurrently -k "npm run dev:vite" "wait-on http://127.0.0.1:5173 && npm run dev:electron"',
  'build:renderer': 'vite build',
  'build:desktop': 'vite build && tsc -p tsconfig.electron.json && electron-builder',
  'typecheck:renderer': 'tsc -p tsconfig.app.json --noEmit',
}

const DIR_COPIES = [
  { from: 'app', to: 'app' },
  { from: 'components', to: 'components' },
  { from: 'lib', to: 'lib' },
  { from: 'hooks', to: 'hooks' },
  { from: 'styles', to: 'styles' },
  { from: 'context', to: 'context' },
  { from: 'data', to: 'data' },
]

const FILE_COPIES = [
  { from: 'middleware.ts', to: 'middleware.ts' },
  { from: 'instrumentation.ts', to: 'instrumentation.ts' },
  { from: 'next.config.mjs', to: 'next.config.mjs' },
  { from: 'components.json', to: 'components.json' },
  { from: 'postcss.config.mjs', to: 'postcss.config.mjs' },
  { from: 'tsconfig.json', to: 'tsconfig.json' },
  { from: 'next-env.d.ts', to: 'next-env.d.ts' },
]

const PUBLIC_COPIES = [
  'public/brand',
  'public/fonts',
  'public/assets',
  'public/universities',
  'public/images',
  'public/apple-icon.png',
  'public/icon.png',
  'public/favicon.ico',
]

function syncDir(from, to) {
  const source = join(webRoot, from)
  const target = join(desktopRoot, to)
  if (!existsSync(source)) {
    console.warn(`skip missing directory ${from}`)
    return
  }
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
  console.log(`synced ${from}/ -> ${to}/`)
}

function syncFile(from, to, { recursive = false } = {}) {
  const source = join(webRoot, from)
  const target = join(desktopRoot, to)
  if (!existsSync(source)) {
    console.warn(`skip missing ${from}`)
    return
  }
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, recursive ? { recursive: true } : undefined)
  console.log(`synced ${from} -> ${to}`)
}

function mergePackageJson() {
  const source = join(webRoot, 'package.json')
  if (!existsSync(source)) return
  const webPkg = JSON.parse(readFileSync(source, 'utf8'))
  const desktopPkgPath = join(desktopRoot, 'package.json')
  const existing = existsSync(desktopPkgPath)
    ? JSON.parse(readFileSync(desktopPkgPath, 'utf8'))
    : {}

  const merged = {
    ...webPkg,
    name: 'coursecollab-desktop',
    description: 'CourseCollab desktop app (ported from v0-coursecollabv3)',
    private: true,
    main: 'dist-electron/main.js',
    scripts: {
      ...webPkg.scripts,
      ...DESKTOP_SCRIPTS,
    },
    build: existing.build ?? {
      appId: 'com.coursecollab.desktop',
      productName: 'CourseCollab',
      directories: { output: 'release' },
      files: ['dist/**/*', 'dist-electron/**/*', 'public/**/*', 'package.json'],
      mac: { icon: 'build/icon.png', target: ['dmg', 'zip'] },
      win: { icon: 'build/icon.png', target: ['nsis', 'zip'] },
    },
  }

  delete merged.scripts.postinstall

  writeFileSync(desktopPkgPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  console.log('merged package.json (web deps + desktop electron scripts)')
}

if (!existsSync(webRoot)) {
  console.error(`Web app not found at ${webRoot}`)
  process.exit(1)
}

console.log(`Syncing from ${webRoot} -> ${desktopRoot}\n`)

for (const { from, to } of DIR_COPIES) {
  if (NEVER_TOUCH.includes(to)) continue
  syncDir(from, to)
}

for (const { from, to } of FILE_COPIES) syncFile(from, to)

for (const rel of PUBLIC_COPIES) {
  const source = join(webRoot, rel)
  if (!existsSync(source)) {
    console.warn(`skip missing ${rel}`)
    continue
  }
  syncFile(rel, rel, { recursive: statSync(source).isDirectory() })
}

mergePackageJson()
console.log('\nDone.')
