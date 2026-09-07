import { spawn, spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

export type PythonInfo = {
  available: boolean
  path: string | null
  version: string | null
}

function isExecutableFile(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false
    if (!statSync(filePath).isFile()) return false
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function macDeveloperToolsPresent(): boolean {
  if (process.platform !== 'darwin') return true
  const probe = spawnSync('xcode-select', ['-p'], { encoding: 'utf8', windowsHide: true })
  return probe.status === 0 && Boolean(probe.stdout?.trim())
}

function hintDirectories(): string[] {
  if (process.platform === 'win32') {
    return [
      'C:\\Python313',
      'C:\\Python312',
      'C:\\Python311',
      'C:\\Program Files\\Python313',
      'C:\\Program Files\\Python312',
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312'),
    ].filter(Boolean)
  }
  return ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
}

function candidateNames(): string[] {
  return process.platform === 'win32' ? ['python.exe', 'python3.exe', 'python'] : ['python3', 'python']
}

function collectCandidates(): string[] {
  const dirs = [
    ...hintDirectories(),
    ...(process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter((entry) => entry && isAbsolute(entry)),
  ]
  const seen = new Set<string>()
  const found: string[] = []
  for (const name of candidateNames()) {
    for (const dir of dirs) {
      const full = join(dir, name)
      const key = full.toLowerCase()
      if (seen.has(key) || !isExecutableFile(full)) continue
      seen.add(key)
      found.push(full)
    }
  }
  return found
}

function isUnusable(path: string, version: string | null): boolean {
  const text = (version ?? '').toLowerCase()
  if (/xcode-select|no developer tools|unable to find utility/.test(text)) return true
  if (process.platform === 'darwin' && path === '/usr/bin/python3' && !macDeveloperToolsPresent()) {
    return true
  }
  return false
}

function runVersion(executablePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(executablePath, ['--version'], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const append = (chunk: Buffer) => {
      output += chunk.toString('utf8')
      if (output.length > 1000) output = output.slice(0, 1000)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    const timer = setTimeout(() => {
      child.kill()
      resolve(null)
    }, 4000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      const first = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
      resolve(first ?? null)
    })
  })
}

export async function detectPythonRuntime(): Promise<PythonInfo> {
  for (const path of collectCandidates()) {
    const version = await runVersion(path)
    if (!version || isUnusable(path, version)) continue
    return { available: true, path, version }
  }
  return { available: false, path: null, version: null }
}
