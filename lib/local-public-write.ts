import { mkdir, writeFile, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

/** Dev-only disk writes under `public/`. Imported dynamically so Vercel builds skip tracing public/. */
export async function writePublicRelativeFile(relativePath: string, bytes: Buffer): Promise<string> {
  const normalized = relativePath.replace(/\\/g, "/")
  const fullPath = path.join(process.cwd(), "public", normalized)
  const dir = path.dirname(fullPath)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(fullPath, bytes)
  return `/${normalized}`
}

export async function unlinkPublicRelativePath(relativePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), "public", relativePath.replace(/^\//, ""))
  try {
    await unlink(fullPath)
  } catch {
    /* ignore */
  }
}

export function resolvePublicUploadDir(...segments: string[]): string {
  return path.join(process.cwd(), "public", ...segments)
}
