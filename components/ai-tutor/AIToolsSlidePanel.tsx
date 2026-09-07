"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { StudioToolChatPanel } from "@/components/ai-tutor/StudioToolChatPanel"
import { StudyNotesWorkspacePanel } from "@/components/ai-tutor/StudyNotesWorkspacePanel"
import { CoraStudyPlanPanel } from "@/components/cora/platform/CoraStudyPlanPanel"
import { Button } from "@/components/ui/button"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import { getStudioToolChatConfig, isStudioToolChat } from "@/lib/cora/studio-tool-chat"

interface AIToolsSlidePanelProps {
  toolId: string
  onClose: () => void
  studentId: string
  studentDatabaseId?: number | null
  studentFirstName?: string
  studentContext?: CoraStudentContextPayload | null
  onNavigate?: (tab: CoraPlatformTab) => void
  autoStart?: boolean
}

export function AIToolsSlidePanel({
  toolId,
  onClose,
  studentId,
  studentDatabaseId,
  studentFirstName,
  studentContext = null,
  onNavigate,
  autoStart = true,
}: AIToolsSlidePanelProps) {
  const { soft, accent } = useCoraContentPalette()
  const config = getStudioToolChatConfig(toolId)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  if (!isStudioToolChat(toolId) || !config) return null

  const isPlan = config.drawerKind === "interactive-plan"
  const isNotes = config.drawerKind === "interactive-notes"
  const Icon = config.icon

  return (
    <AnimatePresence>
      <motion.div
        key="ai-tools-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm"
      />

      <motion.div
        key={`ai-tools-panel-${toolId}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-16 z-[70] flex h-[calc(100vh-4rem)] w-full flex-col shadow-2xl md:w-[72%] lg:w-[64%]"
        style={{ background: "var(--cc-background)", color: "var(--cc-text)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isNotes ? (
          <StudyNotesWorkspacePanel
            studentId={studentId}
            studentContext={studentContext}
            onClose={onClose}
          />
        ) : isPlan ? (
          <div className="flex h-full min-h-0 flex-col">
            <header
              className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5"
              style={{
                background: soft,
                boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.1)", color: accent }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
                    {config.workspaceLabel ?? "Study plan workspace"}
                  </p>
                  <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                    {config.title}
                  </h2>
                  <p className="truncate text-xs text-[var(--cc-text-muted)]">{config.subtitle}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <CoraStudyPlanPanel
                studentFirstName={studentFirstName}
                studentDatabaseId={studentDatabaseId}
                studentContext={studentContext}
                onNavigate={(tab) => {
                  onClose()
                  onNavigate?.(tab)
                }}
              />
            </div>
          </div>
        ) : (
          <StudioToolChatPanel
            toolId={toolId}
            studentId={studentId}
            onClose={onClose}
            studentContext={studentContext}
            autoStart={autoStart && Boolean(config.autoGenerateOnOpen)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
