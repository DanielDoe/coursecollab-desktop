import type { CampModuleBlock } from "@/lib/summer-camp/types"

export type ModuleSectionGroup = {
  id: string
  title: string
  blocks: CampModuleBlock[]
}

export type ModuleLayoutItem =
  | { type: "section"; group: ModuleSectionGroup }
  | { type: "knowledge_check"; block: CampModuleBlock }

const HEAVY_BLOCK_TYPES = new Set(["quiz", "checkpoint", "hero"])

function isKnowledgeCheckBlock(block: CampModuleBlock): boolean {
  return block.block_type === "quiz"
}

function sectionContentSize(blocks: CampModuleBlock[]): number {
  let chars = 0
  for (const block of blocks) {
    chars += JSON.stringify(block.content ?? {}).length
  }
  return chars
}

function isLearningObjectives(title: string): boolean {
  return /^Learning [Oo]bjectives$/.test(title.trim())
}

const PART_SECTION_RE = /^Part [IVXLC\d]+ —/i
const SECTION_HEADING_RE = /^Section \d+ —/i

function isMajorSectionTitle(title: string): boolean {
  const t = title.trim()
  return (
    PART_SECTION_RE.test(t) ||
    SECTION_HEADING_RE.test(t) ||
    /^Module (Overview|Outcomes|Summary|Learning Outcomes)$/i.test(t) ||
    /^Learning [Oo]bjectives$/.test(t)
  )
}

function titleFromBlockContent(block: CampModuleBlock): string | null {
  const content = block.content as { title?: string } | null
  const title = content?.title?.trim()
  return title || null
}

