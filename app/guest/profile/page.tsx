"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function GuestProfileRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/guest/settings?section=profile")
  }, [router])
  return null
}
