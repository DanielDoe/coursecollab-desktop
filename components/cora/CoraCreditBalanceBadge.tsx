"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Props = {
  userId: number | string | null
  role: "student" | "instructor" | "admin"
  usageHref?: string
  className?: string
}

function balanceHeaders(role: Props["role"], userId: number | string): HeadersInit {
  if (role === "admin") return { "x-admin-id": String(userId) }
  if (role === "instructor") return { "x-instructor-id": String(userId) }
  return { "x-student-id": String(userId) }
}

export function CoraCreditBalanceBadge({
  userId,
  role,
  usageHref =
    role === "student"
      ? "/student/dashboard-v2/membership#cora-usage"
      : role === "instructor"
        ? "/instructor/membership#cora-usage"
        : "/admin/dashboard-v2/finance/cora-costs",
  className,
}: Props) {
  const [credits, setCredits] = useState<number | null>(null)
  const [mode, setMode] = useState<"premium" | "lite" | null>(null)
  const [isLow, setIsLow] = useState(false)
  const [isCritical, setIsCritical] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/cora/credits/balance?role=${role === "admin" ? "admin" : role}`, {
          headers: balanceHeaders(role, userId),
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setCredits(typeof data.credits === "number" ? data.credits : 0)
        setMode(data.coraMode === "lite" ? "lite" : "premium")
        setIsLow(Boolean(data.isLow))
        setIsCritical(Boolean(data.isCritical))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, role])

  if (credits == null) return null

  const label =
    mode === "lite"
      ? "Cora Lite · Premium credits used"
      : `Cora · ${credits.toLocaleString()} credits remaining`
  const thumb = solidListThumb(mode === "lite" ? 2 : isCritical || isLow ? 4 : 1)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={usageHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90",
              className,
            )}
            style={{
              backgroundColor: `${thumb.fill}22`,
              borderColor: `${thumb.fill}55`,
              color: thumb.fill,
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            {label}
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p className="font-medium">Cora Credits</p>
          <p className="mt-1 text-muted-foreground">
            {mode === "lite"
              ? "Premium credits used. Cora Lite can still help with simple study questions."
              : isCritical
                ? "You're almost out of premium Cora Credits. Tap to add credits."
                : isLow
                  ? "Your Cora Credits are getting low. Tap to add credits."
                  : "Tap to view included vs purchased credits and add a pack."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
