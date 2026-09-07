"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Lightbulb } from "lucide-react"
import type { CoraHintLevel, CoraStep } from "@/lib/cora/step-engine/types"

const HINT_LABELS: Record<CoraHintLevel, string> = {
  small: "Small hint",
  medium: "Medium hint",
  almost: "Almost there",
  step: "Show this step",
  solution: "Reveal solution",
}

type Props = {
  step: CoraStep
  onHint: (level: CoraHintLevel, text: string) => void
  disabled?: boolean
}

export function CoraHintMenu({ step, onHint, disabled }: Props) {
  const hints = step.hints ?? []
  if (!hints.length || disabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Lightbulb className="h-4 w-4" />
          Hint
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {hints.map((h) => (
          <DropdownMenuItem key={h.level} onClick={() => onHint(h.level, h.text)}>
            {HINT_LABELS[h.level]}
            {h.creditCost ? (
              <span className="ml-auto text-[10px] text-[var(--cc-text-muted)]">{h.creditCost} cr</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
