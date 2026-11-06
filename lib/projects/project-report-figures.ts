import type { ProjectResponseField, SectionContentBlock } from "@/lib/projects/project-template-types"

export type CataloguedFigure = {
  number: number
  key: string
  src: string
  caption: string
  sectionTitle: string
  fieldLabel: string | null
  blockId: string
}

function decodeAttr(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
}

function captionFor(block: SectionContentBlock, fallback: string) {
  if (block.type === "image" || block.type === "figure") {
    return (block.caption || block.alt || fallback).trim() || fallback
  }
  if (block.type === "diagram") {
    return (block.description || fallback).trim() || fallback
  }
  return fallback
}

function urlsInHtml(html: string) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0]
    const src = /src="([^"]+)"/i.exec(tag)
    const alt = /alt="([^"]+)"/i.exec(tag)
    const url = decodeAttr(src?.[1] || "")
    if (!url) return []
    return [{ src: url, caption: decodeAttr(alt?.[1] || "") }]
  })
}

export function figureLine(figure: CataloguedFigure) {
  return `See ${figure.key} in Appendix A — ${figure.caption}.`
}

export function figureHeading(figure: CataloguedFigure) {
  return `${figure.key}. ${figure.caption}`
}

export function figuresForBlock(figures: CataloguedFigure[], blockId: string) {
  return figures.filter((figure) => figure.blockId === blockId || figure.blockId.startsWith(`${blockId}-`))
}

export function figureSourceLine(figure: CataloguedFigure) {
  return figure.fieldLabel ? `${figure.sectionTitle} · ${figure.fieldLabel}` : figure.sectionTitle
}

export function collectFiguresFromSections(
  sections: Array<{
    title: string
    config?: { response_fields?: Array<Pick<ProjectResponseField, "id" | "label">> | null }
    blocks?: SectionContentBlock[] | null
  }>,
): CataloguedFigure[] {
  const figures: CataloguedFigure[] = []
  const seen = new Set<string>()

  for (const section of sections) {
    const fields = section.config?.response_fields ?? []
    const labelById = new Map(fields.map((field) => [field.id, field.label]))
    const blocks = section.blocks ?? []
    for (const block of blocks) {
      const fallback = labelById.get(block.id) || "Untitled figure"
      const found: Array<{ src: string; caption: string; blockId: string }> = []
      if ((block.type === "image" || block.type === "figure") && block.url) {
        found.push({ src: block.url, caption: captionFor(block, fallback), blockId: block.id })
      } else if (block.type === "diagram" && block.url) {
        found.push({ src: block.url, caption: captionFor(block, fallback), blockId: block.id })
      } else if (block.type === "text" && block.html) {
        urlsInHtml(block.html).forEach((image, index) => {
          found.push({
            src: image.src,
            caption: image.caption || fallback,
            blockId: index === 0 ? block.id : `${block.id}-${index}`,
          })
        })
      }
      for (const item of found) {
        const token = `${item.blockId}::${item.src}`
        if (seen.has(token)) continue
        seen.add(token)
        const number = figures.length + 1
        figures.push({
          number,
          key: `Figure ${number}`,
          src: item.src,
          caption: item.caption.replace(/^Figure\s+\d+[.:]?\s*/i, "") || fallback,
          sectionTitle: section.title,
          fieldLabel: labelById.get(block.id) ?? null,
          blockId: item.blockId,
        })
      }
    }
  }

  return figures
}
