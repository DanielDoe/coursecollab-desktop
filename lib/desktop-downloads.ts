/** Desktop & mobile app download metadata for the public landing page. */

export const DESKTOP_APP_VERSION = "0.1.24"

export type DesktopOs = "mac" | "windows" | "linux"
export type DesktopArch = "arm64" | "x64"

export type DesktopDownloadId =
  | "mac-arm64"
  | "mac-x64"
  | "win-arm64"
  | "win-x64"
  | "linux-arm64"
  | "linux-x64"

export type DesktopDownload = {
  id: DesktopDownloadId
  os: DesktopOs
  arch: DesktopArch
  label: string
  subtitle: string
  filename: string
  /** Installer format shown in UI */
  format: string
  url: string
  sizeLabel?: string
}

export type DetectedPlatform = {
  os: DesktopOs | "unknown"
  arch: DesktopArch | "unknown"
  mobile: "ios" | "android" | null
  recommendedDownloadId: DesktopDownloadId | null
  label: string
}

const DESKTOP_BLOB_VERSION = `v${DESKTOP_APP_VERSION}`

/** Public blob URLs — uploaded via scripts/upload-desktop-downloads.mjs */
const DESKTOP_DOWNLOAD_URLS: Record<DesktopDownloadId, string> = {
  "mac-arm64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-mac-arm64.dmg`,
  "mac-x64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-mac-x64.dmg`,
  "win-arm64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-win-arm64.exe`,
  "win-x64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-win-x64.exe`,
  "linux-arm64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-linux-arm64.AppImage`,
  "linux-x64":
    `https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/${DESKTOP_BLOB_VERSION}/CourseCollab-${DESKTOP_APP_VERSION}-linux-x86_64.AppImage`,
}

