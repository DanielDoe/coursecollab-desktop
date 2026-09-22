import { isDesktopElectronShell } from "@/lib/desktop-notifications"

export type DesktopUpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "installing"
  | "ready"
  | "error"

export type DesktopUpdateStatus = {
  state: DesktopUpdateState
  supported: boolean
  currentVersion: string
  version?: string
  releaseNotes?: string
  percent?: number
  message?: string
  needsApplicationsFolder?: boolean
}

const WEB_STATUS: DesktopUpdateStatus = {
  state: "idle",
  supported: false,
  currentVersion: "web",
  message: "The browser app updates automatically.",
}

const DISMISSED_UPDATE_VERSION_KEY = "cc-desktop-update-dismissed-version"

export function canUseDesktopUpdates(): boolean {
  return Boolean(isDesktopElectronShell() && window.courseCollabDesktop?.getUpdateStatus)
}

export function getDismissedDesktopUpdateVersion(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(DISMISSED_UPDATE_VERSION_KEY)
  } catch {
    return null
  }
}

export function dismissDesktopUpdatePrompt(version: string): void {
  if (typeof window === "undefined" || !version.trim()) return
  try {
    window.localStorage.setItem(DISMISSED_UPDATE_VERSION_KEY, version.trim())
  } catch {
    // ignore quota / private mode
  }
}

export function shouldPromptDesktopUpdate(
  status: DesktopUpdateStatus,
  dismissedVersion: string | null = getDismissedDesktopUpdateVersion(),
): boolean {
  if (!status.supported) return false
  if (status.state !== "available" && status.state !== "ready") return false
  if (!status.version) return true
  return status.version !== dismissedVersion
}

export async function getDesktopUpdateStatus(): Promise<DesktopUpdateStatus> {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.getUpdateStatus) {
    return WEB_STATUS
  }
  return window.courseCollabDesktop.getUpdateStatus()
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdateStatus> {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.checkForUpdates) {
    return { ...WEB_STATUS, state: "not-available" }
  }
  return window.courseCollabDesktop.checkForUpdates()
}

export async function downloadDesktopUpdate(): Promise<DesktopUpdateStatus> {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.downloadUpdate) {
    return { ...WEB_STATUS, state: "error", message: "Install the desktop app to download updates." }
  }
  return window.courseCollabDesktop.downloadUpdate()
}

export async function installDesktopUpdate(): Promise<DesktopUpdateStatus> {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.installUpdate) {
    return { ...WEB_STATUS, state: "error", message: "Install the desktop app to apply updates." }
  }
  return window.courseCollabDesktop.installUpdate()
}

export async function moveDesktopAppToApplications(): Promise<{ ok: boolean; message?: string }> {
  const move = window.courseCollabDesktop?.moveToApplicationsFolder
  if (!move) {
    return { ok: false, message: "Move to Applications is only available in the desktop app." }
  }
  return move()
}

export async function openDesktopUpdateDownloadPage(): Promise<boolean> {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.openUpdateDownloadPage) {
    if (typeof window !== "undefined") {
      void window.courseCollabDesktop?.openExternal?.(
        "https://course-collab.com/#desktop-downloads",
      )
      return true
    }
    return false
  }
  const result = await window.courseCollabDesktop.openUpdateDownloadPage()
  return Boolean(result?.ok)
}

export function isDesktopUpdateInstallFailure(status: DesktopUpdateStatus): boolean {
  if (status.state !== "error" || status.needsApplicationsFolder) return false
  const message = status.message ?? ""
  return /install|Applications|GitHub Releases|signature|Restarting/i.test(message)
}

export function subscribeDesktopUpdateStatus(
  handler: (status: DesktopUpdateStatus) => void,
): () => void {
  if (!canUseDesktopUpdates() || !window.courseCollabDesktop?.onUpdateStatus) {
    return () => {}
  }
  return window.courseCollabDesktop.onUpdateStatus(handler)
}

export function desktopUpdateButtonLabel(status: DesktopUpdateStatus): string {
  switch (status.state) {
    case "checking":
      return "Checking…"
    case "available":
      return "Update available"
    case "downloading":
      return status.percent != null ? `Downloading… ${status.percent}%` : "Downloading…"
    case "installing":
      return "Installing…"
    case "ready":
      return "Restart to update"
    case "not-available":
      return "Up to date"
    case "error":
      return "Update failed"
    default:
      return "Check for updates"
  }
}

