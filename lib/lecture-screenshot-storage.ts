import { mkdir, writeFile, readFile, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomBytes } from "crypto"

const ROOT = path.join(process.cwd(), "uploads", "private", "lecture-screenshots")

export function buildScreenshotStorageKey(studentId: number, lectureId: number): string {
  const token = randomBytes(8).toString("hex")
  return `${studentId}/${lectureId}/${Date.now()}-${token}.jpg`
}

export function absolutePathForScreenshotKey(key: string): string {
  const normalized = key.replace(/\.\./g, "").replace(/^\/+/, "")
  return path.join(ROOT, normalized)
}

export async function saveLectureScreenshotBase64(
  studentId: number,
  lectureId: number,
  dataUrl: string,
): Promise<string> {
  const match = dataUrl.match(/^data:image\/[\w+]+;base64,(.+)$/)
  if (!match) throw new Error("Invalid image data")
  let buffer = Buffer.from(match[1], "base64")
  if (buffer.length > 4 * 1024 * 1024) throw new Error("Screenshot too large (max 4MB)")

  try {
    const { compressUploadImageBuffer } = await import("@/lib/media/compress-image-server")
    const compressed = await compressUploadImageBuffer(buffer, "image/jpeg")
    if (compressed) buffer = compressed.bytes
  } catch {
    /* keep original screenshot */
  }

  const key = buildScreenshotStorageKey(studentId, lectureId)
  const full = absolutePathForScreenshotKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, buffer)
  return key
}

export async function readLectureScreenshotIfExists(key: string): Promise<Buffer | null> {
  const full = absolutePathForScreenshotKey(key)
  if (!existsSync(full)) return null
  return readFile(full)
}

export async function deleteLectureScreenshotIfExists(key: string | null): Promise<void> {
  if (!key) return
  const full = absolutePathForScreenshotKey(key)
  if (existsSync(full)) {
    try {
      await unlink(full)
    } catch {
      /* ignore */
    }
  }
}
