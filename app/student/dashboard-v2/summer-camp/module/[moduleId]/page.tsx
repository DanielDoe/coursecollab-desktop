"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getStudentData } from "@/lib/auth"
import { CampBlockRenderer, CampDiscussionPanel } from "@/components/summer-camp/CampBlockRenderer"
import {
  CampCollapsibleModuleSection,
  CampModuleSectionsToolbar,
} from "@/components/summer-camp/CampCollapsibleModuleSection"
import { CampPresentationModuleLayout } from "@/components/summer-camp/CampPresentationModuleLayout"
import { CampModuleEngagement } from "@/components/summer-camp/CampModuleEngagement"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import {
  layoutModuleBlocks,
  shouldOmitLeadingSectionHeading,
  type ModuleLayoutItem,
} from "@/lib/summer-camp/group-module-blocks"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"
import { campModuleBreadcrumbLabel } from "@/lib/summer-camp/breadcrumb-labels"
import {
  canMarkModuleCompleteFromKnowledgeChecks,
  getKnowledgeCheckCompletionGaps,
} from "@/lib/summer-camp/module-completion"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { dashboardV2LessonContentClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type ProgressRow = {
  block_id: number | null
  progress_type: string
  metadata?: Record<string, unknown>
}

export default function SummerCampModulePage() {
  const params = useParams()
  const moduleId = params.moduleId as string
  const session = getStudentData()
  const { setCampModuleBreadcrumbTitle, campModuleFullscreen, setCampModuleFullscreen } = useDashboardV2()
  const moduleRootRef = useRef<HTMLDivElement>(null)

  const [moduleData, setModuleData] = useState<{
    module: {
      id: number
      title: string
      sort_order: number
      training_id: number
      training_title: string
      training_slug?: string
      project_metadata?: { kind?: string } | null
    }
    blocks: CampModuleBlock[]
    progress: ProgressRow[]
    submissions: Array<{ id: number; block_id: number; status: string; feedback?: string | null; file_name?: string | null }>
    nextLesson?: { id: number; title: string } | null
  } | null>(null)
  const [discussions, setDiscussions] = useState<Array<{
    id: number
    title: string | null
    body: string
    status: string
    replies?: Array<{ body: string; author_name?: string; author_type?: string }>
  }>>([])
  const [helpBlockId, setHelpBlockId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [curriculumLock, setCurriculumLock] = useState<{
    completed_modules: number
    total_modules: number
    training_id?: number
  } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [camperProfile, setCamperProfile] = useState<Record<string, unknown>>({})
  const [moduleRewards, setModuleRewards] = useState<{
    xp?: number
    badges?: string[]
    nextModule?: string
    nextLesson?: { id: number; title: string } | null
  } | null>(null)
  const [showSupportForm, setShowSupportForm] = useState(false)
  const [supportDraft, setSupportDraft] = useState({ issue: "", mentor: "yes" })
  const [supportSending, setSupportSending] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [allSectionsExpanded, setAllSectionsExpanded] = useState(false)

  const layoutItems = useMemo(
    () => (moduleData ? layoutModuleBlocks(moduleData.blocks) : []),
    [moduleData],
  )

  const sectionGroups = useMemo(
    () =>
      layoutItems
        .filter((item): item is Extract<ModuleLayoutItem, { type: "section" }> => item.type === "section")
        .map((item) => item.group),
    [layoutItems],
  )

  const sectionIndexByGroupId = useMemo(() => {
    const map = new Map<string, number>()
    let index = 0
    for (const item of layoutItems) {
      if (item.type === "section") {
        map.set(item.group.id, index)
        index += 1
      }
    }
    return map
  }, [layoutItems])

  useEffect(() => {
    if (!moduleData) return
    const initial: Record<string, boolean> = {}
    sectionGroups.forEach((group) => {
      initial[group.id] = true
    })
    setOpenSections(initial)
    setAllSectionsExpanded(true)
  }, [moduleId, moduleData?.module.id, sectionGroups])

  const expandAllSectionsAndScroll = useCallback(() => {
    setOpenSections(Object.fromEntries(sectionGroups.map((group) => [group.id, true])))
    setAllSectionsExpanded(true)
    requestAnimationFrame(() => {
      document.getElementById("camp-module-sections")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [sectionGroups])

  const load = useCallback(async () => {
    if (!session?.databaseId) return
    const [modRes, profileRes] = await Promise.all([
      fetch(`/api/summer-camp/modules/${moduleId}?studentDatabaseId=${session.databaseId}`),
      fetch(`/api/summer-camp/camper-profile?studentDatabaseId=${session.databaseId}`),
    ])
    if (modRes.ok) {
      setModuleData(await modRes.json())
      setAccessError(null)
      setCurriculumLock(null)
    } else {
      const err = await modRes.json().catch(() => ({}))
      if (modRes.status === 403 && err.curriculum_locked) {
        setAccessError(String(err.error ?? "Complete core modules first."))
        setCurriculumLock(err.curriculum ?? null)
      } else {
        setAccessError(
          String(
            err.error ??
              (modRes.status === 404 ? "Module not found." : "Unable to load this module."),
          ),
        )
        setCurriculumLock(null)
      }
      setModuleData(null)
    }
    if (profileRes.ok) {
      const data = await profileRes.json()
      setCamperProfile((data.profile?.profile ?? {}) as Record<string, unknown>)
    }
  }, [session?.databaseId, moduleId])

  const loadDiscussions = useCallback(async (blockId?: number | null) => {
    if (!session?.databaseId) return
    const q = new URLSearchParams({
      moduleId,
      studentDatabaseId: session.databaseId,
    })
    if (blockId != null) q.set("blockId", String(blockId))
    const res = await fetch(`/api/summer-camp/discussions?${q}`)
    if (res.ok) {
      const data = await res.json()
      setDiscussions(data.discussions ?? [])
    }
  }, [session?.databaseId, moduleId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
    void loadDiscussions()
  }, [load, loadDiscussions])

  useEffect(() => {
    if (moduleData?.module) {
      setCampModuleBreadcrumbTitle(
        campModuleBreadcrumbLabel(moduleData.module.title, moduleData.module.sort_order),
      )
    }
    return () => setCampModuleBreadcrumbTitle(null)
  }, [moduleData?.module, setCampModuleBreadcrumbTitle])

  useEffect(() => {
    const onFullscreenChange = () => {
      setCampModuleFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [setCampModuleFullscreen])

  const toggleFullscreen = async () => {
    const el = moduleRootRef.current
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  }

  const completedBlocks = new Set(
    moduleData?.progress
      .filter((p) => p.progress_type === "step_complete" && p.block_id)
      .map((p) => p.block_id!) ?? [],
  )

  const progressByBlock = useMemo(() => {
    const map = new Map<number, Record<string, Record<string, unknown>>>()
    for (const row of moduleData?.progress ?? []) {
      if (!row.block_id) continue
      const entry = map.get(row.block_id) ?? {}
      entry[row.progress_type] = (row.metadata ?? {}) as Record<string, unknown>
      map.set(row.block_id, entry)
    }
    return map
  }, [moduleData?.progress])

  const moduleEngagement = moduleData?.progress.find(
    (p) => p.progress_type === "engagement" && p.block_id == null,
  )?.metadata as { lessonReaction?: string } | undefined

  const submissionByBlock = new Map(
    moduleData?.submissions.map((s) => [s.block_id, s]) ?? [],
  )

  const submissionBlockIds = useMemo(
    () => new Set(moduleData?.submissions.map((s) => s.block_id) ?? []),
    [moduleData?.submissions],
  )

  const knowledgeCheckGaps = useMemo(() => {
    if (!moduleData) return []
    return getKnowledgeCheckCompletionGaps(
      moduleData.blocks,
      progressByBlock,
      completedBlocks,
      submissionBlockIds,
      camperProfile,
    )
  }, [moduleData, progressByBlock, completedBlocks, submissionBlockIds, camperProfile])

  const canMarkComplete = useMemo(() => {
    if (!moduleData) return false
    return canMarkModuleCompleteFromKnowledgeChecks(
      moduleData.blocks,
      progressByBlock,
      completedBlocks,
      submissionBlockIds,
      camperProfile,
    )
  }, [moduleData, progressByBlock, completedBlocks, submissionBlockIds, camperProfile])

  const saveProgress = async (
    blockId: number,
    progressType: string,
    metadata: Record<string, unknown>,
  ) => {
    if (!session?.databaseId) return
    const res = await fetch("/api/summer-camp/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentDatabaseId: session.databaseId,
        moduleId: Number(moduleId),
        blockId,
        progressType,
        metadata,
      }),
    })
    if (res.ok) {
      const { notifyCampXpUpdated } = await import("@/lib/summer-camp/camp-events")
      notifyCampXpUpdated()
    }
    await load()
  }

  const markStep = async (blockId: number) => {
    await saveProgress(blockId, "step_complete", {})
    await load()
  }

  const submitCheckpoint = async (blockId: number, file: File) => {
    if (!session?.databaseId) return
    const fd = new FormData()
    fd.append("studentDatabaseId", session.databaseId)
    fd.append("moduleId", moduleId)
    fd.append("blockId", String(blockId))
    fd.append("file", file)
    const res = await fetch("/api/summer-camp/submissions", { method: "POST", body: fd })
    if (res.ok) {
      const { notifyCampXpUpdated } = await import("@/lib/summer-camp/camp-events")
      notifyCampXpUpdated()
    }
    await load()
  }

  const postDiscussion = async (body: string, parentId?: number, title?: string) => {
    if (!session?.databaseId) return
    await fetch("/api/summer-camp/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentDatabaseId: session.databaseId,
        moduleId: Number(moduleId),
        blockId: helpBlockId,
        body,
        parentId,
        title,
      }),
    })
    await loadDiscussions(helpBlockId)
  }

  const saveModuleReaction = async (emoji: string) => {
    if (!session?.databaseId) return
    await fetch("/api/summer-camp/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentDatabaseId: session.databaseId,
        moduleId: Number(moduleId),
        progressType: "engagement",
        metadata: { lessonReaction: emoji },
      }),
    })
    await load()
  }

  const saveProfile = async (
    patch: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!session?.databaseId) {
      return { ok: false, error: "Please sign in again to save your work." }
    }
    try {
      const res = await fetch("/api/summer-camp/camper-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: session.databaseId, profile: patch }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        profile?: { profile?: Record<string, unknown> }
      }
      if (!res.ok) {
        return {
          ok: false,
          error: String(data.error ?? "Could not save. Please try again."),
        }
      }
      const nested = data.profile?.profile ?? {}
      setCamperProfile(nested as Record<string, unknown>)
      const { notifyCampXpUpdated } = await import("@/lib/summer-camp/camp-events")
      notifyCampXpUpdated()
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error. Check your connection and try again." }
    }
  }

  const submitSupportRequest = async () => {
    if (!session?.databaseId || !supportDraft.issue.trim()) return
    setSupportSending(true)
    try {
      await postDiscussion(
        `Support request:\n\n${supportDraft.issue.trim()}\n\nMentor contact requested: ${supportDraft.mentor === "yes" ? "Yes" : "No"}`,
        undefined,
        "Support Request — Module 0",
      )
      setShowSupportForm(false)
      setSupportDraft({ issue: "", mentor: "yes" })
    } finally {
      setSupportSending(false)
    }
  }

  const completeModule = async () => {
    if (!session?.databaseId) return
    setCompleting(true)
    setCompleteError(null)
    try {
      const res = await fetch("/api/summer-camp/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: session.databaseId,
          moduleId: Number(moduleId),
          progressType: "module_complete",
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.rewards) setModuleRewards(data.rewards)
        const { notifyCampXpUpdated } = await import("@/lib/summer-camp/camp-events")
        notifyCampXpUpdated()
      } else {
        const data = await res.json().catch(() => ({}))
        setCompleteError(
          String(data.error ?? "Complete all required activities before marking this module done."),
        )
      }
      await load()
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-4 max-w-lg mx-auto">
        <p className="font-semibold text-amber-900 dark:text-amber-100">
          {accessError ?? "Module not found."}
        </p>
        {curriculumLock && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Progress: {curriculumLock.completed_modules}/{curriculumLock.total_modules} core modules
          </p>
        )}
        <Button asChild className={camperCta}>
          <Link href={campRoute("/projects")}>Back to Projects</Link>
        </Button>
      </div>
    )
  }

  const isModuleComplete = moduleData.progress.some((p) => p.progress_type === "module_complete")
  const nextLesson = moduleRewards?.nextLesson ?? moduleData.nextLesson ?? null
  const showModuleActions = !isModuleComplete || nextLesson != null
  const projectKind = moduleData.module.project_metadata?.kind ?? ""
  const usePresentationLayout =
    moduleData.module.training_slug === "ai-bootcamp" && projectKind === "curriculum"

  const toggleAllSections = () => {
    const next = !allSectionsExpanded
    setAllSectionsExpanded(next)
    setOpenSections(Object.fromEntries(sectionGroups.map((group) => [group.id, next])))
  }

  const renderModuleBlock = (block: CampModuleBlock, omitLeadingSectionHeading = false) => (
    <CampBlockRenderer
      key={block.id}
      block={block}
      isStepComplete={completedBlocks.has(block.id)}
      isModuleComplete={isModuleComplete}
      moduleRewards={moduleRewards ?? undefined}
      knowledgeCheckGaps={knowledgeCheckGaps}
      submission={submissionByBlock.get(block.id) ?? null}
      blockProgress={progressByBlock.get(block.id)}
      camperProfile={camperProfile}
      omitLeadingSectionHeading={omitLeadingSectionHeading}
      onMarkStep={markStep}
      onSubmitCheckpoint={submitCheckpoint}
      onSaveProgress={saveProgress}
      onSaveProfile={saveProfile}
      onContinueModuleSections={expandAllSectionsAndScroll}
      onOpenSupport={() => {
        setShowSupportForm(true)
        document.getElementById("camp-support-form")?.scrollIntoView({ behavior: "smooth" })
      }}
      onScrollDiscussion={() => {
        document.getElementById("camp-module-discussion")?.scrollIntoView({ behavior: "smooth" })
      }}
      onNeedHelp={(blockId) => {
        setHelpBlockId(blockId)
        void loadDiscussions(blockId)
      }}
    />
  )

  return (
    <div
      ref={moduleRootRef}
      className={cn(
        "space-y-6 w-full min-w-0",
        !campModuleFullscreen && dashboardV2LessonContentClass,
        campModuleFullscreen &&
          "max-w-none min-h-screen overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6 sm:py-6 dark:bg-[#0B1120]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={campRoute(`/training/${moduleData.module.training_id}`)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {moduleData.module.training_title}
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void toggleFullscreen()}
          className="gap-1.5"
        >
          {campModuleFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              Exit fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </>
          )}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{moduleData.module.title}</h1>
        {isModuleComplete && (
          <p className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
            <CheckCircle2 className="h-4 w-4" />
            Module complete
          </p>
        )}
      </div>

      <CampModuleEngagement
        moduleTitle={moduleData.module.title}
        isModuleComplete={isModuleComplete}
        lessonReaction={moduleEngagement?.lessonReaction ?? null}
        onNeedHelp={() => {
          setHelpBlockId(null)
          void loadDiscussions(null)
          document.getElementById("camp-module-discussion")?.scrollIntoView({ behavior: "smooth" })
        }}
        onConfused={() => {
          void postDiscussion(
            "I'm confused about this module and would appreciate faculty support.",
            undefined,
            "I'm confused — faculty alert",
          )
        }}
        onReaction={(emoji) => void saveModuleReaction(emoji)}
      />

      <div id="camp-module-sections" className="space-y-4">
        {usePresentationLayout ? (
          <CampPresentationModuleLayout
            layoutItems={layoutItems}
            renderSectionBlock={(block, omitLeadingSectionHeading) =>
              renderModuleBlock(block, omitLeadingSectionHeading)
            }
            shouldOmitLeadingSectionHeading={shouldOmitLeadingSectionHeading}
            renderKnowledgeCheck={(block) => renderModuleBlock(block)}
          />
        ) : (
          <>
            <CampModuleSectionsToolbar
              sectionCount={sectionGroups.length}
              allExpanded={allSectionsExpanded}
              onToggleAll={toggleAllSections}
            />
            {layoutItems.map((item) => {
              if (item.type === "knowledge_check") {
                return (
                  <div key={`kc-${item.block.id}`} className="py-1">
                    {renderModuleBlock(item.block)}
                  </div>
                )
              }

              const group = item.group
              return (
                <CampCollapsibleModuleSection
                  key={group.id}
                  title={group.title}
                  sectionIndex={sectionIndexByGroupId.get(group.id) ?? 0}
                  blockCount={group.blocks.length}
                  open={openSections[group.id]}
                  onOpenChange={(open) => {
                    setOpenSections((prev) => ({ ...prev, [group.id]: open }))
                    if (!open) setAllSectionsExpanded(false)
                  }}
                >
                  {group.blocks.map((block, blockIndex) =>
                    renderModuleBlock(
                      block,
                      blockIndex === 0 && shouldOmitLeadingSectionHeading(block, group.title),
                    ),
                  )}
                </CampCollapsibleModuleSection>
              )
            })}
          </>
        )}
      </div>

      {showSupportForm && (
        <div
          id="camp-support-form"
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white">Support Request</h3>
          <Textarea
            value={supportDraft.issue}
            onChange={(e) => setSupportDraft((d) => ({ ...d, issue: e.target.value }))}
            placeholder="What do you need help with?"
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={supportDraft.mentor === "yes"}
              onChange={(e) =>
                setSupportDraft((d) => ({ ...d, mentor: e.target.checked ? "yes" : "no" }))
              }
            />
            Would you like a mentor to contact you?
          </label>
          <Input type="file" accept="image/*" className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" disabled={supportSending} onClick={() => void submitSupportRequest()}>
              {supportSending ? "Sending…" : "Submit request"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSupportForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div id="camp-module-discussion">
        <CampDiscussionPanel
          discussions={discussions}
          onSubmit={(body, parentId) => void postDiscussion(body, parentId)}
        />
      </div>

      {showModuleActions && (
        <div className="space-y-3">
          {!isModuleComplete && knowledgeCheckGaps.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-3">
              <p className="font-medium text-sm text-slate-700 dark:text-slate-300">
                Complete these knowledge checks before marking the module done:
              </p>
              <ul className="space-y-2">
                {knowledgeCheckGaps.map((gap) => (
                  <li
                    key={`${gap.blockId}-${gap.label}`}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>{gap.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isModuleComplete && completeError && (
            <p className="text-sm text-red-600 dark:text-red-400">{completeError}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {!isModuleComplete && (
                <Button
                  onClick={() => void completeModule()}
                  disabled={completing || !canMarkComplete}
                  className={cn("w-full sm:w-auto", camperCta)}
                >
                  {completing ? "Saving…" : "Mark module complete"}
                </Button>
              )}
            </div>
            <div>
              {isModuleComplete && nextLesson && (
                <Button asChild className={cn("w-full sm:w-auto", camperCta)}>
                  <Link href={campRoute(`/module/${nextLesson.id}`)}>
                    Next Lesson
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
