import { del, put } from "@vercel/blob"

export async function saveProjectWorkspaceFile(
  workspaceId: number,
  fileName: string,
  data: Buffer | Blob,
  contentType: string,
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
  const pathname = `projects/workspaces/${workspaceId}/${Date.now()}-${safeName}`
  const blob = await put(pathname, data, {
    access: "public",
    contentType: contentType || "application/octet-stream",
  })
  return { url: blob.url, pathname }
}

export async function deleteProjectWorkspaceBlob(url: string) {
  if (!url) return
  try {
    await del(url)
  } catch {
    /* blob already gone */
  }
}
