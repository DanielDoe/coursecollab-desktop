"use client"

import { usePathname } from "next/navigation"
import {
  getFacultyModuleTheme,
  getFacultyModuleThemeFromPath,
  type FacultyModuleThemeTokens,
} from "@/lib/faculty-module-themes"

export function useFacultyModuleTheme(moduleIdOverride?: string): FacultyModuleThemeTokens {
  const pathname = usePathname() ?? ""
  if (moduleIdOverride) return getFacultyModuleTheme(moduleIdOverride)
  return getFacultyModuleThemeFromPath(pathname)
}
