"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CodeBenchLocalRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/student/dashboard-v2/codebench/ide")
  }, [router])

  return null
}
