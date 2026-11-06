"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectSectionContentType, SectionContentBlock } from "@/lib/projects/project-template-types"

const BLOCK_LABELS: Record<ProjectSectionContentType, string> = {
  text: "Text",
  image: "Image",
  figure: "Figure",
  table: "Table",
  code: "Code",
  equation: "Equation",
  file: "File",
  link: "Link",
  diagram: "Diagram",
}

function newBlock(type: ProjectSectionContentType): SectionContentBlock {
  const id = `${type}-${Date.now()}`
  switch (type) {
    case "text":
      return { id, type: "text", html: "" }
    case "code":
      return { id, type: "code", language: "c", code: "" }
    case "equation":
      return { id, type: "equation", latex: "" }
    case "table":
      return { id, type: "table", headers: ["Column A", "Column B"], rows: [["", ""]] }
    case "link":
      return { id, type: "link", url: "", label: "" }
    case "file":
      return { id, type: "file", file_id: 0, label: "" }
    default:
      return { id, type: type as "image" | "figure" | "diagram", url: "", caption: "" }
  }
}

export function ProjectSectionEditor({
  blocks,
  allowedTypes,
  onChange,
  onAttachFigure,
}: {
  blocks: SectionContentBlock[]
  allowedTypes: ProjectSectionContentType[]
  onChange: (blocks: SectionContentBlock[]) => void
  onAttachFigure?: (file: File) => Promise<{ url: string } | null>
}) {
  const types = allowedTypes.length ? allowedTypes : (["text", "figure", "table", "code"] as ProjectSectionContentType[])

  const updateBlock = (index: number, block: SectionContentBlock) => {
    const next = [...blocks]
    next[index] = block
    onChange(next)
  }

  const removeBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index))

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-lg border border-[var(--border)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
              {BLOCK_LABELS[block.type]}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(index)}>
              Remove
            </Button>
          </div>

          {block.type === "text" ? (
            <Textarea
              rows={8}
              value={block.html}
              onChange={(e) => updateBlock(index, { ...block, html: e.target.value })}
            />
          ) : null}

          {block.type === "code" ? (
            <>
              <Input value={block.language} onChange={(e) => updateBlock(index, { ...block, language: e.target.value })} />
              <Textarea rows={6} className="font-mono text-sm" value={block.code} onChange={(e) => updateBlock(index, { ...block, code: e.target.value })} />
            </>
          ) : null}

          {block.type === "equation" ? (
            <Input value={block.latex} onChange={(e) => updateBlock(index, { ...block, latex: e.target.value })} placeholder="LaTeX" />
          ) : null}

          {block.type === "table" ? (
            <Textarea
              rows={5}
              className="font-mono text-sm"
              value={[block.headers.join("\t"), ...block.rows.map((r) => r.join("\t"))].join("\n")}
              onChange={(e) => {
                const lines = e.target.value.split("\n").filter(Boolean)
                const headers = (lines[0] ?? "Col1\tCol2").split("\t")
                const rows = lines.slice(1).map((l) => l.split("\t"))
                updateBlock(index, { ...block, headers, rows: rows.length ? rows : [[""]] })
              }}
            />
          ) : null}

          {block.type === "link" ? (
            <>
              <Input value={block.label} onChange={(e) => updateBlock(index, { ...block, label: e.target.value })} placeholder="Label" />
              <Input value={block.url} onChange={(e) => updateBlock(index, { ...block, url: e.target.value })} placeholder="URL" />
            </>
          ) : null}

          {(block.type === "image" || block.type === "figure" || block.type === "diagram") && (
            <>
              <Input value={block.url ?? ""} onChange={(e) => updateBlock(index, { ...block, url: e.target.value })} placeholder="Image URL" />
              {block.type === "diagram" ? (
                <Input
                  value={block.description ?? ""}
                  onChange={(e) => updateBlock(index, { ...block, description: e.target.value })}
                  placeholder="Description"
                />
              ) : (
                <Input value={block.caption ?? ""} onChange={(e) => updateBlock(index, { ...block, caption: e.target.value })} placeholder="Caption" />
              )}
              {onAttachFigure ? (
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void onAttachFigure(file).then((res) => {
                      if (res?.url) updateBlock(index, { ...block, url: res.url })
                    })
                  }}
                />
              ) : null}
            </>
          )}

          {block.type === "file" ? (
            <p className="text-sm text-[var(--cc-text-muted)]">Upload evidence under Files &amp; Evidence.</p>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <Button key={t} type="button" variant="outline" size="sm" onClick={() => onChange([...blocks, newBlock(t)])}>
            + {BLOCK_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  )
}
