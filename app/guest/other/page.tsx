"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy route — all guest purposes now land on the workspace home. */
export default function GuestOtherPurposePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/guest")
  }, [router])
  return (
    <div className="flex justify-center py-16 text-sm text-[var(--cc-text-muted)]">Redirecting…</div>
  )
}
