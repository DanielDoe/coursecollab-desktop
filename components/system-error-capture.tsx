"use client"

import { useEffect } from "react"
import { installAssetFailureCapture, installClientErrorCapture } from "@/lib/system-log-client"

export function SystemErrorCapture() {
  useEffect(() => {
    const cleanupErrors = installClientErrorCapture({ captureWarnings: false })
    const cleanupAssets = installAssetFailureCapture()
    return () => {
      cleanupErrors()
      cleanupAssets()
    }
  }, [])

  return null
}
