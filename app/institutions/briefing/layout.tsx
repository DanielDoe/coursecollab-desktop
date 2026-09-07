import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "CourseCollab for Institutions — Academic briefing",
  description:
    "How CourseCollab supports teaching, learning, and student success — and how annual institutional licensing compares with individual memberships.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09060f",
}

export default function InstitutionBriefingLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-[100dvh] overflow-hidden font-sans">{children}</div>
}
