import { isDesktopElectronShell } from "@/lib/desktop-notifications"

/** Browser tabs poll less aggressively; desktop shell keeps OS alerts responsive. */
export const WEB_NOTIFICATION_POLL_MS = 90_000
export const DESKTOP_NOTIFICATION_POLL_MS = 30_000
/** Lightweight desktop-only poll for near-real-time OS banners. */
export const DESKTOP_FAST_NOTIFICATION_POLL_MS = 15_000

export function getNotificationPollIntervalMs(): number {
  return isDesktopElectronShell() ? DESKTOP_NOTIFICATION_POLL_MS : WEB_NOTIFICATION_POLL_MS
}
