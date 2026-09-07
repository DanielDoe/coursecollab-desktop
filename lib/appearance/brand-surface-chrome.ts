/** Browser chrome colors for `.cc-brand-surface` — mirrors globals.css PVAMU tokens. */
export const BRAND_SURFACE_CHROME = {
  light: "#faf8fc",
  dark: "#0d0814",
} as const

/** Public routes that pin PVAMU brand tokens to OS light/dark, not saved app theme. */
export function isBrandPublicChromePath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || "/"
  if (path === "/") return true
  const prefixes = [
    "/faculty/login",
    "/student/login",
    "/student/forgot-password",
    "/student/reset-password",
    "/student/change-password",
    "/admin/login",
    "/admin/reset-password",
    "/auth/university",
    "/auth/verify-access-email",
  ]
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function prefersDarkScheme(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Safari / iOS bottom URL bar respects theme-color + color-scheme on brand-locked pages. */
export function syncBrandSurfaceBrowserChrome(): void {
  if (typeof document === "undefined") return

  const isDark = prefersDarkScheme()
  const background = isDark ? BRAND_SURFACE_CHROME.dark : BRAND_SURFACE_CHROME.light
  const root = document.documentElement

  root.style.colorScheme = isDark ? "dark" : "light"
  root.style.backgroundColor = background
  root.dataset.ccBrandChrome = "true"

  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove())

  for (const [media, content] of [
    ["(prefers-color-scheme: light)", BRAND_SURFACE_CHROME.light],
    ["(prefers-color-scheme: dark)", BRAND_SURFACE_CHROME.dark],
  ] as const) {
    const meta = document.createElement("meta")
    meta.name = "theme-color"
    meta.content = content
    meta.setAttribute("media", media)
    document.head.appendChild(meta)
  }

  let statusBarMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  ) as HTMLMetaElement | null
  if (!statusBarMeta) {
    statusBarMeta = document.createElement("meta")
    statusBarMeta.name = "apple-mobile-web-app-status-bar-style"
    document.head.appendChild(statusBarMeta)
  }
  statusBarMeta.content = isDark ? "black-translucent" : "default"
}

export function clearBrandSurfaceBrowserChromeFlag(): void {
  if (typeof document === "undefined") return
  delete document.documentElement.dataset.ccBrandChrome
}