function looksLikeUpdateFeedDump(message?: string): boolean {
  if (!message) return false
  return /releases\.atom|httperror|content-security-policy|x-github-edge|authentication token/i.test(
    message,
  )
}

export function sanitizeDesktopUpdateMessage(message?: string): string | undefined {
  if (!message) return undefined
  if (looksLikeUpdateFeedDump(message)) return undefined
  const compact = message.replace(/\s+/g, " ").trim()
  if (compact.length > 140) return `${compact.slice(0, 137)}…`
  return compact
}

export function desktopUpdateFeedback(status: DesktopUpdateStatus): {
  title: string
  description: string
  variant?: "default" | "destructive" | "success" | "warning"
} {
  const version = status.currentVersion && status.currentVersion !== "web" ? ` (${status.currentVersion})` : ""
  switch (status.state) {
    case "checking":
      return { title: "Checking for updates", description: "Looking for a newer CourseCollab build…" }
    case "available":
      return {
        title: "Update available",
        description: status.message ?? `Version ${status.version ?? "a newer build"} is ready to download.`,
      }
    case "not-available":
      return {
        title: "You're up to date",
        description:
          status.message ??
          (status.supported
            ? `CourseCollab${version} is the latest version.`
            : "This copy is current. Packaged installs receive over-the-air updates."),
        variant: "success",
      }
    case "downloading":
      return {
        title: "Downloading update",
        description: status.percent != null ? `${status.percent}% complete` : "The update is downloading.",
      }
    case "installing":
      return {
        title: "Installing update",
        description:
          status.message ?? "CourseCollab will restart when the update is in place.",
      }
    case "ready":
      return {
        title: "Update ready",
        description: status.message ?? `Version ${status.version ?? ""} is ready to install.`,
      }
    case "error":
      return {
        title: isDesktopUpdateInstallFailure(status) ? "Install failed" : "Update check failed",
        description:
          sanitizeDesktopUpdateMessage(status.message) ??
          (isDesktopUpdateInstallFailure(status)
            ? "Automatic install failed. Download the latest installer and replace the app in Applications."
            : "Could not check for updates. Try again in a moment."),
        variant: "destructive",
      }
    default:
      return { title: "Check for updates", description: status.message ?? "See if a newer CourseCollab build is available." }
  }
}

/** Unpackaged desktop builds cannot OTA-update; treat that as current, not a silent failure. */
export function normalizeDesktopUpdateStatus(status: DesktopUpdateStatus): DesktopUpdateStatus {
  if (status.state === "error" && looksLikeUpdateFeedDump(status.message)) {
    return {
      ...status,
      state: "not-available",
      message: status.currentVersion
        ? `You're on the latest version (${status.currentVersion}).`
        : "You're on the latest version.",
    }
  }
  if (
    status.supported ||
    status.state === "checking" ||
    status.state === "downloading" ||
    status.state === "installing"
  ) {
    return status
  }
  if (status.state === "error") {
    return {
      ...status,
      state: "not-available",
      message:
        status.message?.includes("packaged")
          ? "This development build is current. Install the packaged app to receive over-the-air updates."
          : status.message,
    }
  }
  if (status.state === "not-available" && !status.message) {
    return {
      ...status,
      message: status.currentVersion === "web" ? WEB_STATUS.message : "You're on the latest version.",
    }
  }
  return status
}

export function desktopUpdateAriaLabel(status: DesktopUpdateStatus): string {
  if (status.state === "ready" && status.version) {
    return `Restart to install version ${status.version}`
  }
  if (status.state === "available" && status.version) {
    return `Download version ${status.version}`
  }
  if (status.state === "downloading") {
    return status.percent != null ? `Downloading update ${status.percent} percent` : "Downloading update"
  }
  if (status.state === "installing") {
    return "Installing update. CourseCollab will restart when it is in place."
  }
  return desktopUpdateButtonLabel(status)
}

export async function runDesktopUpdateAction(
  status: DesktopUpdateStatus,
): Promise<DesktopUpdateStatus> {
  if (status.state === "checking" || status.state === "downloading" || status.state === "installing") {
    return status
  }
  if (status.state === "ready") return installDesktopUpdate()
  if (status.state === "available") return downloadDesktopUpdate()
  return checkForDesktopUpdate()
}
