import { spawn, spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { portableToolchainForHost } from './toolchain-manifest'
import { buildCodebenchChildEnv } from './process-env'
import { bundledToolchainRoot, userToolchainRoot } from './toolchain-paths'
import { userPathDirectories, windowsWhereLookup } from './user-path'
import type { CompilerFamily, CompilerInfo, CompilerManager, CompilerSource } from './types'

/** Cold `xcrun` / first Apple clang often exceeds 4s; 15s still fails fast if it's missing. */
export const VERSION_PROBE_TIMEOUT_MS = 15_000

const MAC_HINT_DIRS = [
  '/usr/bin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/opt/local/bin',
  '/Library/Developer/CommandLineTools/usr/bin',
  '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin',
]

const LINUX_HINT_DIRS = ['/usr/bin', '/usr/local/bin', '/bin', '/opt/homebrew/bin']

const WINDOWS_HINT_DIRS = [
  'C:\\Program Files\\LLVM\\bin',
  'C:\\Program Files (x86)\\LLVM\\bin',
  'C:\\Program Files\\Git\\mingw64\\bin',
  'C:\\Program Files\\Git\\usr\\bin',
  'C:\\msys64\\ucrt64\\bin',
  'C:\\msys64\\mingw64\\bin',
  'C:\\msys64\\clang64\\bin',
  'C:\\mingw64\\bin',
  'C:\\MinGW\\bin',
]

function setupGuidance(): string {
  if (process.platform === 'darwin') {
    return 'CourseCollab can install a C++ compiler for this computer. You can also install Apple Command Line Tools.'
  }
  if (process.platform === 'win32') {
    return 'CourseCollab can install a C++ compiler for this computer. You can also install LLVM or MinGW-w64 yourself.'
  }
  return 'CourseCollab can install a C++ compiler for this computer. You can also install g++ or clang++ yourself.'
}

function emptyInfo(): CompilerInfo {
  return {
    available: false,
    compiler: null,
    path: null,
    version: null,
    platform: process.platform,
    architecture: process.arch,
    setupGuidance: setupGuidance(),
    source: null,
    canInstall: Boolean(portableToolchainForHost()),
  }
}

function isExecutableFile(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false
    const info = statSync(filePath)
    if (!info.isFile()) return false
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function pathDirectories(): string[] {
  return userPathDirectories()
}

function systemCandidateNames(): { family: CompilerFamily; name: string }[] {
  if (process.platform === 'win32') {
    return [
      { family: 'g++', name: 'g++.exe' },
      { family: 'g++', name: 'g++' },
      { family: 'clang++', name: 'clang++.exe' },
      { family: 'clang++', name: 'clang++' },
      { family: 'cl', name: 'cl.exe' },
    ]
  }
  if (process.platform === 'darwin') {
    return [
      { family: 'clang++', name: 'clang++' },
      { family: 'g++', name: 'g++' },
    ]
  }
  return [
    { family: 'g++', name: 'g++' },
    { family: 'clang++', name: 'clang++' },
  ]
}

function hintDirectories(): string[] {
  if (process.platform === 'darwin') return MAC_HINT_DIRS
  if (process.platform === 'win32') return WINDOWS_HINT_DIRS
  return LINUX_HINT_DIRS
}

function collectNamed(names: { family: CompilerFamily; name: string }[], dirs: string[]): { family: CompilerFamily; path: string }[] {
  const seen = new Set<string>()
  const found: { family: CompilerFamily; path: string }[] = []
  for (const { family, name } of names) {
    for (const dir of dirs) {
      const full = join(dir, name)
      const key = full.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (!isExecutableFile(full)) continue
      found.push({ family, path: full })
    }
  }
  return found
}

function collectSystemCandidates(): { family: CompilerFamily; path: string }[] {
  const named = collectNamed(systemCandidateNames(), [...hintDirectories(), ...pathDirectories()])
  if (process.platform !== 'win32') return named
  const seen = new Set(named.map((item) => item.path.toLowerCase()))
  const extras: { family: CompilerFamily; path: string }[] = []
  const whereNames = systemCandidateNames().map((item) => item.name)
  for (const filePath of windowsWhereLookup(whereNames)) {
    const key = filePath.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const family = filePath.toLowerCase().includes('clang')
      ? 'clang++'
      : filePath.toLowerCase().includes('cl.exe')
        ? 'cl'
        : 'g++'
    extras.push({ family, path: filePath })
  }
  return [...named, ...extras]
}

function zigNames(): { family: CompilerFamily; name: string }[] {
  return process.platform === 'win32'
    ? [
        { family: 'zig', name: 'zig.exe' },
        { family: 'zig', name: 'zig' },
      ]
    : [{ family: 'zig', name: 'zig' }]
}

function managedSearchDirs(): string[] {
  const artifact = portableToolchainForHost()
  const roots = [userToolchainRoot(), bundledToolchainRoot()].filter((dir): dir is string => Boolean(dir))
  const dirs: string[] = []
  for (const root of roots) {
    dirs.push(root, join(root, 'bin'))
    if (artifact) dirs.push(join(root, dirname(artifact.binary)))
  }
  return dirs
}

function portableDriverNames(artifact: NonNullable<ReturnType<typeof portableToolchainForHost>>): {
  family: CompilerFamily
  name: string
}[] {
  if (artifact.driver === 'g++') {
    return process.platform === 'win32'
      ? [
          { family: 'g++', name: 'g++.exe' },
          { family: 'g++', name: 'g++' },
        ]
      : [{ family: 'g++', name: 'g++' }]
  }
  return zigNames()
}

function collectManagedPortable(): { family: CompilerFamily; path: string }[] {
  const artifact = portableToolchainForHost()
  const found: { family: CompilerFamily; path: string }[] = []
  const roots = [userToolchainRoot(), bundledToolchainRoot()].filter((dir): dir is string => Boolean(dir))
  if (artifact) {
    const family = artifact.driver === 'g++' ? 'g++' : 'zig'
    for (const root of roots) {
      const full = join(root, artifact.binary)
      if (isExecutableFile(full)) found.push({ family, path: full })
    }
    found.push(...collectNamed(portableDriverNames(artifact), managedSearchDirs()))
  }
  const seen = new Set<string>()
  return found.filter((item) => {
    const key = item.path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function collectPathZig(): { family: CompilerFamily; path: string }[] {
  return collectNamed(zigNames(), pathDirectories())
}

export function macDeveloperToolsPresent(): boolean {
  if (process.platform !== 'darwin') return true
  const probe = spawnSync('xcode-select', ['-p'], { encoding: 'utf8', windowsHide: true })
  return probe.status === 0 && Boolean(probe.stdout?.trim())
}

function isUnusable(path: string, family: CompilerFamily, version: string | null): boolean {
  const text = (version ?? '').toLowerCase()
  if (/xcode-select|no developer tools|unable to find utility/.test(text)) return true
  if (
    process.platform === 'darwin' &&
    family !== 'zig' &&
    (path === '/usr/bin/clang++' || path === '/usr/bin/g++' || path === '/usr/bin/clang') &&
    !macDeveloperToolsPresent()
  ) {
    return true
  }
  return false
}

function startsWithPath(filePath: string, root: string | null): boolean {
  if (!root) return false
  const left = filePath.replace(/\\/g, '/').toLowerCase()
  const right = root.replace(/\\/g, '/').toLowerCase()
  return left === right || left.startsWith(`${right}/`)
}

function classifySource(filePath: string): CompilerSource {
  if (startsWithPath(filePath, bundledToolchainRoot())) return 'bundled'
  if (startsWithPath(filePath, userToolchainRoot())) return 'app-managed'
  return 'system'
}

function runVersion(executablePath: string, family: CompilerFamily): Promise<string | null> {
  const args = family === 'cl' ? [] : family === 'zig' ? ['version'] : ['--version']
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const child = spawn(executablePath, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildCodebenchChildEnv({
        pathPrefix: dirname(executablePath),
        useZigCache: family === 'zig',
      }),
    })

    let output = ''
    const append = (chunk: Buffer) => {
      output += chunk.toString('utf8')
      if (output.length > 4000) output = output.slice(0, 4000)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)

    const timer = setTimeout(() => {
      child.kill()
      finish(null)
    }, VERSION_PROBE_TIMEOUT_MS)

    child.on('error', () => {
      clearTimeout(timer)
      finish(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      const first = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
      finish(first ?? null)
    })
  })
}

async function firstUsable(candidates: { family: CompilerFamily; path: string }[]): Promise<CompilerInfo | null> {
  const base = emptyInfo()
  for (const candidate of candidates) {
    // /usr/bin/clang++ on a Mac without Command Line Tools is a stub. Probing it
    // pops Apple's install dialog and then times out.
    if (isUnusable(candidate.path, candidate.family, null)) continue
    const version = await runVersion(candidate.path, candidate.family)
    if (!version && candidate.family !== 'cl') continue
    if (isUnusable(candidate.path, candidate.family, version)) continue
    return {
      ...base,
      available: true,
      compiler: candidate.family,
      path: candidate.path,
      version: version ?? candidate.family,
      setupGuidance: '',
      source: classifySource(candidate.path),
      canInstall: false,
    }
  }
  return null
}

export async function detectCppCompiler(options?: { scope?: 'all' | 'managed' }): Promise<CompilerInfo> {
  const scope = options?.scope ?? 'all'
  const managed = await firstUsable(collectManagedPortable())
  if (scope === 'managed') return managed ?? emptyInfo()
  if (managed && (managed.source === 'app-managed' || managed.source === 'bundled')) return managed
  const system = await firstUsable(collectSystemCandidates())
  if (system) return system
  const pathZig = await firstUsable(collectPathZig())
  if (pathZig) return pathZig
  return emptyInfo()
}

export class LocalCompilerManager implements CompilerManager {
  detect(): Promise<CompilerInfo> {
    return detectCppCompiler()
  }

  async ensure(): Promise<CompilerInfo> {
    const { ensureCppToolchain } = await import('./toolchain-ensure.js')
    return ensureCppToolchain({ installIfMissing: true })
  }
}
