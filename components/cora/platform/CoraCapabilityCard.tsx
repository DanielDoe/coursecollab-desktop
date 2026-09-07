"use client"

import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  BookOpen,
  Brain,
  CircuitBoard,
  Code2,
  Layers,
  NotebookPen,
  Target,
  Trophy,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { BubbleDecor } from "@/components/ui/bubble-decor"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"
import type { StudentCoraCapability } from "@/lib/cora/student-capabilities"
import { cn } from "@/lib/utils"

const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  explain: Brain,
  circuit: CircuitBoard,
  "code-help": Code2,
  exam: Trophy,
  homework: NotebookPen,
  flashcards: Layers,
  lecture: BookOpen,
  plan: Target,
}

export function coraCapabilityIcon(id: string): LucideIcon {
  return CAPABILITY_ICONS[id] ?? Brain
}

export function CoraCapabilityCard({
  capability,
  thumb,
  index = 0,
  onClick,
}: {
  capability: StudentCoraCapability
  thumb: SolidListThumb
  index?: number
  onClick: () => void
}) {
  const Icon = coraCapabilityIcon(capability.id)

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        "group relative flex h-full min-h-[7.5rem] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-left",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_rgba(0,0,0,0.07)] dark:border-white/[0.06] dark:shadow-none",
        "transition-all duration-300 ease-out hover:-translate-y-0.5",
      )}
      style={{
        boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 8px 22px -6px ${thumb.fill}45`,
      }}
    >
      <BubbleDecor color={thumb.fill} />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${thumb.fill} 14%, transparent), transparent 58%)`,
        }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-w-0 items-center gap-3 pr-11">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-md ring-1 ring-black/[0.06] transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundColor: thumb.fill,
              color: thumb.icon,
              boxShadow: `0 6px 16px -4px ${thumb.fill}55`,
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-snug text-[var(--cc-text)]">{capability.title}</p>
            <p className="text-xs leading-relaxed text-[var(--cc-text-muted)] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
              {capability.description}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full",
            "transition-transform duration-300 ease-out group-hover:scale-110 group-hover:translate-x-0.5",
          )}
          style={{
            backgroundColor: thumb.fill,
            color: thumb.icon,
            boxShadow: `0 6px 16px -2px ${thumb.fill}66`,
          }}
          aria-hidden
        >
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </motion.button>
  )
}
