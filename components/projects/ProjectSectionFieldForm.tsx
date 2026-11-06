"use client"

import { useState } from "react"
import { ImageIcon, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AnnouncementRichTextEditor } from "@/components/announcements/AnnouncementRichTextEditor"
import type { ProjectResponseField } from "@/lib/projects/project-template-types"
import type { SectionContentBlock } from "@/lib/projects/project-template-types"
import { compressUploadImageFile } from "@/lib/media/compress-image-client"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function ImageAnswerField({
  field,
  url,
  onUpload,
  onSaved,
  onClear,
}: {
  field: ProjectResponseField
  url: string
  onUpload?: (file: File, fieldId: string) => Promise<string | null>
  onSaved: (url: string, name: string) => void
  onClear: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-2">
      {url ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={field.label} className="max-h-64 w-full object-contain" />
          <button type="button" className={cn("px-3 py-2 text-xs", PORTAL_TEXT_MUTED)} onClick={onClear}>
            Remove image
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 py-6 text-center">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
          <span className={cn("text-sm font-medium", PORTAL_TEXT)}>{busy ? "Preparing image…" : "Upload an image"}</span>
          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>PNG, JPEG, or WebP. It is resized before upload.</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file || !onUpload) return
              setBusy(true)
              void (async () => {
                try {
                  const compressed = await compressUploadImageFile(file)
                  const uploaded = await onUpload(compressed, field.id)
                  if (uploaded) onSaved(uploaded, compressed.name)
                } finally {
                  setBusy(false)
                }
              })()
            }}
          />
        </label>
      )}
    </div>
  )
}

function textOf(block: SectionContentBlock | undefined): string {
  if (!block) return ""
  if (block.type === "text") return block.html
  if (block.type === "link") return block.url
  if (block.type === "image" || block.type === "figure") return block.url
  return ""
}

function ClassRosterPicker({
  classmates,
  value,
  onChange,
}: {
  classmates: Array<{ id: number; full_name: string; student_id?: string }>
  value: string
  onChange: (names: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const selected = new Set(
    value
      .split(/\n|,/)
      .map((name) => name.trim())
      .filter(Boolean),
  )
  const toggle = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    onChange([...next])
  }
  const needle = query.trim().toLowerCase()
  const visible = classmates.filter((student) => {
    if (!needle) return true
    return student.full_name.toLowerCase().includes(needle) || (student.student_id || "").toLowerCase().includes(needle)
  })
  if (classmates.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No classmates found for this section yet.</p>
  }
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] p-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search classmates"
        aria-label="Search classmates"
      />
      <p className={cn("px-1 text-xs", PORTAL_TEXT_MUTED)}>
        {selected.size} selected. Check everyone on the project.
      </p>
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className={cn("px-2 py-3 text-sm", PORTAL_TEXT_MUTED)}>No classmates match that search.</p>
        ) : (
          visible.map((student) => {
            const on = selected.has(student.full_name)
            return (
              <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--muted)]/50">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--cc-accent)]"
                  checked={on}
                  onChange={() => toggle(student.full_name)}
                />
                <span className={cn("text-sm", PORTAL_TEXT)}>{student.full_name}</span>
                {student.student_id ? <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{student.student_id}</span> : null}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

function stopClipboard(event: { preventDefault: () => void; stopPropagation: () => void }) {
  event.preventDefault()
  event.stopPropagation()
}

export function ProjectSectionFieldForm({
  fields,
  blocks,
  onChange,
  onUpload,
  classmates = [],
  blockPaste = false,
}: {
  fields: ProjectResponseField[]
  blocks: SectionContentBlock[]
  onChange: (next: SectionContentBlock[]) => void
  onUpload?: (file: File, fieldId: string) => Promise<string | null>
  classmates?: Array<{ id: number; full_name: string; student_id?: string }>
  blockPaste?: boolean
}) {
  const setBlock = (field: ProjectResponseField, nextBlock: SectionContentBlock) => {
    const rest = blocks.filter((b) => b.id !== field.id)
    onChange([...rest, nextBlock])
  }

  return (
    <div
      className="space-y-4"
      onPaste={blockPaste ? stopClipboard : undefined}
      onCopy={blockPaste ? stopClipboard : undefined}
      onCut={blockPaste ? stopClipboard : undefined}
      onDrop={blockPaste ? stopClipboard : undefined}
      onDragOver={blockPaste ? (event) => event.preventDefault() : undefined}
      onBeforeInput={
        blockPaste
          ? (event) => {
              const inputType = (event.nativeEvent as InputEvent).inputType
              if (inputType === "insertFromPaste" || inputType === "insertFromDrop") stopClipboard(event)
            }
          : undefined
      }
      onKeyDown={
        blockPaste
          ? (event) => {
              if ((event.metaKey || event.ctrlKey) && ["v", "c", "x"].includes(event.key.toLowerCase())) stopClipboard(event)
            }
          : undefined
      }
    >
      {blockPaste ? (
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Copy and paste is off for this section. Type the answer.</p>
      ) : null}
      {fields.map((field) => {
        const block = blocks.find((b) => b.id === field.id)
        const value = textOf(block)
        return (
          <div key={field.id} className="space-y-1.5">
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
              {field.label}
              {field.required ? <span className="text-[var(--cc-sem-danger)]"> *</span> : null}
            </p>
            {field.help ? <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{field.help}</p> : null}
            {field.kind === "short_text" ? (
              <Input value={value} onChange={(e) => setBlock(field, { id: field.id, type: "text", html: e.target.value })} />
            ) : null}
            {field.kind === "roster" || field.id === "cover-members" ? (
              <ClassRosterPicker
                classmates={classmates}
                value={value}
                onChange={(names) => setBlock(field, { id: field.id, type: "text", html: names.join("\n") })}
              />
            ) : field.kind === "checklist" ? (
              <Textarea
                rows={4}
                value={value}
                placeholder="One item per line"
                onChange={(e) => setBlock(field, { id: field.id, type: "text", html: e.target.value })}
              />
            ) : field.kind === "long_text" ? (
              <AnnouncementRichTextEditor
                value={value}
                placeholder={`Write ${field.label.toLowerCase()}…`}
                onChange={(html) => setBlock(field, { id: field.id, type: "text", html })}
                onInsertImage={
                  onUpload
                    ? async (file) => onUpload(file, field.id)
                    : undefined
                }
              />
            ) : null}
            {field.kind === "link" ? (
              <Input
                type="url"
                placeholder="https://"
                value={block?.type === "link" ? block.url : value}
                onChange={(e) => setBlock(field, { id: field.id, type: "link", url: e.target.value, label: field.label })}
              />
            ) : null}
            {field.kind === "image" ? (
              <ImageAnswerField
                field={field}
                url={block?.type === "image" || block?.type === "figure" ? block.url : ""}
                onUpload={onUpload}
                onClear={() => onChange(blocks.filter((item) => item.id !== field.id))}
                onSaved={(url, name) => setBlock(field, { id: field.id, type: "image", url, caption: name })}
              />
            ) : null}
            {field.kind === "file" ? (
              <div className="space-y-2">
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file || !onUpload) return
                    void onUpload(file, field.id).then((url) => {
                      if (!url) return
                      setBlock(field, { id: field.id, type: "link", url, label: file.name })
                    })
                  }}
                />
                {value ? (
                  <a className="text-sm text-[var(--cc-accent)] underline" href={value} target="_blank" rel="noreferrer">
                    View uploaded file
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
