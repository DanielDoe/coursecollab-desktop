"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Maximize2,
  Minimize2,
  PanelRight,
  PanelRightClose,
  Settings,
  SquarePen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { EnhancedAIChat } from "@/components/enhanced-ai-chat"
import { CoraSessionSidebar } from "@/components/cora/CoraSessionSidebar"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type {
  CoraWorkspaceSessionController,
  CoraWorkspaceSessionSnapshot,
} from "@/lib/cora/session-artifacts"
import type { CoraTutorPreferences } from "@/lib/cora/preferences-storage"

type Props = {
  studentId: string
  studentFirstName?: string
  learningMemory: Record<string, boolean>
  tutorPreferences?: CoraTutorPreferences | null
  membershipTier?: import("@/lib/membership-constants").MembershipTier | null
  bootstrap?: import("@/components/cora/platform/CoraDashboard").CoraWorkspaceBootstrap | null
  preparedStudentContext?: import("@/lib/cora/fetch-student-context").CoraStudentContextPayload | null
  onOpenSettings: () => void
  fillHeight?: boolean
  immersive?: boolean
  onToggleImmersive?: () => void
  onCoraNavigate?: (tab: import("@/lib/cora/platform-nav").CoraPlatformTab, toolId?: string) => void
  onAppNavigate?: (href: string) => void
}

const EMPTY_SESSION: CoraWorkspaceSessionSnapshot = { messages: [], artifacts: [], savedConversations: [] }

