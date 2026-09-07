import convert from "heic-convert"

/** Convert iPhone HEIC/HEIF bytes to JPEG for browsers and vision models (server-only). */
export async function convertHeicBufferToJpeg(input: Buffer): Promise<Buffer> {
  const output = await convert({
    buffer: input,
    format: "JPEG",
    quality: 0.92,
  })
  return Buffer.from(output)
}
