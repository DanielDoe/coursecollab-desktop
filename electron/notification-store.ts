export type TrayPreviewItem = {
  id: string
  title: string
  body: string
  link?: string | null
  createdAt: number
}

const MAX_PREVIEW_ITEMS = 5
const recentItems: TrayPreviewItem[] = []

export function addTrayPreviewItem(item: TrayPreviewItem) {
  recentItems.unshift(item)
  if (recentItems.length > MAX_PREVIEW_ITEMS) {
    recentItems.length = MAX_PREVIEW_ITEMS
  }
}

export function getTrayPreviewItems(): TrayPreviewItem[] {
  return [...recentItems]
}

export function clearTrayPreviewItems() {
  recentItems.length = 0
}
