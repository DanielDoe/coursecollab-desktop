"use client"

import { cn } from "@/lib/utils"
import {
  isBrandLogoIcon,
  resolveLucideIcon,
  type DrawerNavIconName,
} from "@/lib/drawer-nav-icon-map"

/** Drawer / app-bar icons — same Ionicons names + Lucide glyphs as the mobile sidemenu. */
export function DrawerNavIcon({
  name,
  size = 22,
  color,
  className,
  strokeWidth = 2,
}: {
  name: DrawerNavIconName
  size?: number
  color?: string
  className?: string
  strokeWidth?: number
}) {
  if (isBrandLogoIcon(name)) {
    return null
  }

  const Icon = resolveLucideIcon(name)
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      aria-hidden
    />
  )
}

export type { DrawerNavIconName }
