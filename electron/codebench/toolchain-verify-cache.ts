import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { portableToolchainForHost } from './toolchain-manifest'
import { userToolchainRoot } from './toolchain-paths'
import type { CompilerInfo } from './types'

export type ToolchainVerifyCacheRecord = {
  appVersion: string
  manifestVersion: string
  compilerFingerprint: string
  verifiedAt: string
}

function cacheFilePath(): string {
  return join(userToolchainRoot(), 'verify-cache.json')
}

function getAppVersion(): string {
  try {
    const electron = require('electron') as { app?: { getVersion: () => string } }
    return electron.app?.getVersion?.() ?? '0.0.0-dev'
  } catch {
    return process.env.npm_package_version ?? '0.0.0-dev'
  }
}

export function manifestVersionForHost(): string {
  return portableToolchainForHost()?.version ?? 'system'
}

export function compilerFingerprint(info: CompilerInfo): string {
  return [info.source ?? '', info.path ?? '', info.version ?? '', info.compiler ?? ''].join('|')
}

export async function readToolchainVerifyCache(): Promise<ToolchainVerifyCacheRecord | null> {
  const path = cacheFilePath()
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as ToolchainVerifyCacheRecord
    if (
      typeof parsed.appVersion !== 'string' ||
      typeof parsed.manifestVersion !== 'string' ||
      typeof parsed.compilerFingerprint !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function writeToolchainVerifyCache(info: CompilerInfo): Promise<void> {
  const root = userToolchainRoot()
  await mkdir(root, { recursive: true })
  const record: ToolchainVerifyCacheRecord = {
    appVersion: getAppVersion(),
    manifestVersion: manifestVersionForHost(),
    compilerFingerprint: compilerFingerprint(info),
    verifiedAt: new Date().toISOString(),
  }
  await writeFile(cacheFilePath(), JSON.stringify(record, null, 2), 'utf8')
}

export async function clearToolchainVerifyCache(): Promise<void> {
  await rm(cacheFilePath(), { force: true }).catch(() => undefined)
}

export async function isToolchainVerifyCacheValid(info: CompilerInfo): Promise<boolean> {
  if (!info.available) return false
  const cache = await readToolchainVerifyCache()
  if (!cache) return false
  return (
    cache.appVersion === getAppVersion() &&
    cache.manifestVersion === manifestVersionForHost() &&
    cache.compilerFingerprint === compilerFingerprint(info)
  )
}
