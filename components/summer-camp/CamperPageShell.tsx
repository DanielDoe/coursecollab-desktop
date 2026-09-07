"use client"

import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import {
  camperPageIcon,
  camperSpinner,
  camperSubtitle,
  camperTitle,
} from "@/lib/summer-camp/camper-ui-theme"
import { cn } from "@/lib/utils"

type Props = {
  icon: LucideIcon
  iconClassName?: string
  title: string
  subtitle?: string
  loading?: boolean
  children?: React.ReactNode
}

export function CamperPageShell({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  loading,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <Loader2 className={cn("h-8 w-8 animate-spin", camperSpinner)} />
      </div>
    )
  }

  return (
    <div data-camper-portal className="space-y-5 sm:space-y-6 w-full min-w-0">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Icon className={cn("h-6 w-6 shrink-0", iconClassName ?? camperPageIcon)} />
          <h1 className={cn("text-xl sm:text-2xl md:text-3xl font-bold", camperTitle)}>{title}</h1>
        </div>
        {subtitle ? <p className={cn("mt-1 text-sm sm:text-base", camperSubtitle)}>{subtitle}</p> : null}
      </motion.div>
      {children}
    </div>
  )
}
