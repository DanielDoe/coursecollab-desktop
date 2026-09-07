"use client"

import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export { motion, AnimatePresence } from "framer-motion"

/** Lightweight page shell — no enter animation (avoids scroll/layout jank on route changes). */
export function PageEnter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("w-full min-w-0", className)} {...props}>
      {children}
    </div>
  )
}