export const DESKTOP_DOWNLOADS: DesktopDownload[] = [
  {
    id: "mac-arm64",
    os: "mac",
    arch: "arm64",
    label: "macOS",
    subtitle: "Apple Silicon (M1/M2/M3/M4)",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-mac-arm64.dmg`,
    format: "DMG",
    url: DESKTOP_DOWNLOAD_URLS["mac-arm64"],
    sizeLabel: "339 MB",
  },
  {
    id: "mac-x64",
    os: "mac",
    arch: "x64",
    label: "macOS",
    subtitle: "Intel Mac",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-mac-x64.dmg`,
    format: "DMG",
    url: DESKTOP_DOWNLOAD_URLS["mac-x64"],
    sizeLabel: "346 MB",
  },
  {
    id: "win-x64",
    os: "windows",
    arch: "x64",
    label: "Windows",
    subtitle: "64-bit (most PCs)",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-win-x64.exe`,
    format: "Installer",
    url: DESKTOP_DOWNLOAD_URLS["win-x64"],
    sizeLabel: "266 MB",
  },
  {
    id: "win-arm64",
    os: "windows",
    arch: "arm64",
    label: "Windows",
    subtitle: "ARM64 (Surface Pro X, etc.)",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-win-arm64.exe`,
    format: "Installer",
    url: DESKTOP_DOWNLOAD_URLS["win-arm64"],
    sizeLabel: "260 MB",
  },
  {
    id: "linux-x64",
    os: "linux",
    arch: "x64",
    label: "Linux",
    subtitle: "x86_64 — AppImage",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-linux-x86_64.AppImage`,
    format: "AppImage",
    url: DESKTOP_DOWNLOAD_URLS["linux-x64"],
    sizeLabel: "341 MB",
  },
  {
    id: "linux-arm64",
    os: "linux",
    arch: "arm64",
    label: "Linux",
    subtitle: "ARM64 — AppImage",
    filename: `CourseCollab-${DESKTOP_APP_VERSION}-linux-arm64.AppImage`,
    format: "AppImage",
    url: DESKTOP_DOWNLOAD_URLS["linux-arm64"],
    sizeLabel: "343 MB",
  },
]

export const IOS_APP_STORE_URL = "https://apps.apple.com/app/id6803146932"
export const IOS_APP_STORE_URL_US = "https://apps.apple.com/us/app/coursecollab-mobile/id6803146932"

export const MOBILE_APPS = [
  {
    id: "ios",
    label: "iOS",
    subtitle: "iPhone & iPad · CourseCollab Mobile 1.0",
    status: "available" as const,
    url: IOS_APP_STORE_URL,
    storeLabel: "App Store",
  },
  {
    id: "android",
    label: "Android",
    subtitle: "Phones & tablets",
    status: "coming-soon" as const,
  },
]

export function getDesktopDownload(id: DesktopDownloadId): DesktopDownload | undefined {
  return DESKTOP_DOWNLOADS.find((d) => d.id === id)
}

function resolveMacArch(ua: string, platform: string): DesktopArch {
  if (/arm64|aarch64/i.test(ua)) return "arm64"
  if (platform === "MacIntel" && typeof navigator !== "undefined") {
    // Apple Silicon Macs often report MacIntel; prefer arm64 on recent macOS when touch is available
    const touchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0
    if (touchPoints > 1) return "arm64"
  }
  return "x64"
}

/** Client-side platform sniffing for the landing download CTA. */
export function detectClientPlatform(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): DetectedPlatform {
  const lower = ua.toLowerCase()

  if (/iphone|ipad|ipod/.test(lower) || (platform === "MacIntel" && /mobile/i.test(ua))) {
    return {
      os: "unknown",
      arch: "unknown",
      mobile: "ios",
      recommendedDownloadId: null,
      label: "iOS",
    }
  }

  if (/android/.test(lower)) {
    return {
      os: "unknown",
      arch: "unknown",
      mobile: "android",
      recommendedDownloadId: null,
      label: "Android",
    }
  }

  if (/win/.test(platform) || /windows/.test(lower)) {
    const arch: DesktopArch = /arm64|aarch64|win64; arm/.test(lower) ? "arm64" : "x64"
    return {
      os: "windows",
      arch,
      mobile: null,
      recommendedDownloadId: arch === "arm64" ? "win-arm64" : "win-x64",
      label: arch === "arm64" ? "Windows on ARM" : "Windows",
    }
  }

  if (/mac/.test(platform) || /macintosh/.test(lower)) {
    const arch = resolveMacArch(ua, platform)
    return {
      os: "mac",
      arch,
      mobile: null,
      recommendedDownloadId: arch === "arm64" ? "mac-arm64" : "mac-x64",
      label: arch === "arm64" ? "macOS (Apple Silicon)" : "macOS (Intel)",
    }
  }

  if (/linux/.test(lower) || /linux/.test(platform.toLowerCase())) {
    const arch: DesktopArch = /aarch64|arm64/.test(lower) ? "arm64" : "x64"
    return {
      os: "linux",
      arch,
      mobile: null,
      recommendedDownloadId: arch === "arm64" ? "linux-arm64" : "linux-x64",
      label: "Linux",
    }
  }

  return {
    os: "unknown",
    arch: "unknown",
    mobile: null,
    recommendedDownloadId: "mac-arm64",
    label: "your device",
  }
}

export async function detectClientPlatformAsync(): Promise<DetectedPlatform> {
  const ua = navigator.userAgent
  const platform = navigator.platform

  if (typeof navigator.userAgentData?.getHighEntropyValues === "function") {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues(["architecture", "platform"])
      const archHint = hints.architecture?.toLowerCase() ?? ""
      const platformHint = hints.platform?.toLowerCase() ?? ""

      if (platformHint.includes("mac")) {
        const arch: DesktopArch = archHint.includes("arm") ? "arm64" : "x64"
        return {
          os: "mac",
          arch,
          mobile: null,
          recommendedDownloadId: arch === "arm64" ? "mac-arm64" : "mac-x64",
          label: arch === "arm64" ? "macOS (Apple Silicon)" : "macOS (Intel)",
        }
      }

      if (platformHint.includes("win")) {
        const arch: DesktopArch = archHint.includes("arm") ? "arm64" : "x64"
        return {
          os: "windows",
          arch,
          mobile: null,
          recommendedDownloadId: arch === "arm64" ? "win-arm64" : "win-x64",
          label: arch === "arm64" ? "Windows on ARM" : "Windows",
        }
      }
    } catch {
      // fall through to UA heuristics
    }
  }

  return detectClientPlatform(ua, platform)
}
