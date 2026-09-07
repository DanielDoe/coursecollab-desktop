"use client"

import { useRef, useState, type RefObject } from "react"
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImageIcon,
  Loader2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { defaultColumnGridContent } from "@/lib/summer-camp/column-grid"
import { defaultTextBlockContent } from "@/lib/summer-camp/text-block-layout"

export function wrapTextareaSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "text",
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const cursor = start + before.length + selected.length + after.length
  return { next, cursor }
}

export function insertAtTextareaCursor(textarea: HTMLTextAreaElement, insert: string) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const next = value.slice(0, start) + insert + value.slice(end)
  const cursor = start + insert.length
  return { next, cursor }
}

export function CampImageUploadField({
  trainingId,
  label,
  value,
  onChange,
  hint,
}: {
  trainingId: number
  label: string
  value: string
  onChange: (url: string) => void
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("trainingId", String(trainingId))
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/summer-camp/upload", {
        method: "POST",
        headers: buildInstructorApiHeaders(),
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        onChange(String(data.url ?? ""))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/uploads/summer-camp/... or paste URL"
          className="flex-1 min-w-[200px]"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="ml-1.5">Upload</span>
        </Button>
      </div>
      {value ? (
        <div className="relative w-full max-w-lg aspect-video overflow-hidden rounded-lg border border-dashboard-v2-border bg-slate-50 dark:bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-contain p-2" />
        </div>
      ) : null}
    </div>
  )
}

export function CampMarkdownToolbar({
  textareaRef,
  value,
  onChange,
  trainingId,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
  trainingId: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const applyWrap = (before: string, after: string, placeholder?: string) => {
    const el = textareaRef.current
    if (!el) return
    const { next, cursor } = wrapTextareaSelection(el, before, after, placeholder)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const insertImage = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("trainingId", String(trainingId))
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/summer-camp/upload", {
        method: "POST",
        headers: buildInstructorApiHeaders(),
        body: fd,
      })
      if (!res.ok) return
      const data = await res.json()
      const url = String(data.url ?? "")
      if (!url) return
      const el = textareaRef.current
      if (!el) return
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
      const insert = `\n\n![${alt}](${url})\n\n`
      const { next, cursor } = insertAtTextareaCursor(el, insert)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(cursor, cursor)
      })
    } finally {
      setUploading(false)
    }
  }

  const tools = [
    { icon: Bold, label: "Bold", action: () => applyWrap("**", "**", "bold text") },
    { icon: Italic, label: "Italic", action: () => applyWrap("*", "*", "italic text") },
    {
      icon: Heading2,
      label: "Section heading",
      action: () => applyWrap("\n## Section N — ", "\n", "Title"),
    },
    { icon: Heading3, label: "Subheading", action: () => applyWrap("\n### ", "\n", "Subsection title") },
    { icon: List, label: "Bullet list", action: () => applyWrap("\n- ", "\n", "List item") },
    { icon: ListOrdered, label: "Numbered list", action: () => applyWrap("\n1. ", "\n", "List item") },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-1.5">
      {tools.map(({ icon: Icon, label, action }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          title={
            label === "Section heading"
              ? "Creates a new accordion section (## Section N — Title)"
              : label === "Subheading"
                ? "Subsection within current section (recommended)"
                : label
          }
          onClick={action}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void insertImage(file)
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-8 px-2", uploading && "opacity-60")}
        title="Insert image"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </Button>
      <span className="text-[10px] text-slate-400 ml-1 hidden sm:inline">Markdown supported</span>
    </div>
  )
}

/** Block types TAs use most often for content updates */
export const CAMP_CONTENT_BLOCK_TYPES = ["text", "image", "image_gallery", "callout", "column_grid"] as const

export const CAMP_CONTENT_BLOCK_LABELS: Record<string, string> = {
  text: "Text + image columns",
  image: "Single image",
  image_gallery: "Image gallery",
  callout: "Tip / note",
  column_grid: "Grid layout (rows × cols)",
}

export type CampContentTemplate = {
  id: string
  label: string
  type: (typeof CAMP_CONTENT_BLOCK_TYPES)[number]
  content: Record<string, unknown>
  hint?: string
}

/** Prefilled blocks that match seeded curriculum patterns (### subheads, bullets, callout colors). */
export const CAMP_CONTENT_TEMPLATES: CampContentTemplate[] = [
  {
    id: "setup_instructions",
    label: "Setup instructions",
    type: "text",
    hint: "Subsection + bullets + empty image column on the right",
    content: defaultTextBlockContent(
      "### Step Title\n\nBrief intro for campers.\n\n- First action\n- Second action\n- Third action\n\n**Common Mistake:** Describe what often goes wrong and how to avoid it.",
    ),
  },
  {
    id: "what_to_look_for",
    label: "What to look for",
    type: "text",
    hint: "Checklist-style bullets with image column",
    content: defaultTextBlockContent(
      "### What To Look For\n\nWhen reviewing this step, confirm:\n\n- Item one\n- Item two\n- Item three",
    ),
  },
  {
    id: "learning_objectives",
    label: "Learning objectives",
    type: "text",
    hint: "Matches module objective blocks",
    content: defaultTextBlockContent(
      "### Learning Objectives\n\nBy the end of this section you will:\n\n- Objective one\n- Objective two\n- Objective three",
    ),
  },
  {
    id: "new_section",
    label: "New module section",
    type: "text",
    hint: "Creates an accordion section (## heading)",
    content: defaultTextBlockContent(
      "## Section N — Section Title\n\nIntro paragraph for this section.\n\n### Subsection Title\n\n- Bullet one\n- Bullet two",
    ),
  },
  {
    id: "tip_callout",
    label: "Tip callout",
    type: "callout",
    content: {
      variant: "tip",
      text: "💡 Helpful tip: Add guidance that helps campers complete this step successfully.",
    },
  },
  {
    id: "warning_callout",
    label: "Engineering warning",
    type: "callout",
    content: {
      variant: "warning",
      text: "⚠ **Engineering Best Practice:** Describe a safety or data-loss precaution before proceeding.",
    },
  },
  {
    id: "text_image_columns",
    label: "Multi-row grid",
    type: "column_grid",
    hint: "Full grid — add rows/columns, drag dividers, mix text and images",
    content: defaultColumnGridContent() as unknown as Record<string, unknown>,
  },
  {
    id: "setup_photo",
    label: "Setup photo",
    type: "image",
    content: {
      imageUrl: "",
      caption: "Describe what campers should see in this photo",
      alt: "Setup reference photo",
    },
  },
  {
    id: "step_gallery",
    label: "Step-by-step photos",
    type: "image_gallery",
    content: {
      cards: [
        { title: "Step 1", description: "Describe this step", imageUrl: "" },
        { title: "Step 2", description: "Describe this step", imageUrl: "" },
      ],
    },
  },
]
