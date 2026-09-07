"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function GuestAppearanceRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/guest/settings?section=appearance")
  }, [router])
  return null
}
