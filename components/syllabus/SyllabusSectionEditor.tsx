"use client"

import { useState } from "react"
import { ChevronDown, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SyllabusRichTextEditor } from "@/components/syllabus/SyllabusRichTextEditor"
import { SyllabusTableEditor } from "@/components/syllabus/SyllabusTableEditor"
import { SyllabusSectionImageUpload } from "@/components/syllabus/SyllabusSectionImageUpload"
import { SyllabusSectionDocumentUpload } from "@/components/syllabus/SyllabusSectionDocumentUpload"
import { SyllabusSectionView } from "@/components/syllabus/SyllabusSectionView"
import {
  SYLLABUS_LABEL,
  SYLLABUS_PREVIEW_PANEL,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"
import type { SyllabusSection } from "@/lib/syllabus/types"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"

type SyllabusSectionEditorProps = {
  section: SyllabusSection
  index?: number
  defaultExpanded?: boolean
  onChange: (section: SyllabusSection) => void
  onRemove?: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  imageUploading?: boolean
  onImageUpload?: (file: File, caption?: string) => Promise<void>
  onImageRemove?: () => Promise<void>
  documentUploading?: boolean
  onDocumentUpload?: (file: File) => Promise<void>
  onDocumentRemove?: () => Promise<void>
}

export function SyllabusSectionEditor({
  section,
  index = 0,
  defaultExpanded = false,
  onChange,
  onRemove,
  dragHandleProps,
  imageUploading = false,
  onImageUpload,
  onImageRemove,
  documentUploading = false,
  onDocumentUpload,
  onDocumentRemove,
}: SyllabusSectionEditorProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const stripe = portalThemeStripe(index)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const updateField = (key: string, value: string) => {
    onChange({
      ...section,
      content: {
        ...section.content,
        fields: { ...(section.content.fields ?? {}), [key]: value },
      },
    })
  }

  const updateItem = (itemIndex: number, value: string) => {
    const items = [...(section.content.items ?? [])]
    items[itemIndex] = value
    onChange({ ...section, content: { ...section.content, items } })
  }

  const addItem = () => {
    onChange({
      ...section,
      content: {
        ...section.content,
        items: [...(section.content.items ?? []), ""],
      },
    })
  }

  const removeItem = (itemIndex: number) => {
    onChange({
      ...section,
      content: {
        ...section.content,
        items: (section.content.items ?? []).filter((_, i) => i !== itemIndex),
      },
    })
  }

  return (
    <div className={cn(PORTAL_CARD, stripe.row, "overflow-hidden")}>
      <div className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
        {dragHandleProps ? (
          <button
            type="button"
            className="shrink-0 cursor-grab rounded-lg p-1.5 text-[var(--cc-text-muted)] hover:bg-muted/40"
            aria-label="Reorder section"
            {...dragHandleProps}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : null}

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-semibold", PORTAL_TEXT)}>
              {section.title || "Untitled section"}
            </span>
            <span className={cn("block text-xs", PORTAL_TEXT_MUTED)}>
              {section.isRequired ? "Required" : "Optional"}
              {section.isVisible ? "" : " · Hidden from students"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--cc-text-muted)] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {section.isVisible ? (
            <Eye className="hidden h-4 w-4 text-[var(--cc-text-muted)] sm:block" />
          ) : (
            <EyeOff className="hidden h-4 w-4 text-[var(--cc-text-muted)] sm:block" />
          )}
          <Switch
            checked={section.isVisible}
            onCheckedChange={(checked) => onChange({ ...section, isVisible: checked })}
            className={chrome.switchChecked}
            aria-label={section.isVisible ? "Hide section" : "Show section"}
          />
          {!section.isRequired && onRemove ? (
            <Button
              type="button"
              size="sm"
              className={cn("rounded-lg", chrome.danger)}
              onClick={onRemove}
              aria-label="Remove section"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div className="space-y-2">
            <Label htmlFor={`section-title-${section.sectionId}`} className={cn("text-xs", PORTAL_TEXT)}>
              Section title
            </Label>
            <Input
              id={`section-title-${section.sectionId}`}
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
              className="h-9 rounded-lg border-0 bg-[var(--muted)] shadow-none"
            />
          </div>

          {section.content.fields ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(section.content.fields).map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <Label className={cn("text-xs", PORTAL_TEXT)}>{label}</Label>
                  <Input
                    value={value}
                    onChange={(e) => updateField(label, e.target.value)}
                    className="h-9 rounded-lg border-0 bg-[var(--muted)] shadow-none"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {section.content.items ? (
            <div className="space-y-2">
              {(section.content.items ?? []).map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-1.5",
                    portalThemeStripe(itemIndex).row,
                  )}
                >
                  <Input
                    value={item}
                    onChange={(e) => updateItem(itemIndex, e.target.value)}
                    className="h-9 rounded-lg border-0 bg-transparent shadow-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-lg", chrome.danger)}
                    onClick={() => removeItem(itemIndex)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" className={cn("rounded-lg", chrome.solid)} onClick={addItem}>
                Add item
              </Button>
            </div>
          ) : null}

          {"markdown" in section.content ? (
            <SyllabusRichTextEditor
              value={section.content.markdown ?? ""}
              onChange={(markdown) =>
                onChange({ ...section, content: { ...section.content, markdown } })
              }
            />
          ) : null}

          {section.content.columns ? (
            <SyllabusTableEditor
              columns={section.content.columns ?? []}
              rows={section.content.rows ?? []}
              onChange={(columns, rows) =>
                onChange({ ...section, content: { ...section.content, columns, rows } })
              }
            />
          ) : null}

          {(section.sectionId === "required-materials" || section.sectionId === "instructor-info") &&
          onImageUpload ? (
            <SyllabusSectionImageUpload
              variant={section.sectionId === "instructor-info" ? "instructor" : "textbook"}
              imageUrl={section.content.imageUrl}
              imageFileName={section.content.imageFileName}
              imageCaption={section.content.imageCaption}
              uploading={imageUploading}
              onUpload={onImageUpload}
              onRemove={onImageRemove}
              onCaptionChange={
                section.sectionId === "required-materials"
                  ? (caption) =>
                      onChange({
                        ...section,
                        content: { ...section.content, imageCaption: caption },
                      })
                  : undefined
              }
            />
          ) : null}

          {section.sectionId === "curriculum-vitae" && onDocumentUpload ? (
            <SyllabusSectionDocumentUpload
              documentUrl={section.content.documentUrl}
              documentFileName={section.content.documentFileName}
              uploading={documentUploading}
              onUpload={onDocumentUpload}
              onRemove={onDocumentRemove}
            />
          ) : null}

          {section.content.tables?.map((table, tableIndex) => (
            <div key={tableIndex} className="space-y-2 rounded-xl bg-[var(--muted)] p-3 ring-1 ring-[var(--border)]/40">
              <Input
                value={table.title ?? ""}
                placeholder="Table title (optional)"
                onChange={(e) => {
                  const tables = [...(section.content.tables ?? [])]
                  tables[tableIndex] = { ...tables[tableIndex], title: e.target.value }
                  onChange({ ...section, content: { ...section.content, tables } })
                }}
                className="h-9 rounded-lg border-0 bg-[var(--card)] shadow-none"
              />
              <SyllabusTableEditor
                columns={table.columns}
                rows={table.rows}
                onChange={(columns, rows) => {
                  const tables = [...(section.content.tables ?? [])]
                  tables[tableIndex] = { ...tables[tableIndex], columns, rows }
                  onChange({ ...section, content: { ...section.content, tables } })
                }}
              />
            </div>
          ))}

          <div className={SYLLABUS_PREVIEW_PANEL}>
            <p className={cn("mb-3", SYLLABUS_LABEL)}>
              {section.sectionId === "course-header" ? "Student preview (header banner)" : "Preview"}
            </p>
            <SyllabusSectionView section={section} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
