"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { CodebenchEditorSkeleton } from "@/components/codebench/CodebenchSkeletons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CodeBenchPage = dynamic(
  () => import("@/app/student/codebench/page").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CodebenchEditorSkeleton className="min-h-[320px] flex-1" />,
  },
)

type Props = {
  className?: string
  /** Prefer starting a specific AI tool tab when the editor mounts. */
  initialTool?: string | null
  /** Bind a classroom assignment (live session join) when the editor mounts. */
  initialAssignmentId?: string | null
}

export function CodebenchInlineEditor({ className, initialTool = null, initialAssignmentId = null }: Props) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (initialTool) {
      try {
        sessionStorage.setItem("codebench_hub_tool", initialTool)
      } catch {
        // ignore
      }
    }
  }, [initialTool])

  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded])

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]",
        expanded
          ? "fixed inset-3 z-[70] shadow-2xl sm:inset-4"
          : "h-full min-h-0 flex-1",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CodeBenchPage
          embedded
          initialAssignmentId={initialAssignmentId}
          toolbarEnd={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Exit immersive editor" : "Expand editor"}
              title={expanded ? "Exit immersive (Esc)" : "Expand editor"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          }
        />
      </div>
    </div>
  )
}
