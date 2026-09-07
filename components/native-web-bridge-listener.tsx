"use client"

import { useEffect } from "react"
import { useNativeApp } from "@/hooks/use-native-app"

/** Lets the native shell pick files/camera and inject results into file inputs. */
export function NativeWebBridgeListener() {
  const isNative = useNativeApp()

  useEffect(() => {
    if (!isNative) return

    document.body.classList.add("cc-native-app")
    document.documentElement.dataset.nativeApp = "true"

    const onMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (!data || data.type !== "NATIVE_FILE_RESULT") return

        const inputId = data.inputId as string | undefined
        const input = inputId ? document.getElementById(inputId) : null
        if (!(input instanceof HTMLInputElement) || input.type !== "file") return

        const filePayload = data.files?.[0]
        if (!filePayload?.base64 || !filePayload?.name) return

        const binary = atob(filePayload.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const file = new File([bytes], filePayload.name, {
          type: filePayload.mimeType || "application/octet-stream",
        })
        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files
        input.dispatchEvent(new Event("change", { bubbles: true }))
      } catch {
        /* ignore malformed bridge messages */
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [isNative])

  useEffect(() => {
    if (!isNative) return

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const input = target?.closest('input[type="file"]') as HTMLInputElement | null
      if (!input) return

      const accept = input.accept || "image/*"
      const capture = input.hasAttribute("capture")
      e.preventDefault()
      e.stopPropagation()

      const payload = {
        type: "NATIVE_PICK_FILE",
        inputId: input.id || undefined,
        accept,
        capture,
      }
      ;(window as Window & { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView?.postMessage(
        JSON.stringify(payload),
      )
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [isNative])

  return null
}
