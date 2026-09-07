"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CampImageUploadField } from "@/components/summer-camp/camp-content-editor-tools"
import { CampBlockRenderer } from "@/components/summer-camp/CampBlockRenderer"
import {
  applyMediaItemsToContent,
  getInteractiveMediaConfig,
  readInteractiveMediaItems,
  type InteractiveMediaItem,
} from "@/lib/summer-camp/interactive-media-items"

type Props = {
  variant: string
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  trainingId: number
}

function newItemId(variant: string, index: number): string {
  if (variant === "face_eye_sample_gallery") return `sample:${Date.now()}-${index}`
  return `custom:${Date.now()}-${index}`
}

export function CampInteractiveMediaEditor({ variant, value, onChange, trainingId }: Props) {
  const config = getInteractiveMediaConfig(variant)
  const items = readInteractiveMediaItems(variant, value)
  const minItems = config.minItems ?? 0

  const updateItems = (next: InteractiveMediaItem[]) => {
    onChange(applyMediaItemsToContent(variant, value, next))
  }

  const grouped = items.reduce<Record<string, InteractiveMediaItem[]>>((acc, item) => {
    const group = item.group ?? "Photos"
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Add, remove, or upload images for each item. Only items with an uploaded image appear to campers
        (unless the block shows placeholders).
      </p>
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          {group !== "Photos" ? (
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{group}</p>
          ) : null}
          {groupItems.map((item) => {
            const index = items.indexOf(item)
            return (
              <div
                key={`${item.id}-${index}`}
                className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    {config.itemLabel} {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-red-500 hover:text-red-600"
                    disabled={items.length <= minItems}
                    onClick={() => updateItems(items.filter((_, j) => j !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="ml-1">Remove</span>
                  </Button>
                </div>
                <Input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...next[index], label: e.target.value }
                    updateItems(next)
                  }}
                  placeholder="Label"
                />
                {config.allowCaption ? (
                  <Textarea
                    value={item.caption ?? ""}
                    onChange={(e) => {
                      const next = [...items]
                      next[index] = { ...next[index], caption: e.target.value }
                      updateItems(next)
                    }}
                    placeholder="Caption (optional)"
                    rows={2}
                  />
                ) : null}
                <CampImageUploadField
                  trainingId={trainingId}
                  label="Image"
                  value={String(item.imageUrl ?? "")}
                  onChange={(url) => {
                    const next = [...items]
                    next[index] = { ...next[index], imageUrl: url }
                    updateItems(next)
                  }}
                />
              </div>
            )
          })}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          updateItems([
            ...items,
            {
              id: newItemId(variant, items.length),
              label: `New ${config.itemLabel.toLowerCase()}`,
              kind: variant === "face_eye_sample_gallery" ? "sample" : "field",
            },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        Add {config.itemLabel.toLowerCase()}
      </Button>
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 dark:bg-white/[0.02]">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">Preview</p>
        <CampBlockRenderer
          block={{
            id: -1,
            module_id: 0,
            block_type: "interactive",
            content: applyMediaItemsToContent(variant, value, items),
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
