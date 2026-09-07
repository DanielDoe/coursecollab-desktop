import { fetchStoredAssetBytes } from "@/lib/resolve-stored-asset"

/** Load git-committed static assets or cloud-stored uploads (blob URLs / legacy `/uploads/` paths). */
export async function fetchPublicAssetBytes(
  publicPath: string,
  requestOrigin?: string | null,
): Promise<Buffer | null> {
  return fetchStoredAssetBytes(publicPath, requestOrigin)
}
