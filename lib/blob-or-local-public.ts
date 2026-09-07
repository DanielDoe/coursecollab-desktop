import { put } from "@vercel/blob"

export function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

/** All uploads go to Vercel Blob — never write into the deploy bundle. */
export function useBlobStorage(): boolean {
  return hasBlobToken()
}

function requireBlobToken(): void {
  if (!hasBlobToken()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required for uploads. Add it to .env.local (same token as production) so files persist in cloud storage, not on disk.",
    )
  }
}

/** Persist upload to Vercel Blob; returns public https URL to store in the database. */
export async function savePublicUpload(opts: {
  blobKey: string
  relativePublicPath: string
  bytes: Buffer
  contentType?: string
  allowOverwrite?: boolean
}): Promise<string> {
  requireBlobToken()
  const blob = await put(opts.blobKey, opts.bytes, {
    access: "public",
    contentType: opts.contentType,
    addRandomSuffix: false,
    allowOverwrite: opts.allowOverwrite ?? false,
  })
  if (!blob.url.startsWith("https://")) {
    throw new Error("Upload did not return a cloud URL — refusing to store a machine-local path in the database")
  }
  return blob.url
}

export async function unlinkPublicUploadUrl(url: string | null | undefined): Promise<void> {
  if (!url || typeof url !== "string") return
  // Blob objects are overwritten on re-upload; no local unlink needed.
  if (url.startsWith("http://") || url.startsWith("https://")) return
}
