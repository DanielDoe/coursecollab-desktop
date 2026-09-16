import {
  DESKTOP_APP_VERSION,
  IOS_APP_STORE_URL,
  getDesktopDownload,
} from "@/lib/desktop-downloads"

export const ELEG_FALL2026_HW1_APPS_TITLE =
  "Homework 1 is open — mobile app, desktop update, and classroom points"

export type ElegFall2026Hw1AppsLinks = {
  iosAppStoreUrl: string
  downloadsPageUrl: string
  homeworkUrl: string
  classroomPointsUrl: string
  macArmUrl: string
  macIntelUrl: string
  winX64Url: string
  winArmUrl: string
  desktopVersion: string
}

export function elegFall2026Hw1AppsLinks(baseUrl: string): ElegFall2026Hw1AppsLinks {
  const base = baseUrl.replace(/\/$/, "")
  return {
    iosAppStoreUrl: IOS_APP_STORE_URL,
    downloadsPageUrl: `${base}/#desktop-downloads`,
    homeworkUrl: `${base}/student/homework`,
    classroomPointsUrl: `${base}/student/dashboard-v2/classroom-points`,
    macArmUrl: getDesktopDownload("mac-arm64")!.url,
    macIntelUrl: getDesktopDownload("mac-x64")!.url,
    winX64Url: getDesktopDownload("win-x64")!.url,
    winArmUrl: getDesktopDownload("win-arm64")!.url,
    desktopVersion: DESKTOP_APP_VERSION,
  }
}

export function elegFall2026Hw1AppsAnnouncementHtml(links: ElegFall2026Hw1AppsLinks): string {
  const a = (href: string, label: string) =>
    `<a href="${href.replace(/"/g, "&quot;")}"><strong>${label}</strong></a>`

  return `<p>Hi everyone,</p>

<p>A few quick updates for Fall 2026:</p>

<ol style="margin:0 0 16px;padding-left:22px;">
  <li><strong>iPhone / iPad:</strong> Download CourseCollab Mobile from the App Store — ${a(links.iosAppStoreUrl, "Get the iOS app")}. Android support is coming later.</li>
  <li><strong>Classroom points:</strong> Check for any pending classroom code submissions and finish them ASAP — ${a(links.classroomPointsUrl, "Open Classroom Points")}.</li>
  <li><strong>Homework 1 Fall 2026</strong> is available on CourseCollab — ${a(links.homeworkUrl, "Open Homework")}.</li>
  <li><strong>Desktop app:</strong> Install/update CourseCollab PC (v${links.desktopVersion}) for our coding sessions — ${a(links.downloadsPageUrl, "All downloads")}, or direct: ${a(links.macArmUrl, "Mac Apple Silicon")}, ${a(links.macIntelUrl, "Mac Intel")}, ${a(links.winX64Url, "Windows x64")}, ${a(links.winArmUrl, "Windows ARM")}.</li>
</ol>

<p>Best,<br/>Daniel Doe</p>`
}
