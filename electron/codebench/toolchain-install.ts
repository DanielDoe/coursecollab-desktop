import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { get } from 'node:https'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { portableToolchainForHost, type PortableToolchainArtifact } from './toolchain-manifest'
import { TOOLCHAIN_MARKER, userToolchainRoot } from './toolchain-paths'
import { emitToolchainProgress } from './toolchain-progress'

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
            message: 'Downloading the CourseCollab C++ compiler…',
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

async function writeCurrentLink(root: string, artifact: PortableToolchainArtifact): Promise<string> {
  const extractedBinary = join(root, artifact.binary)
  if (!existsSync(extractedBinary)) {
    throw new Error('The C++ compiler binary was not in the archive.')
  }
  if (process.platform !== 'win32') {
    await chmod(extractedBinary, 0o755)
  }
  // Keep the full extract tree (zig + lib/). A lone copied binary cannot compile.
  await writeFile(markerPath(root, artifact.version), `${artifact.version}\n${extractedBinary}\n`, 'utf8')
  return extractedBinary
}

export function isManagedToolchainInstalled(artifact = portableToolchainForHost()): boolean {
  if (!artifact) return false
  return existsSync(markerPath(userToolchainRoot(), artifact.version))
}

export async function installPortableToolchain(): Promise<string> {
  const artifact = portableToolchainForHost()
  if (!artifact) {
    throw new Error('This platform does not have a CourseCollab C++ installer yet.')
  }
  const root = userToolchainRoot()
  await mkdir(root, { recursive: true })
  if (isManagedToolchainInstalled(artifact)) {
    const extracted = join(root, artifact.binary)
    if (existsSync(extracted)) return extracted
  }

  emitToolchainProgress({
    phase: 'downloading',
    message: 'Downloading the CourseCollab C++ compiler…',
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

export function installPortableToolchainOnce(): Promise<string> {
  if (!installLock) {
    installLock = installPortableToolchain().finally(() => {
      installLock = null
    })
  }
  return installLock
}
