"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Eye, Loader2, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampBlockEditor } from "@/components/summer-camp/CampBlockEditor"
import { CampModuleCamperPreviewDialog } from "@/components/summer-camp/CampModuleCamperPreviewDialog"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"
import { TrainingPublishActions } from "@/components/summer-camp/CampPublishControls"
import { campModuleBreadcrumbLabel } from "@/lib/summer-camp/breadcrumb-labels"
import type { CampBlockType, CampModuleBlock } from "@/lib/summer-camp/types"
import { normalizeBlockContent, normalizeCampModuleBlock } from "@/lib/summer-camp/block-content"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

type ModuleMeta = {
  id: number
  title: string
  status: string
  training_id: number
  training_title: string
  project_kind?: string
  project_title?: string
}

export default function InstructorSummerCampModuleEditPage() {
  const params = useParams()
  const { confirm } = useAppConfirm()
  const moduleId = params.moduleId as string
  const [moduleMeta, setModuleMeta] = useState<ModuleMeta | null>(null)
  const [titleDraft, setTitleDraft] = useState("")
  const [blocks, setBlocks] = useState<CampModuleBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingTitle, setSavingTitle] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const jsonHeaders = { ...buildInstructorApiHeaders(), "Content-Type": "application/json" }

  const loadBlocks = useCallback(async () => {
    setLoadError(null)
    const res = await instructorApiFetch(`/api/instructor/summer-camp/blocks?moduleId=${moduleId}`, {
      headers: buildInstructorApiHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      const rows = (data.blocks ?? []) as CampModuleBlock[]
      setBlocks(rows.map((b) => normalizeCampModuleBlock(b)))
      if (data.module) {
        setModuleMeta(data.module as ModuleMeta)
        setTitleDraft(String(data.module.title ?? ""))
      }
      return
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setLoadError(data.error ?? `Could not load module content (${res.status})`)
  }, [moduleId])

  useEffect(() => {
    void loadBlocks().finally(() => setLoading(false))
  }, [loadBlocks])

  const addBlock = async (type: CampBlockType, content: Record<string, unknown>, sortOrder: number) => {
    await instructorApiFetch("/api/instructor/summer-camp/blocks", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ module_id: Number(moduleId), block_type: type, content, sort_order: sortOrder }),
    })
    await loadBlocks()
  }

  const updateBlock = async (blockId: number, content: Record<string, unknown>, sortOrder?: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...content } } : b)),
    )

    const res = await instructorApiFetch("/api/instructor/summer-camp/blocks", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ block_id: blockId, content, sort_order: sortOrder }),
    })

    if (!res.ok) {
      await loadBlocks()
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? `Save failed (${res.status})`)
    }

    const data = (await res.json()) as { block?: CampModuleBlock }
    if (data.block) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? normalizeCampModuleBlock(data.block!) : b)),
      )
      return normalizeCampModuleBlock(data.block)
    }

    await loadBlocks()
    return null
  }

  const moveBlock = async (blockId: number, direction: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === blockId)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= blocks.length) return
    const current = blocks[idx]
    const neighbor = blocks[swapIdx]
    await Promise.all([
      updateBlock(current.id, current.content as Record<string, unknown>, neighbor.sort_order),
      updateBlock(neighbor.id, neighbor.content as Record<string, unknown>, current.sort_order),
    ])
  }

  const deleteBlock = async (blockId: number) => {
    const ok = await confirm({
      title: "Delete this block?",
      description: "This removes the block from the module.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    await instructorApiFetch(`/api/instructor/summer-camp/blocks?blockId=${blockId}`, {
      method: "DELETE",
      headers: buildInstructorApiHeaders(),
    })
    await loadBlocks()
  }

  const saveTitle = async () => {
    if (!titleDraft.trim()) return
    setSavingTitle(true)
    try {
      await instructorApiFetch("/api/instructor/summer-camp/modules", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ module_id: Number(moduleId), title: titleDraft.trim() }),
      })
      await loadBlocks()
    } finally {
      setSavingTitle(false)
    }
  }

  const publishModule = async () => {
    await instructorApiFetch("/api/instructor/summer-camp/modules", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ module_id: Number(moduleId), status: "published" }),
    })
    await loadBlocks()
  }

  const unpublishModule = async () => {
    await instructorApiFetch("/api/instructor/summer-camp/modules", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ module_id: Number(moduleId), status: "draft" }),
    })
    await loadBlocks()
  }

  const trainingId = moduleMeta?.training_id ?? 0
  const isCapstoneModule =
    moduleMeta?.project_kind === "capstone" || moduleMeta?.project_kind === "team_capstone"
  const shortTitle = moduleMeta?.title
    ? campModuleBreadcrumbLabel(moduleMeta.title)
    : `Lesson ${moduleId}`

  if (loading) {
    return (
      <FacultySummerCampShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </FacultySummerCampShell>
    )
  }

  return (
    <FacultySummerCampShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link
          href={
            trainingId
              ? `/faculty/dashboard/summer-camp/training/${trainingId}${isCapstoneModule ? "?tab=projects" : ""}`
              : "/faculty/dashboard/summer-camp"
          }
          className="inline-flex items-center gap-1 text-sm text-dashboard-v2-muted hover:text-violet-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {isCapstoneModule ? "projects" : "training"}
        </Link>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {blocks.length === 0 ? (
            <Button variant="outline" size="sm" disabled>
              <Presentation className="h-4 w-4 mr-1.5" />
              Lecture mode
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/faculty/dashboard/summer-camp/module/${moduleId}/lecture`}>
                <Presentation className="h-4 w-4 mr-1.5" />
                Lecture mode
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={blocks.length === 0}>
            <Eye className="h-4 w-4 mr-1.5" />
            Preview as camper
          </Button>
          <TrainingPublishActions
            status={moduleMeta?.status ?? "draft"}
            publishLabel="Publish module"
            onPublish={() => void publishModule()}
            onUnpublish={() => void unpublishModule()}
            className="ml-0"
          />
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <p className="text-xs text-dashboard-v2-muted uppercase tracking-wide">
          {moduleMeta?.training_title ?? "Summer Camp"}
        </p>
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            className="min-w-0 flex-1 w-auto text-base font-semibold"
            placeholder="Module title"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={savingTitle}
            onClick={() => void saveTitle()}
          >
            {savingTitle ? "Saving…" : "Save title"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-dashboard-v2-muted mb-4">
        {isCapstoneModule ? (
          <>
            Edit capstone project lesson blocks — markdown sections, code labs, checkpoints, and interactive
            placeholders. Use <strong>Quick add content</strong> to append blocks. Changes save to the live project
            for campers.
          </>
        ) : (
          <>
            Use <strong>Quick add content</strong> for new text or photo blocks. Drag images directly in the
            camper view on text, image, and grid blocks — layout auto-saves. Click <strong>Edit</strong> for
            markdown, captions, and uploads. Use arrows to reorder blocks.
          </>
        )}
      </p>

      {loadError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
          {loadError}
        </div>
      ) : null}

      {trainingId > 0 ? (
        <CampBlockEditor
          blocks={blocks}
          trainingId={trainingId}
          onAdd={addBlock}
          onUpdate={async (blockId, content) => {
            await updateBlock(blockId, content)
          }}
          onDelete={deleteBlock}
          onMove={moveBlock}
        />
      ) : (
        <p className="text-slate-500">Could not load training context for uploads.</p>
      )}

      <CampModuleCamperPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        moduleTitle={titleDraft.trim() || moduleMeta?.title || shortTitle}
        trainingTitle={moduleMeta?.training_title}
        blocks={blocks}
      />
    </FacultySummerCampShell>
  )
}