/** ## text headings and major interactive/activity titles start a new section. */
export function extractBlockSectionTitle(block: CampModuleBlock): string | null {
  if (block.block_type === "text") {
    const md = String((block.content as { markdown?: string }).markdown ?? "").trim()
    const h2 = md.match(/^## (.+?)(?:\n|$)/)
    if (h2) return h2[1].trim()
    return null
  }

  if (block.block_type === "interactive" || block.block_type === "activity") {
    const title = titleFromBlockContent(block)
    if (title && isMajorSectionTitle(title)) return title
  }

  return null
}

function isPartSectionTitle(title: string): boolean {
  return PART_SECTION_RE.test(title.trim())
}

function isSmallSection(group: ModuleSectionGroup): boolean {
  const size = sectionContentSize(group.blocks)
  if (isLearningObjectives(group.title)) return group.blocks.length <= 2
  if (group.blocks.length === 1 && group.blocks[0].block_type === "text" && size < 450) return true
  if (group.blocks.length <= 2 && size < 700) return true
  return false
}

function hasHeavyBlock(blocks: CampModuleBlock[]): boolean {
  return blocks.some((block) => HEAVY_BLOCK_TYPES.has(block.block_type))
}

function cloneGroup(group: ModuleSectionGroup): ModuleSectionGroup {
  return { ...group, blocks: [...group.blocks] }
}

/** Strip legacy "Section N —" / "Sections N–M —" prefix for renumbering. */
export function stripSectionNumberPrefix(title: string): string | null {
  const rangeMatch = title.match(/^Sections? \d+(?:[–-]\d+)? — (.+)$/)
  if (rangeMatch) return rangeMatch[1].trim()
  return null
}

export function sectionDisplayLabel(title: string): string {
  return stripSectionNumberPrefix(title) ?? title
}

/** Chronological Section 1…N titles; badge index + 1 matches section number. */
export function applySectionNumbering(groups: ModuleSectionGroup[]): ModuleSectionGroup[] {
  return groups.map((group, index) => {
    const sectionNum = index + 1
    const label = sectionDisplayLabel(group.title)
    const newTitle = `Section ${sectionNum} — ${label}`
    const blocks = [...group.blocks]
    const first = blocks[0]

    if (first?.block_type === "text") {
      const md = String((first.content as { markdown?: string }).markdown ?? "")
      if (/^## /.test(md)) {
        const updated = md.replace(/^## .+(?=\n|$)/, `## ${newTitle}`)
        if (updated !== md) {
          blocks[0] = { ...first, content: { ...first.content, markdown: updated } }
        }
      }
    }

    return { ...group, title: newTitle, blocks }
  })
}

/** Fold tiny or redundant sections into neighbors to reduce accordion clutter. */
function consolidateShortSections(groups: ModuleSectionGroup[]): ModuleSectionGroup[] {
  if (groups.length <= 1) return groups

  const result: ModuleSectionGroup[] = []
  let pending: ModuleSectionGroup | null = null

  for (const group of groups) {
    if (!pending) {
      pending = cloneGroup(group)
      continue
    }

    const pendingSize = sectionContentSize(pending.blocks)
    const groupSize = sectionContentSize(group.blocks)
    const combinedSize = pendingSize + groupSize

    const mergeLearningObjectives = isLearningObjectives(group.title)
    const mergeTinyTextSection =
      group.blocks.length === 1 &&
      group.blocks[0].block_type === "text" &&
      groupSize < 400 &&
      !hasHeavyBlock(group.blocks)
    const mergeConsecutiveShort =
      isSmallSection(pending) &&
      isSmallSection(group) &&
      combinedSize < 2800 &&
      !hasHeavyBlock(group.blocks) &&
      !isPartSectionTitle(pending.title) &&
      !isPartSectionTitle(group.title) &&
      !isMajorSectionTitle(pending.title) &&
      !isMajorSectionTitle(group.title)

    if (mergeLearningObjectives || mergeTinyTextSection || mergeConsecutiveShort) {
      pending.blocks.push(...group.blocks)
      continue
    }

    result.push(pending)
    pending = cloneGroup(group)
  }

  if (pending) result.push(pending)
  return result
}

/** Group module blocks into collapsible sections (## text headings start a new group). */
export function groupModuleBlocks(blocks: CampModuleBlock[]): ModuleSectionGroup[] {
  const groups: ModuleSectionGroup[] = []
  let preamble: CampModuleBlock[] = []
  let current: ModuleSectionGroup | null = null

  const flushPreamble = () => {
    if (preamble.length === 0) return
    const anchor = preamble[0]
    groups.push({
      id: `section-${anchor.id}`,
      title: "Overview",
      blocks: preamble,
    })
    preamble = []
  }

  for (const block of blocks) {
    const title = extractBlockSectionTitle(block)
    if (title) {
      flushPreamble()
      if (current) groups.push(current)
      current = {
        id: `section-${block.id}`,
        title,
        blocks: [block],
      }
      continue
    }

    if (current) {
      current.blocks.push(block)
    } else {
      preamble.push(block)
    }
  }

  if (current) {
    groups.push(current)
  } else {
    flushPreamble()
  }

  return consolidateShortSections(groups)
}

/**
 * Lay out module content with knowledge checks outside collapsible sections.
 * Groups the full module once so section numbers stay chronological (no duplicate Overview).
 */
export function layoutModuleBlocks(blocks: CampModuleBlock[]): ModuleLayoutItem[] {
  const quizIds = new Set<number>()
  for (const block of blocks) {
    if (isKnowledgeCheckBlock(block)) quizIds.add(block.id)
  }

  const contentBlocks = blocks.filter((block) => !quizIds.has(block.id))
  const groups = applySectionNumbering(groupModuleBlocks(contentBlocks))

  const blockToGroup = new Map<number, ModuleSectionGroup>()
  for (const group of groups) {
    for (const block of group.blocks) {
      blockToGroup.set(block.id, group)
    }
  }

  const items: ModuleLayoutItem[] = []
  const emittedGroupIds = new Set<string>()

  for (const block of blocks) {
    if (isKnowledgeCheckBlock(block)) {
      items.push({ type: "knowledge_check", block })
      continue
    }

    const group = blockToGroup.get(block.id)
    if (!group || emittedGroupIds.has(group.id)) continue

    emittedGroupIds.add(group.id)
    items.push({ type: "section", group })
  }

  return items
}

/** True when the block's ## heading is already shown as the section accordion title. */
export function shouldOmitLeadingSectionHeading(block: CampModuleBlock, groupTitle: string): boolean {
  const heading = extractBlockSectionTitle(block)
  if (!heading) return false
  return heading === groupTitle || sectionDisplayLabel(heading) === sectionDisplayLabel(groupTitle)
}
