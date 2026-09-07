"use client"

import type React from "react"
import { AppearanceProvider } from "@/components/appearance/AppearanceProvider"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <AppearanceProvider>{children}</AppearanceProvider>
}
