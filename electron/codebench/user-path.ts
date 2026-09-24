import { spawnSync } from 'node:child_process'
import { delimiter, isAbsolute } from 'node:path'

let cachedDirectories: string[] | null = null

function splitPath(raw: string): string[] {
  return raw
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry && isAbsolute(entry))
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? ''
}

function readLoginShellPath(): string {
  if (process.platform === 'win32') {
    const result = spawnSync('cmd.exe', ['/d', '/c', 'echo %PATH%'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000,
    })
    return result.status === 0 ? firstLine(result.stdout ?? '') : ''
  }
  const shell = process.env.SHELL?.trim() || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  const result = spawnSync(shell, ['-ilc', 'printenv PATH'], {
    encoding: 'utf8',
    timeout: 4000,
    windowsHide: true,
  })
  return result.status === 0 ? firstLine(result.stdout ?? '') : ''
}

/** Electron often has a thin PATH. Merge it with the login-shell PATH once per process. */
export function userPathDirectories(): string[] {
  if (cachedDirectories) return cachedDirectories
  const seen = new Set<string>()
  const out: string[] = []
  for (const dir of [
    ...splitPath(process.env.PATH ?? process.env.Path ?? ''),
    ...splitPath(readLoginShellPath()),
  ]) {
    const key = process.platform === 'win32' ? dir.toLowerCase() : dir
    if (seen.has(key)) continue
    seen.add(key)
    out.push(dir)
  }
  cachedDirectories = out
  return out
}

/** Windows installers often put compilers on PATH without them appearing in Electron's env. */
export function windowsWhereLookup(names: string[]): string[] {
  if (process.platform !== 'win32') return []
  const found: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const result = spawnSync('where.exe', [name], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000,
    })
    if (result.status !== 0) continue
    for (const line of (result.stdout ?? '').split(/\r?\n/)) {
      const filePath = line.trim()
      if (!filePath || !isAbsolute(filePath)) continue
      const key = filePath.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      found.push(filePath)
    }
  }
  return found
}
