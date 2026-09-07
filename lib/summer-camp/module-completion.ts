import type { CampModuleBlock } from "@/lib/summer-camp/types"

export type BlockProgressMap = Record<string, Record<string, unknown>>

export type CompletionGap = {
  label: string
  blockId: number
  blockType: string
}

export function isKnowledgeCheckBlock(block: CampModuleBlock): boolean {
  return block.block_type === "quiz"
}

/** Unanswered knowledge check (quiz) blocks only — required before module completion. */
export function getKnowledgeCheckCompletionGaps(
  blocks: CampModuleBlock[],
  progressByBlock: Map<number, BlockProgressMap>,
  completedSteps: Set<number>,
  submissionByBlock: Set<number>,
  camperProfile?: Record<string, unknown>,
): CompletionGap[] {
  const quizBlocks = blocks.filter(isKnowledgeCheckBlock)
  return getModuleCompletionGaps(
    quizBlocks,
    progressByBlock,
    completedSteps,
    submissionByBlock,
    camperProfile,
  )
}

export function canMarkModuleCompleteFromKnowledgeChecks(
  blocks: CampModuleBlock[],
  progressByBlock: Map<number, BlockProgressMap>,
  completedSteps: Set<number>,
  submissionByBlock: Set<number>,
  camperProfile?: Record<string, unknown>,
): boolean {
  return getKnowledgeCheckCompletionGaps(
    blocks,
    progressByBlock,
    completedSteps,
    submissionByBlock,
    camperProfile,
  ).length === 0
}

/** Blocks campers must finish before marking the module complete. */
export function blockRequiresCamperAction(block: CampModuleBlock): boolean {
  if (block.block_type === "module_completion") return false

  switch (block.block_type) {
    case "quiz":
    case "reflection":
    case "step":
    case "checkpoint":
    case "feedback":
    case "confidence":
    case "profile_form":
      return true
    case "activity": {
      const options = (block.content.options as string[]) ?? []
      return options.length > 0
    }
    case "interactive":
      return String(block.content.variant ?? "") === "start_journey"
    default:
      return false
  }
}

export function isBlockRequirementMet(
  block: CampModuleBlock,
  blockProgress: BlockProgressMap | undefined,
  completedSteps: Set<number>,
  hasSubmission: boolean,
  camperProfile?: Record<string, unknown>,
): boolean {
  const progress = blockProgress ?? {}

  switch (block.block_type) {
    case "step":
      return completedSteps.has(block.id)
    case "checkpoint":
      return hasSubmission
    case "quiz": {
      const quiz = progress.quiz_response as
        | { submitted?: boolean; answers?: Record<string, unknown> }
        | undefined
      if (!quiz?.submitted) return false
      const questions = (block.content.questions as Array<{ id: string }>) ?? []
      if (questions.length === 0) return true
      const answers = quiz.answers ?? {}
      return questions.every((q) => answers[q.id] != null)
    }
    case "reflection": {
      const ref = progress.reflection as
        | { text?: string; selection?: string; optionIndex?: number }
        | undefined
      return Boolean(ref?.text?.trim() || ref?.selection?.trim() || ref?.optionIndex != null)
    }
    case "activity": {
      const eng = progress.engagement as { selected?: unknown[]; revealed?: boolean } | undefined
      const options = (block.content.options as string[]) ?? []
      if (options.length === 0) return true
      return Boolean(eng?.revealed && (eng.selected?.length ?? 0) > 0)
    }
    case "interactive": {
      const eng = progress.engagement as { journeyRevealed?: boolean } | undefined
      return Boolean(eng?.journeyRevealed)
    }
    case "profile_form": {
      const fields =
        (block.content.fields as Array<{ key: string; label?: string }>) ?? []
      if (fields.length === 0) return true
      return fields.every((f) => {
        const v = camperProfile?.[f.key]
        return v != null && String(v).trim() !== ""
      })
    }
    case "feedback": {
      const fb = progress.feedback as Record<string, unknown> | undefined
      const kind = String(block.content.kind ?? "")
      if (kind === "excitement") {
        return fb?.readyToContinue != null && fb?.emotion != null
      }
      if (kind === "module_reflection") {
        return Boolean(fb?.submitted)
      }
      return fb?.rating != null || fb?.value != null || Boolean(fb?.submitted)
    }
    case "confidence": {
      const conf = progress.confidence as { level?: number } | undefined
      return conf?.level != null
    }
    default:
      return true
  }
}

function truncateLabel(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function gapLabelForBlock(block: CampModuleBlock): string {
  const content = block.content as Record<string, unknown>
  switch (block.block_type) {
    case "quiz":
      return String(content.title ?? "Knowledge Check")
    case "reflection": {
      const prompt = truncateLabel(String(content.prompt ?? ""))
      return prompt || "Reflection journal entry"
    }
    case "step":
      return String(content.title ?? "Checkpoint step")
    case "checkpoint":
      return String(content.title ?? "Upload checkpoint")
    case "activity":
      return String(content.title ?? "Activity")
    case "feedback": {
      const kind = String(content.kind ?? "")
      if (kind === "excitement") {
        return truncateLabel(String(content.question ?? "How excited are you about this camp?"))
      }
      if (kind === "module_reflection") {
        const label = truncateLabel(
          String(
            content.interestingPrompt ??
              content.sentencePrompt ??
              content.confidenceLabel ??
              "End-of-module reflection",
          ),
        )
        return label || "End-of-module reflection"
      }
      return truncateLabel(String(content.question ?? "Module feedback"))
    }
    case "confidence":
      return truncateLabel(String(content.question ?? "Confidence check"))
    case "profile_form":
      return String(content.title ?? "Profile form")
    case "interactive":
      return String(content.title ?? "Start My Journey")
    default:
      return block.block_type
  }
}

function disambiguateGapLabels(gaps: CompletionGap[]): CompletionGap[] {
  const seen = new Map<string, number>()
  return gaps.map((gap) => {
    const count = (seen.get(gap.label) ?? 0) + 1
    seen.set(gap.label, count)
    if (count === 1) return gap
    return { ...gap, label: `${gap.label} (${count})` }
  })
}

export function getModuleCompletionGaps(
  blocks: CampModuleBlock[],
  progressByBlock: Map<number, BlockProgressMap>,
  completedSteps: Set<number>,
  submissionByBlock: Set<number>,
  camperProfile?: Record<string, unknown>,
): CompletionGap[] {
  const gaps: CompletionGap[] = []

  for (const block of blocks) {
    if (!blockRequiresCamperAction(block)) continue
    const met = isBlockRequirementMet(
      block,
      progressByBlock.get(block.id),
      completedSteps,
      submissionByBlock.has(block.id),
      camperProfile,
    )
    if (!met) {
      gaps.push({
        label: gapLabelForBlock(block),
        blockId: block.id,
        blockType: block.block_type,
      })
    }
  }

  return disambiguateGapLabels(gaps)
}

export function canMarkModuleComplete(
  blocks: CampModuleBlock[],
  progressByBlock: Map<number, BlockProgressMap>,
  completedSteps: Set<number>,
  submissionByBlock: Set<number>,
  camperProfile?: Record<string, unknown>,
): boolean {
  return (
    getModuleCompletionGaps(
      blocks,
      progressByBlock,
      completedSteps,
      submissionByBlock,
      camperProfile,
    ).length === 0
  )
}
