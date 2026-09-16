export async function openDesktopExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return
  if (window.courseCollabDesktop?.openExternal) {
    await window.courseCollabDesktop.openExternal(trimmed)
    return
  }
  window.open(trimmed, "_blank", "noopener,noreferrer")
}
