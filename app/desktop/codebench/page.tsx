"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Desktop CodeBench is the same CodeBench IDE — local run lives in the editor terminal. */
export default function DesktopCodeBenchPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/student/dashboard-v2/codebench/ide")
  }, [router])

  return null
}
