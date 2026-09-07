"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Maximize2, Minimize2, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CampBlockRenderer } from "@/components/summer-camp/CampBlockRenderer"
import { CampPresentationModuleLayout } from "@/components/summer-camp/CampPresentationModuleLayout"
import { CampLectureContext } from "@/components/summer-camp/camp-lecture-context"
import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  filterBlocksForLecture,
  layoutLectureModuleBlocks,
} from "@/lib/summer-camp/lecture-mode"
import {
  shouldOmitLeadingSectionHeading,
} from "@/lib/summer-camp/group-module-blocks"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import { normalizeCampModuleBlock } from "@/lib/summer-camp/block-content"
import { cn } from "@/lib/utils"

type ModuleMeta = {
  id: number
  title: string
  training_id: number
  training_title: string
  training_slug?: string
  project_kind?: string
}

type Props = {
  moduleId: string
  backHref?: string
  /** When true, omit faculty shell chrome (embedded / fullscreen). */
  bare?: boolean
}

export function CampLectureModuleView({ moduleId, backHref, bare = false }: Props) {
  const [moduleMeta, setModuleMeta] = useState<ModuleMeta | null>(null)
  const [blocks, setBlocks] = useState<CampModuleBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const res = await instructorApiFetch(`/api/instructor/summer-camp/blocks?moduleId=${moduleId}`, {
      headers: buildInstructorApiHeaders(),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setLoadError(data.error ?? `Could not load module (${res.status})`)
      return
    }
    const data = await res.json()
    const rows = (data.blocks ?? []) as CampModuleBlock[]
    setBlocks(rows.map((b) => normalizeCampModuleBlock(b)))
    if (data.module) setModuleMeta(data.module as ModuleMeta)
  }, [moduleId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const lectureBlocks = useMemo(() => filterBlocksForLecture(blocks), [blocks])
  const layoutItems = useMemo(() => layoutLectureModuleBlocks(blocks), [blocks])
  const skippedCount = blocks.length - lectureBlocks.length

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
      setFullscreen(true)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  const trainingId = moduleMeta?.training_id
  const resolvedBack =
    backHref ??
    (trainingId
      ? `/faculty/dashboard/summer-camp/training/${trainingId}?tab=modules`
      : "/faculty/dashboard/summer-camp")

  const renderSectionBlock = (block: CampModuleBlock, omitLeadingSectionHeading: boolean) => (
    <CampBlockRenderer block={block} readOnly omitLeadingSectionHeading={omitLeadingSectionHeading} />
  )

  const body = (
    <div
      ref={stageRef}
      className={cn(
        "space-y-4 min-w-0 overflow-x-hidden",
        fullscreen && "min-h-screen bg-slate-950 p-3 sm:p-6 overflow-y-auto",
      )}
    >
      {!bare && !fullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={resolvedBack}
            className="inline-flex items-center gap-1.5 text-sm text-dashboard-v2-muted hover:text-violet-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to training
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void toggleFullscreen()} className="gap-1.5">
              {fullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  Exit fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  Present fullscreen
                </>
              )}
            </Button>
            {moduleMeta ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/faculty/dashboard/summer-camp/module/${moduleId}/edit`}>Edit module</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-2xl border px-4 sm:px-6 py-4 sm:py-5",
          fullscreen
            ? "border-white/10 bg-white/5 text-white"
            : "border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-sky-500/10 dark:border-violet-400/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40",
        )}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div
            className={cn(
              "size-11 rounded-xl flex items-center justify-center shrink-0",
              fullscreen ? "bg-white/10" : "bg-[#582c83] text-white shadow-lg",
            )}
          >
            <Presentation className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                fullscreen ? "text-violet-200" : "text-violet-700 dark:text-violet-300",
              )}
            >
              Instructor lecture mode
            </p>
            <h1
              className={cn(
                "text-xl sm:text-2xl font-bold leading-tight mt-0.5",
                fullscreen ? "text-white" : "text-slate-900 dark:text-slate-100",
              )}
            >
              {moduleMeta?.title ?? "Workshop module"}
            </h1>
            {moduleMeta?.training_title ? (
              <p className={cn("text-sm mt-1", fullscreen ? "text-violet-100/80" : "text-slate-600 dark:text-slate-300")}>
                {moduleMeta.training_title}
              </p>
            ) : null}
          </div>
        </div>
        <p
          className={cn(
            "text-xs sm:text-sm mt-3 leading-relaxed",
            fullscreen ? "text-violet-100/90" : "text-slate-600 dark:text-slate-300",
          )}
        >
          Content-only slides for classroom delivery — quizzes, reflections, uploads, and student activities are
          hidden.
          {skippedCount > 0 ? (
            <span className={cn("font-medium", fullscreen ? "text-amber-200" : "text-amber-800")}>
              {" "}
              ({skippedCount} interactive block{skippedCount === 1 ? "" : "s"} omitted)
            </span>
          ) : null}
        </p>
      </div>

      {lectureBlocks.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-8 text-center text-sm text-amber-900 dark:text-amber-200">
          No lecture slides in this module — add text, callouts, hero, or presentational cards.
        </div>
      ) : (
        <CampLectureContext.Provider value={true}>
          <CampPresentationModuleLayout
            mode="lecture"
            layoutItems={layoutItems}
            renderSectionBlock={renderSectionBlock}
            shouldOmitLeadingSectionHeading={shouldOmitLeadingSectionHeading}
            renderKnowledgeCheck={() => null}
            onToggleFullscreen={() => void toggleFullscreen()}
            isFullscreen={fullscreen}
          />
        </CampLectureContext.Provider>
      )}
    </div>
  )

  if (loading) {
    const loader = (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
    return bare ? loader : <FacultySummerCampShell>{loader}</FacultySummerCampShell>
  }

  if (loadError) {
    const err = (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
        {loadError}
      </div>
    )
    return bare ? err : <FacultySummerCampShell>{err}</FacultySummerCampShell>
  }

  if (bare || fullscreen) return body

  return <FacultySummerCampShell>{body}</FacultySummerCampShell>
}
