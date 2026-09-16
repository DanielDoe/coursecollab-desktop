"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton={false}
      richColors={false}
      expand={false}
      visibleToasts={4}
      gap={12}
      offset={16}
      style={{ "--width": "380px" } as CSSProperties}
      toastOptions={{
        unstyled: true,
        className: "cc-system-alert-sonner-wrap",
      }}
      {...props}
    />
  )
}

export { Toaster }
