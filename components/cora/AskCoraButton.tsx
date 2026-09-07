"use client"

import { Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildSolveHandoff,
  CORA_SOLVE_HREF,
  writeSolveHandoff,
  type CoraSolveHandoff,
} from "@/lib/cora/solve-handoff"

type Props = {
  handoff: Omit<CoraSolveHandoff, "createdAt">
  label?: string
  className?: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  /** When true, stay in-app if already on Cora (caller should navigate tab). */
  onOpenInPlace?: (handoff: CoraSolveHandoff) => void
}

/**
 * Opens Cora Solve with problem context preloaded.
 * Use from Practice Hub, lectures, homework review, CodeBench, etc.
 */
export function AskCoraButton({
  handoff,
  label = "Ask Cora",
  className,
  variant = "outline",
  size = "sm",
  onOpenInPlace,
}: Props) {
  const router = useRouter()

  const open = () => {
    const payload = buildSolveHandoff(handoff)
    if (onOpenInPlace) {
      writeSolveHandoff(payload)
      onOpenInPlace(payload)
      return
    }
    writeSolveHandoff(payload)
    router.push(CORA_SOLVE_HREF)
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5 rounded-full", className)}
      onClick={open}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
