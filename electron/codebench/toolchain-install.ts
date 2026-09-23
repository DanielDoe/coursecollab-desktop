import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, readdirSync, statSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { get } from 'node:https'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { portableToolchainForHost, type PortableToolchainArtifact } from './toolchain-manifest'
import { TOOLCHAIN_MARKER, userToolchainRoot } from './toolchain-paths'
import { emitToolchainProgress } from './toolchain-progress'
import { clearToolchainVerifyCache } from './toolchain-verify-cache'

function markerPath(root: string, version: string) {
  return join(root, `${TOOLCHAIN_MARKER}-${version}`)
}

function downloadPath(artifact: PortableToolchainArtifact) {
  const ext = artifact.archive === 'zip' ? 'zip' : 'tar.xz'
  return join(tmpdir(), `coursecollab-cpp-${artifact.version}.${ext}`)
}

async function downloadFile(url: string, dest: string, sha256: string, hops = 0): Promise<void> {
  if (hops > 5) {
    throw new Error('Compiler download redirected too many times.')
  }
  await mkdir(dirname(dest), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const request = get(url, { headers: { 'User-Agent': 'CourseCollab-Desktop' } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        const nextUrl = new URL(response.headers.location, url).toString()
        downloadFile(nextUrl, dest, sha256, hops + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed (${response.statusCode ?? 'no status'}).`))
        return
      }
      const total = Number(response.headers['content-length'] || 0)
      let received = 0
      response.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (total > 0) {
          emitToolchainProgress({
            phase: 'downloading',
            message: 'Downloading the C++ compiler…',
            percent: Math.min(99, Math.round((received / total) * 100)),
          })
        }
      })
      const file = createWriteStream(dest)
      pipeline(response, file).then(resolve, reject)
    })
    request.on('error', reject)
  })

  const hash = createHash('sha256')
  hash.update(await readFile(dest))
  const digest = hash.digest('hex')
  if (digest !== sha256) {
    await rm(dest, { force: true })
    throw new Error('Compiler download failed the integrity check.')
  }
}

function extractArchive(archivePath: string, destDir: string, kind: PortableToolchainArtifact['archive']): Promise<void> {
  return new Promise((resolve, reject) => {
    const args =
      kind === 'zip'
        ? ['-xf', archivePath, '-C', destDir]
        : ['-xJf', archivePath, '-C', destDir]
    const child = spawn('tar', args, { shell: false, windowsHide: true, stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error('Could not extract the C++ compiler archive.'))
    })
  })
}

function clearDownloadQuarantine(root: string): void {
  if (process.platform !== 'darwin') return
  spawnSync('xattr', ['-dr', 'com.apple.quarantine', root], { stdio: 'ignore' })
}

/** Archive layouts sometimes add a top-level folder. Prefer the expected path, then any path that ends with it. */
export function findExtractedBinary(root: string, relativeBinary: string): string | null {
  const expected = join(root, relativeBinary)
  if (existsSync(expected)) return expected
  const suffix = relativeBinary.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!dir) break
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      const full = join(dir, name)
      let isDir = false
      try {
        isDir = statSync(full).isDirectory()
      } catch {
        continue
      }
      if (isDir) {
        stack.push(full)
        continue
      }
      const rel = relative(root, full).replace(/\\/g, '/').toLowerCase()
      if (rel === suffix || rel.endsWith(`/${suffix}`)) return full
    }
  }
  return null
}

async function publishManagedBinary(root: string, artifact: PortableToolchainArtifact, binary: string): Promise<string> {
  clearDownloadQuarantine(root)
  if (process.platform !== 'win32') {
    await chmod(binary, 0o755)
  }
  await writeFile(markerPath(root, artifact.version), `${artifact.version}\n${binary}\n`, 'utf8')
  return binary
}

async function writeCurrentLink(root: string, artifact: PortableToolchainArtifact): Promise<string> {
  const extractedBinary = findExtractedBinary(root, artifact.binary)
  if (!extractedBinary) {
    throw new Error('The C++ compiler binary was not in the archive.')
  }
  // Keep the full extract tree (zig + lib/). A lone copied binary cannot compile.
  return publishManagedBinary(root, artifact, extractedBinary)
}

export function isManagedToolchainInstalled(artifact = portableToolchainForHost()): boolean {
  if (!artifact) return false
  return existsSync(markerPath(userToolchainRoot(), artifact.version))
}

export async function installPortableToolchain(options?: { replace?: boolean }): Promise<string> {
  const artifact = portableToolchainForHost()
  if (!artifact) {
    throw new Error('This platform does not have a CourseCollab C++ installer yet.')
  }
  const root = userToolchainRoot()
  if (options?.replace) {
    await rm(root, { recursive: true, force: true })
    await clearToolchainVerifyCache()
  }
  await mkdir(root, { recursive: true })
  if (!options?.replace && isManagedToolchainInstalled(artifact)) {
    const extracted = findExtractedBinary(root, artifact.binary)
    if (extracted) return publishManagedBinary(root, artifact, extracted)
  }

  emitToolchainProgress({
    phase: 'downloading',
    message:
      artifact.driver === 'g++'
        ? 'Downloading MinGW-w64 (g++)…'
        : 'Downloading the CourseCollab C++ compiler…',
    percent: 0,
  })
  const archive = downloadPath(artifact)
  await downloadFile(artifact.url, archive, artifact.sha256)

  emitToolchainProgress({
    phase: 'extracting',
    message: 'Installing the C++ compiler…',
    percent: 100,
  })
  await extractArchive(archive, root, artifact.archive)
  const binary = await writeCurrentLink(root, artifact)
  await rm(archive, { force: true }).catch(() => undefined)
  return binary
}

let installLock: Promise<string> | null = null

export function installPortableToolchainOnce(options?: { replace?: boolean }): Promise<string> {
  if (options?.replace) {
    return installPortableToolchain({ replace: true })
  }
  if (!installLock) {
    installLock = installPortableToolchain().finally(() => {
      installLock = null
    })
  }
  return installLock
}
