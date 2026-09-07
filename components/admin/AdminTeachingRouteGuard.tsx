"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isAdminTeachingRoute } from "@/lib/portal-permissions"
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage"

export function AdminTeachingRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const blocked = pathname ? isAdminTeachingRoute(pathname) : false

  useEffect(() => {
    if (blocked) {
      router.replace("/admin/dashboard-v2/academic/course-oversight")
    }
  }, [blocked, router])

  if (blocked) {
    return (
      <AdminPlaceholderPage
        title="Instructional tools are instructor-only"
        description="Admins oversee courses and users institution-wide. Use Academic Affairs for read-only oversight, or sign in as an instructor to manage lectures, quizzes, and grades."
      />
    )
  }

  return <>{children}</>
}
