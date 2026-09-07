"use client"

import { useEffect, useState } from "react"
import { isStudentAuthenticated, isAdminAuthenticated } from "@/lib/auth"
import { getDashboardPath } from "@/lib/student-dashboard-paths"

export function useSmartHomeLink() {
  const [homeLink, setHomeLink] = useState("/")

  useEffect(() => {
    const isAdmin = isAdminAuthenticated()
    const isStudent = isStudentAuthenticated()

    if (isAdmin) {
      setHomeLink("/admin/dashboard-v2")
    } else if (isStudent) {
      setHomeLink(getDashboardPath())
    } else {
      setHomeLink("/")
    }
  }, [])

  return homeLink
}
