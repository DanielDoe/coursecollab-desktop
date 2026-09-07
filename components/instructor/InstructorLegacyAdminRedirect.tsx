"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { instructorLegacyAdminRedirect } from "@/lib/portal-permissions"
import { Loader2 } from "lucide-react"

export function InstructorLegacyAdminRedirect() {
  const pathname = usePathname()
  const router = useRouter()
  const target = pathname ? instructorLegacyAdminRedirect(pathname) : null

  useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Redirecting…</p>
    </div>
  )
}
