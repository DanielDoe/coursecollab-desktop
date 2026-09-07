"use client"

import { useEffect, useMemo } from "react"
import { CampInteractiveMediaEditor } from "@/components/summer-camp/CampInteractiveMediaEditor"
import { CampBlockRenderer } from "@/components/summer-camp/CampBlockRenderer"
import {
  hasInteractiveMediaEditor,
  normalizeInteractiveMediaContent,
} from "@/lib/summer-camp/interactive-media-items"

export function CampInteractiveBlockEditor({
  value,
  onChange,
  trainingId,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  trainingId: number
}) {
  const variant = String(value.variant ?? "")

  const normalizedValue = useMemo(
    () => (hasInteractiveMediaEditor(variant) ? normalizeInteractiveMediaContent(variant, value) : value),
    [variant, value],
  )

  useEffect(() => {
    if (!hasInteractiveMediaEditor(variant)) return
    if (Array.isArray(value.mediaItems)) return
    onChange(normalizeInteractiveMediaContent(variant, value))
  }, [variant, value, onChange])

  if (hasInteractiveMediaEditor(variant)) {
    return (
      <CampInteractiveMediaEditor
        variant={variant}
        value={normalizedValue}
        onChange={onChange}
        trainingId={trainingId}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        This interactive block has no editable photo slots. Use <strong>Image</strong> or{" "}
        <strong>Image gallery</strong> blocks nearby, or contact an admin if you need a new layout variant.
      </p>
      <div className="rounded-lg border border-slate-200/80 p-3 bg-slate-50/50 dark:bg-white/[0.02]">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Preview</p>
        <CampBlockRenderer
          block={{
            id: -1,
            module_id: 0,
            block_type: "interactive",
            content: value,
            sort_order: 0,
            created_at: "",
            updated_at: "",
          }}
          readOnly
        />
      </div>
    </div>
  )
}
