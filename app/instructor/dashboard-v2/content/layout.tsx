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

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-x-hidden sm:gap-6">
      {children}
    </div>
  )
}
