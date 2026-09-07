/** Default side-by-side layout for plain text module blocks. */

import {
  defaultTextImageColumnPair,
  newColumnGridId,
  type ColumnGridContent,
} from "@/lib/summer-camp/column-grid"
import {
  defaultImageTransform,
  normalizeImageTransform,
  type ImageTransform,
} from "@/lib/summer-camp/image-layout"

export type TextBlockSideLayout = {
  mode: "text_image" | "single"
  textWidthFraction?: number
  image?: {
    imageUrl?: string
    caption?: string
    alt?: string
    imageWidthPercent?: number
  } & ImageTransform
}

const DEFAULT_MARKDOWN =
  "### Subsection Title\n\nExplain the concept in one or two sentences.\n\n- Bullet point\n- Bullet point"

export function defaultTextImageSideLayout(): TextBlockSideLayout {
  return {
    mode: "text_image",
    textWidthFraction: 0.58,
    image: {
      imageUrl: "",
      caption: "",
      alt: "Supporting visual",
      imageWidthPercent: 100,
      ...defaultImageTransform("free"),
    },
  }
}

export function defaultTextBlockContent(markdown = DEFAULT_MARKDOWN): Record<string, unknown> {
  return {
    markdown,
    layout: defaultTextImageSideLayout(),
  }
}

export function parseTextBlockSideLayout(
  content: Record<string, unknown>,
): TextBlockSideLayout | null {
  const layout = content.layout as TextBlockSideLayout | undefined
  if (!layout || layout.mode !== "text_image") return null
  return layout
}

/** Convert a text block + side layout into a one-row grid for shared rendering (columns mode only). */
export function textBlockToGridContent(
  content: Record<string, unknown>,
): ColumnGridContent | null {
  const layout = parseTextBlockSideLayout(content)
  if (!layout) return null

  const image = layout.image ?? {}
  const transform = normalizeImageTransform(image)
  if (transform.placement && transform.placement !== "columns") return null

  const textFraction = layout.textWidthFraction ?? 0.58
  const imageFraction = 1 - textFraction

  return {
    gap: 20,
    rowGap: 24,
    rows: [
      {
        id: newColumnGridId("row"),
        columns: [
          {
            id: newColumnGridId("col"),
            widthFraction: textFraction,
            cells: [
              {
                id: newColumnGridId("cell"),
                type: "text",
                markdown: String(content.markdown ?? ""),
              },
            ],
          },
          {
            id: newColumnGridId("col"),
            widthFraction: imageFraction,
            cells: [
              {
                id: newColumnGridId("cell"),
                type: "image",
                imageUrl: String(image.imageUrl ?? ""),
                caption: String(image.caption ?? ""),
                alt: String(image.alt ?? "Supporting visual"),
                imageWidthPercent: transform.widthPercent ?? image.imageWidthPercent ?? 100,
                imageTransform: transform,
              },
            ],
          },
        ],
      },
    ],
  }
}

export function gridContentToTextBlockSideLayout(
  grid: ColumnGridContent,
  markdown: string,
): TextBlockSideLayout | null {
  const row = grid.rows[0]
  if (!row || row.columns.length < 2) return { mode: "single" }

  const textCol = row.columns.find((c) => c.cells.some((cell) => cell.type === "text"))
  const imageCol = row.columns.find((c) => c.cells.some((cell) => cell.type === "image"))
  if (!textCol || !imageCol) return { mode: "single" }

  const imageCell = imageCol.cells.find((c) => c.type === "image")
  return {
    mode: "text_image",
    textWidthFraction: textCol.widthFraction,
    image: {
      imageUrl: imageCell?.imageUrl ?? "",
      caption: imageCell?.caption ?? "",
      alt: imageCell?.alt ?? "",
      imageWidthPercent: imageCell?.imageWidthPercent ?? 100,
      ...(imageCell?.imageTransform ? normalizeImageTransform(imageCell.imageTransform) : defaultImageTransform("columns")),
    },
  }
}

export function defaultTextImageColumnPairFromLayout() {
  return defaultTextImageColumnPair()
}
