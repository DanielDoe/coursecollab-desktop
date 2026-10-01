import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  statSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { userToolchainRoot } from './toolchain-paths'

/** Current macOS SDK stubs name an architecture older linkers reject. */
export function tbdHasUnsupportedArch(text: string): boolean {
  return text.includes('arm64e.x1')
}

export function stripUnsupportedArch(text: string): string {
  return text.replace(/,?\s*arm64e\.x1-[A-Za-z0-9.]+/g, '').replace(/,(\s*)\]/g, '$1]')
}

export function sdkVersionRank(name: string): number {
  const match = basename(name).match(/MacOSX(\d+)(?:\.(\d+))?/i)
  if (!match) return -1
  return Number(match[1]) * 100 + Number(match[2] ?? 0)
}

export function chooseLinkableSdk(
  sdks: Array<{ path: string; version: number; unsupported: boolean }>,
): { path: string; shim: boolean } | null {
  const ranked = [...sdks].sort((a, b) => b.version - a.version)
  const clean = ranked.find((sdk) => !sdk.unsupported && sdk.version >= 0)
  if (clean) return { path: clean.path, shim: false }
  const newest = ranked.find((sdk) => sdk.version >= 0) ?? ranked[0]
  if (!newest) return null
  return { path: newest.path, shim: newest.unsupported }
}

function developerRoots(): string[] {
  const roots = [
    '/Library/Developer/CommandLineTools',
    '/Applications/Xcode.app/Contents/Developer',
  ]
  const probe = spawnSync('xcode-select', ['-p'], { encoding: 'utf8', windowsHide: true })
  const selected = probe.status === 0 ? probe.stdout.trim() : ''
  if (selected) roots.unshift(selected)
  return [...new Set(roots)]
}

function readLibSystemHead(sdkPath: string): string {
  for (const name of ['usr/lib/libSystem.tbd', 'usr/lib/libSystem.B.tbd']) {
    const path = join(sdkPath, name)
    if (!existsSync(path)) continue
    try {
      return readFileSync(path, 'utf8').slice(0, 4000)
    } catch {
      continue
    }
  }
  return ''
}

function listInstalledSdks(): Array<{ path: string; version: number; unsupported: boolean }> {
  const found: Array<{ path: string; version: number; unsupported: boolean }> = []
  const seen = new Set<string>()
  for (const root of developerRoots()) {
    for (const dir of [join(root, 'SDKs'), join(root, 'Platforms', 'MacOSX.platform', 'Developer', 'SDKs')]) {
      if (!existsSync(dir)) continue
      let names: string[]
      try {
        names = readdirSync(dir)
      } catch {
        continue
      }
      for (const name of names) {
        if (!/^MacOSX.+\.sdk$/i.test(name)) continue
        const path = join(dir, name)
        let key = path
        try {
          if (lstatSync(path).isSymbolicLink()) key = join(dir, readlinkSync(path))
        } catch {
          key = path
        }
        const seenKey = key.toLowerCase()
        if (seen.has(seenKey)) continue
        seen.add(seenKey)
        if (!existsSync(join(path, 'usr'))) continue
        const head = readLibSystemHead(path)
        found.push({
          path,
          version: sdkVersionRank(name) >= 0 ? sdkVersionRank(name) : sdkVersionRank(basename(key)),
          unsupported: tbdHasUnsupportedArch(head),
        })
      }
    }
  }
  return found
}

function mirrorLib(real: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(real, { withFileTypes: true })) {
    const from = join(real, entry.name)
    const to = join(dest, entry.name)
    if (entry.name.endsWith('.tbd')) {
      writeFileSync(to, stripUnsupportedArch(readFileSync(from, 'utf8')))
      continue
    }
    if (statSync(from).isDirectory()) {
      mirrorLib(from, to)
      continue
    }
    symlinkSync(from, to)
  }
}

function buildSdkShim(sdkPath: string): string {
  const root = join(userToolchainRoot(), 'macos-sdk-shim')
  const dest = join(root, 'MacOSX.sdk')
  rmSync(root, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(sdkPath, { withFileTypes: true })) {
    const from = join(sdkPath, entry.name)
    const to = join(dest, entry.name)
    if (entry.name === 'usr' && statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true })
      for (const usrEntry of readdirSync(from, { withFileTypes: true })) {
        const usrFrom = join(from, usrEntry.name)
        const usrTo = join(to, usrEntry.name)
        if (usrEntry.name === 'lib' && statSync(usrFrom).isDirectory()) {
          mirrorLib(usrFrom, usrTo)
          continue
        }
        symlinkSync(usrFrom, usrTo)
      }
      continue
    }
    symlinkSync(from, to)
  }
  writeFileSync(join(root, 'source'), sdkPath, 'utf8')
  return dest
}

let cachedSdk: string | null | undefined

/** SDKROOT for student compiles. Older linkers cannot parse arm64e.x1 stubs in the newest macOS SDK. */
export function linkableMacSdkRoot(): string | null {
  if (process.platform !== 'darwin') return null
  if (cachedSdk !== undefined) return cachedSdk
  const chosen = chooseLinkableSdk(listInstalledSdks())
  if (!chosen) {
    cachedSdk = null
    return null
  }
  if (!chosen.shim) {
    cachedSdk = chosen.path
    return cachedSdk
  }
  try {
    const shimRoot = join(userToolchainRoot(), 'macos-sdk-shim')
    const sourceFile = join(shimRoot, 'source')
    const dest = join(shimRoot, 'MacOSX.sdk')
    if (existsSync(dest) && existsSync(sourceFile) && readFileSync(sourceFile, 'utf8') === chosen.path) {
      cachedSdk = dest
      return cachedSdk
    }
    cachedSdk = buildSdkShim(chosen.path)
    return cachedSdk
  } catch {
    cachedSdk = chosen.path
    return cachedSdk
  }
}
