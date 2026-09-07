"use client"

import { CampRichMarkdown } from "@/components/summer-camp/CampRichMarkdown"
import { CampTextWithWrappedImage } from "@/components/summer-camp/camp-positionable-image"
import { normalizeImageTransform } from "@/lib/summer-camp/image-layout"
import {
  parseTextBlockSideLayout,
  type TextBlockSideLayout,
} from "@/lib/summer-camp/text-block-layout"

export function CampTextBlockView({
  content,
  omitLeadingSectionHeading,
  collapsibleMarkdownSections,
  editable,
  onLayoutImageChange,
}: {
  content: Record<string, unknown>
  omitLeadingSectionHeading?: boolean
  collapsibleMarkdownSections?: boolean
  editable?: boolean
  onLayoutImageChange?: (patch: Partial<TextBlockSideLayout["image"]>) => void
}) {
  if (content.variant === "welcome_intro") {
    return null
  }

  const layout = parseTextBlockSideLayout(content)
  if (layout?.mode === "text_image" && layout.image) {
    const img = layout.image
    const transform = normalizeImageTransform(img)
    return (
      <CampTextWithWrappedImage
        markdown={String(content.markdown ?? "")}
        imageUrl={img.imageUrl}
        caption={img.caption}
        alt={img.alt}
        transform={transform}
        omitLeadingSectionHeading={omitLeadingSectionHeading}
        collapsibleMarkdownSections={collapsibleMarkdownSections}
        editable={editable}
        onTransformChange={
          onLayoutImageChange
            ? (patch) => onLayoutImageChange({ ...img, ...patch })
            : undefined
        }
      />
    )
  }

  return (
    <CampRichMarkdown
      markdown={String(content.markdown ?? "")}
      omitLeadingSectionHeading={omitLeadingSectionHeading}
      collapsibleSections={collapsibleMarkdownSections}
    />
  )
}

export function hasTextImageLayout(content: Record<string, unknown>): boolean {
  return parseTextBlockSideLayout(content) !== null
}

export function stripTextImageLayout(content: Record<string, unknown>): Record<string, unknown> {
  const { layout: _layout, ...rest } = content
  return rest
}

export function withTextImageLayout(
  content: Record<string, unknown>,
  layout: TextBlockSideLayout,
): Record<string, unknown> {
  return { ...content, layout }
}
