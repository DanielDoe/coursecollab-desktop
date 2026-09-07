"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Redirect to Purchase History (in Settings) */
export default function DashboardV2InvoicePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/student/dashboard-v2/settings/purchases")
  }, [router])
  return null
}
