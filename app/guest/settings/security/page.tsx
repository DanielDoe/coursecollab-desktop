"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function GuestSecurityRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/guest/settings?section=security")
  }, [router])
  return null
}
