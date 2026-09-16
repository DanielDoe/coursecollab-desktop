"use client"

import { usePathname } from "next/navigation"
import { isInstructorLecturePreviewPath } from "@/lib/dashboard-v2-layout"

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (isInstructorLecturePreviewPath(pathname)) {
    return <div className="flex h-0 min-h-0 min-w-0 flex-1 flex-col">{children}</div>
  }

  return <div className="w-full min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">{children}</div>
}
