import type { ZipBytesSource } from "@/lib/imscc/zip-source"
import { open } from "node:fs/promises"

export async function zipSourceFromNodePath(filePath: string): Promise<ZipBytesSource & { close: () => Promise<void> }> {
  const fh = await open(filePath, "r")
  const stat = await fh.stat()
  return {
    size: stat.size,
    read: async (start, end) => {
      const len = Math.max(0, end - start)
      const buf = Buffer.alloc(len)
      const { bytesRead } = await fh.read(buf, 0, len, start)
      return new Uint8Array(buf.subarray(0, bytesRead))
    },
    close: async () => {
      await fh.close()
    },
  }
}