export function CoraWorkspacePanel({
  studentId,
  studentFirstName,
  learningMemory,
  tutorPreferences = null,
  membershipTier = null,
  bootstrap = null,
  preparedStudentContext = null,
  onOpenSettings,
  fillHeight = false,
  immersive = false,
  onToggleImmersive,
  onCoraNavigate,
  onAppNavigate,
}: Props) {
  const { toast } = useToast()
  const [artifactsOpen, setArtifactsOpen] = useState(true)
  const [sessionSnapshot, setSessionSnapshot] = useState<CoraWorkspaceSessionSnapshot>(EMPTY_SESSION)
  const [isExporting, setIsExporting] = useState(false)
  const [topbarHeight, setTopbarHeight] = useState(64)
  const workspaceSessionRef = useRef<CoraWorkspaceSessionController | null>(null)

  useEffect(() => {
    if (!immersive) return
    const measure = () => {
      const topbar = document.querySelector("[data-dashboard-topbar]")
      setTopbarHeight(
        topbar instanceof HTMLElement ? Math.ceil(topbar.getBoundingClientRect().height) : 64,
      )
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [immersive])

  const handleSessionChange = useCallback((snapshot: CoraWorkspaceSessionSnapshot) => {
    setSessionSnapshot(snapshot)
  }, [])

  const scrollToMessage = useCallback((messageId: string) => {
    workspaceSessionRef.current?.scrollToMessage(messageId)
  }, [])

  const loadSavedConversation = useCallback((conversationId: string) => {
    workspaceSessionRef.current?.loadSavedConversation(conversationId)
  }, [])

  const startNewConversation = useCallback(() => {
    workspaceSessionRef.current?.startNewConversation()
  }, [])

  const archiveConversation = useCallback((conversationId: string) => {
    workspaceSessionRef.current?.archiveConversation?.(conversationId)
  }, [])

  const restoreConversation = useCallback((conversationId: string) => {
    workspaceSessionRef.current?.restoreConversation?.(conversationId)
  }, [])

  const permanentlyDeleteConversation = useCallback((conversationId: string) => {
    workspaceSessionRef.current?.deleteConversation?.(conversationId)
  }, [])

  const renameConversation = useCallback((conversationId: string, title: string) => {
    workspaceSessionRef.current?.renameConversation?.(conversationId, title)
  }, [])

  const handleExportToNotes = useCallback(async () => {
    const exportMessages = workspaceSessionRef.current?.getExportMessages() ?? []
    if (exportMessages.length === 0) {
      toast({ title: "Nothing to export", description: "Start a conversation first." })
      return
    }
    setIsExporting(true)
    try {
      const res = await fetch("/api/cora/workspace-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export_note",
          confirmed: true,
          messages: exportMessages.map((m) => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Export failed")
      toast({
        title: "Saved to My Notes",
        description: data.title ?? "Chat exported successfully.",
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }, [toast])

  return (
    <div
      className={cn(
        "relative grid min-h-0 grid-rows-1 gap-0 overflow-hidden bg-[#fafbfc] dark:bg-[var(--cc-background)]",
        immersive
          ? "fixed inset-x-0 bottom-0 z-40 rounded-none border-0"
          : fillHeight
            ? "h-full min-h-0 flex-1"
            : "h-[min(84vh,900px)] max-h-[900px] rounded-3xl border border-neutral-200/70 dark:border-[var(--border)]",
        artifactsOpen ? "lg:grid-cols-[1fr_260px]" : "lg:grid-cols-1",
      )}
      style={immersive ? { top: topbarHeight } : undefined}
      role={immersive ? "dialog" : undefined}
      aria-modal={immersive ? true : undefined}
      aria-label={immersive ? "Cora immersive workspace" : undefined}
    >
      {!immersive ? (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_at_top,#e8f0fe_0%,transparent_50%)] opacity-70 dark:opacity-25" />
      ) : null}

      <CardWrapper
        variant="inner"
        delay={0}
        hover={false}
        className="relative h-full min-h-0 overflow-visible rounded-none border-0 bg-transparent shadow-none"
        contentClassName="flex h-full min-h-0 flex-col"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200/60 px-5 py-3.5 dark:border-[var(--border)]/80">
          <div>
            <p className="text-sm font-medium text-neutral-800 dark:text-[var(--cc-text)]">
              {immersive ? "cora workspace" : "Workspace"}
            </p>
            <p className="text-xs text-neutral-500 dark:text-[var(--cc-text-muted)]">
              {immersive ? "Immersive learning · Esc to exit" : "Ask · explore · build understanding"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-2.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-white/[0.06] sm:inline-flex"
              onClick={startNewConversation}
            >
              <SquarePen className="mr-1 h-3.5 w-3.5" />
              New chat
            </Button>
            {onToggleImmersive ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                onClick={onToggleImmersive}
                aria-label={immersive ? "Exit immersive workspace" : "Expand workspace"}
                title={immersive ? "Exit immersive (Esc)" : "Expand workspace"}
              >
                {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden rounded-full hover:bg-neutral-100 dark:hover:bg-white/[0.06] lg:inline-flex"
              onClick={() => setArtifactsOpen((open) => !open)}
              aria-label={artifactsOpen ? "Hide session artifacts" : "Show session artifacts"}
              aria-pressed={artifactsOpen}
            >
              {artifactsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <EnhancedAIChat
            studentId={studentId}
            studentFirstName={studentFirstName}
            hideHeader
            hideFooter={false}
            workspaceMode
            className="min-h-0 flex-1 bg-transparent"
            onSettingsClick={onOpenSettings}
            learningMemory={learningMemory}
            tutorPreferences={tutorPreferences}
            membershipTier={membershipTier}
            bootstrap={bootstrap}
            preparedStudentContext={preparedStudentContext}
            onWorkspaceSessionChange={handleSessionChange}
            workspaceSessionRef={workspaceSessionRef}
            onCoraNavigate={onCoraNavigate}
            onAppNavigate={onAppNavigate}
          />
        </div>
      </CardWrapper>

      {artifactsOpen ? (
        <div className="relative hidden min-h-0 lg:block">
          <CoraSessionSidebar
            snapshot={sessionSnapshot}
            onScrollToMessage={scrollToMessage}
            onLoadSavedConversation={loadSavedConversation}
            onStartNewConversation={startNewConversation}
            onArchiveConversation={archiveConversation}
            onRestoreConversation={restoreConversation}
            onDeleteConversation={permanentlyDeleteConversation}
            onRenameConversation={renameConversation}
            onExportToNotes={handleExportToNotes}
            isExporting={isExporting}
            onClose={() => setArtifactsOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
