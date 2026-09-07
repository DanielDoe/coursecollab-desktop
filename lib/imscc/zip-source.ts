/**
 * Random-access ZIP reader. Lists and extracts entries without loading the
 * whole archive (needed for 1GB+ Canvas .imscc packages).
 */

export type ZipBytesSource = {
  size: number
  read: (start: number, end: number) => Promise<Uint8Array>
}

export type ZipEntry = {
  name: string
  compressedSize: number
  uncompressedSize: number
  compression: number
  localHeaderOffset: number
}

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LH_SIG = 0x04034b50
const ZIP64_EXTRA = 0x0001

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}
function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function decodeName(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8").decode(bytes)
  } catch {
    return Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("")
  }
}

function asView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function parseZip64Extra(
  extra: Uint8Array,
  fallback: { uncompressed: number; compressed: number; offset: number },
): { uncompressed: number; compressed: number; offset: number } {
  const view = asView(extra)
  let i = 0
  while (i + 4 <= extra.length) {
    const id = u16(view, i)
    const size = u16(view, i + 2)
    i += 4
    if (id === ZIP64_EXTRA && i + size <= extra.length) {
      let cursor = i
      let uncompressed = fallback.uncompressed
      let compressed = fallback.compressed
      let offset = fallback.offset
      if (fallback.uncompressed === 0xffffffff && cursor + 8 <= i + size) {
        uncompressed = Number(view.getBigUint64(cursor, true))
        cursor += 8
      }
      if (fallback.compressed === 0xffffffff && cursor + 8 <= i + size) {
        compressed = Number(view.getBigUint64(cursor, true))
        cursor += 8
      }
      if (fallback.offset === 0xffffffff && cursor + 8 <= i + size) {
        offset = Number(view.getBigUint64(cursor, true))
      }
      return { uncompressed, compressed, offset }
    }
    i += size
  }
  return fallback
}

export async function listZipEntries(source: ZipBytesSource): Promise<ZipEntry[]> {
  const tailLen = Math.min(65557, source.size)
  const tail = await source.read(source.size - tailLen, source.size)
  const view = asView(tail)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(view, i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive (missing end-of-central-directory)")

  const cdSize = u32(view, eocd + 12)
  const cdOffset = u32(view, eocd + 16)
  const totalEntries = u16(view, eocd + 10)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error("ZIP64 packages with 4GB+ offsets are not supported yet")
  }

  const cd = await source.read(cdOffset, cdOffset + cdSize)
  const cdView = asView(cd)
  const entries: ZipEntry[] = []
  let p = 0
  while (p + 46 <= cd.length) {
    if (u32(cdView, p) !== CD_SIG) break
    const compression = u16(cdView, p + 10)
    const compressedSize = u32(cdView, p + 20)
    const uncompressedSize = u32(cdView, p + 24)
    const nameLen = u16(cdView, p + 28)
    const extraLen = u16(cdView, p + 30)
    const commentLen = u16(cdView, p + 32)
    const localHeaderOffset = u32(cdView, p + 42)
    const name = decodeName(cd.subarray(p + 46, p + 46 + nameLen))
    const extra = cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen)
    const sizes = parseZip64Extra(extra, {
      uncompressed: uncompressedSize,
      compressed: compressedSize,
      offset: localHeaderOffset,
    })
    if (name && !name.endsWith("/")) {
      entries.push({
        name,
        compressedSize: sizes.compressed,
        uncompressedSize: sizes.uncompressed,
        compression,
        localHeaderOffset: sizes.offset,
      })
    }
    p += 46 + nameLen + extraLen + commentLen
    if (entries.length >= totalEntries && totalEntries > 0) break
  }
  return entries
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function extractZipEntry(source: ZipBytesSource, entry: ZipEntry): Promise<Uint8Array> {
  const header = await source.read(entry.localHeaderOffset, entry.localHeaderOffset + 30)
  const hv = asView(header)
  if (u32(hv, 0) !== LH_SIG) throw new Error(`Corrupt ZIP local header: ${entry.name}`)
  const nameLen = u16(hv, 26)
  const extraLen = u16(hv, 28)
  const dataStart = entry.localHeaderOffset + 30 + nameLen + extraLen
  const compressed = await source.read(dataStart, dataStart + entry.compressedSize)
  if (entry.compression === 0) return compressed
  if (entry.compression === 8) return inflateRaw(compressed)
  throw new Error(`Unsupported ZIP compression ${entry.compression} for ${entry.name}`)
}

export async function extractZipText(
  source: ZipBytesSource,
  entry: ZipEntry,
  maxBytes = 2_000_000,
): Promise<string> {
  if (entry.uncompressedSize > maxBytes) {
    throw new Error(`${entry.name} is too large to parse as text`)
  }
  const bytes = await extractZipEntry(source, entry)
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
}

export function zipSourceFromBytes(bytes: Uint8Array): ZipBytesSource {
  return {
    size: bytes.byteLength,
    read: async (start, end) => bytes.subarray(start, end),
  }
}

export function zipSourceFromBlob(file: Blob): ZipBytesSource {
  return {
    size: file.size,
    read: async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer()),
  }
}

